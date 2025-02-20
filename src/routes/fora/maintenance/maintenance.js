import { SMSHUB_APIKEY } from "$env/static/private";
import { RetryError, retry } from "$lib/retry";
import {
	accounts,
	activeBonuses,
	bonuses,
	coupons,
	receiptProducts,
	receipts,
	referrBonuses,
	subscriptions,
} from "$lib/schema/fora";
import { devices } from "$lib/schema/public";
import { db } from "$lib/server/db";
import cached_devices from "$lib/server/devices.json";
import {
	Account,
	Platfrom,
	REFERRAL_MINIMUM_SPEND,
	REFERRAL_REWARD_AMOUNT,
	checkUser,
	confirmationOtp,
	getAppConfigurations,
	getChequesInfos,
	getLastChequeHeadersFast,
	getPersonalInfo,
	refreshToken,
	registerUser,
	registerUserReferral,
	sendOTP,
	setBonusToApply,
} from "$lib/server/fora";
import logger from "$lib/server/logger";
import { getPhoneNumber } from "$lib/server/smshub";
import { and, count, eq, gt, gte, inArray, lt, not, or, sql } from "drizzle-orm";
import { getDoubleReferrerStrategy } from "./double_referrer_strategy";

export async function maintenance() {
	try {
		await syncCouponInfos();
		await createNewCoupons();
	} finally {
		await logger.flush();
	}
}

export async function syncCouponInfos() {
	const awaitingReceipts = await db
		.select({
			coupon: {
				id: coupons.id,
				status: coupons.status,
				familyId: coupons.familyId,
				discount: coupons.discount,
				isReferral: coupons.isReferral,
				createdAt: coupons.createdAt,
				expiredAt: coupons.expiredAt,
			},
			account: {
				id: accounts.id,
				accessToken: accounts.accessToken,
				refreshToken: accounts.refreshToken,
			},
			device: {
				brand: devices.brand,
				model: devices.model,
				fingerprint: devices.fingerprint,
			},
		})
		.from(coupons)
		.innerJoin(accounts, eq(accounts.id, coupons.accountId))
		.innerJoin(devices, eq(devices.id, accounts.deviceId))
		.where(inArray(coupons.status, ["assigned", "hidden"]));

	/** @type {typeof bonuses.$inferInsert[]} */
	const _bonuses = [];
	/** @type {typeof receipts.$inferInsert[]} */
	const _receipts = [];
	/** @type {typeof receiptProducts.$inferInsert[]} */
	const _receiptProducts = [];
	/** @type {typeof coupons.$inferInsert[]} */
	const _coupons = [];

	for (const { coupon, account, device } of awaitingReceipts) {
		const a = new Account(account.accessToken, account.refreshToken, device);
		await refreshAccount(account.id, a);

		// Synchronize all receipts since the creation of this coupon
		const data = await getReceiptsWithProducts(a, coupon.id, coupon.createdAt);
		_receipts.push(...data.receipts);
		_receiptProducts.push(...data.products);

		/**
		 * Receipt which triggered referral reward
		 * @type {typeof data.receipts[number]?}
		 */
		let receiptWithReward = null;
		let remainingDiscount = parseFloat(coupon.discount);
		for (const receipt of data.receipts) {
			const usedDiscount = parseFloat(receipt.discount);
			if (
				parseFloat(receipt.total) + usedDiscount >= REFERRAL_MINIMUM_SPEND &&
				(!receiptWithReward || receipt.createdAt < receiptWithReward.createdAt)
			) {
				receiptWithReward = receipt;
			}
			remainingDiscount -= usedDiscount;
		}

		// Update coupon status and recreate it in case of cancellation
		let newStatus = coupon.status;
		if (coupon.isReferral && receiptWithReward) {
			newStatus = "applied";
			const accruedOn = getDateAterTomorrow(receiptWithReward.createdAt);
			const expiredOn = getNext3Month(accruedOn);
			_bonuses.push({
				accountId: account.id,
				accruedOn: accruedOn.toISOString(),
				expiredOn: expiredOn.toISOString(),
				amount: REFERRAL_REWARD_AMOUNT.toString(),
			});
			_coupons.push({
				status: "template",
				familyId: coupon.familyId,
				accountId: account.id,
				isReferral: false,
				discount: REFERRAL_REWARD_AMOUNT.toString(),
				expiredAt: expiredOn,
			});
		} else if (coupon.isReferral || remainingDiscount > 10) {
			newStatus = "canceled";
			_coupons.push({
				status: "template",
				familyId: coupon.familyId,
				accountId: account.id,
				isReferral: coupon.isReferral,
				discount: "0",
				expiredAt: coupon.expiredAt,
			});
		} else {
			newStatus = "applied";
		}
		await db.update(coupons).set({ status: newStatus }).where(eq(coupons.id, coupon.id));
	}

	if (_receipts.length && _receiptProducts.length) {
		await db.insert(receipts).values(_receipts).onConflictDoNothing();
		await db.insert(receiptProducts).values(_receiptProducts).onConflictDoNothing();
	}
	if (_bonuses.length) {
		await db.insert(bonuses).values(_bonuses).onConflictDoNothing();
	}
	if (_coupons.length) {
		await db.insert(coupons).values(_coupons);
	}

	const templates = await db
		.select({
			coupon: {
				id: coupons.id,
				discount: coupons.discount,
			},
			account: {
				id: accounts.id,
				accessToken: accounts.accessToken,
				refreshToken: accounts.refreshToken,
			},
			device: {
				brand: devices.brand,
				model: devices.model,
				fingerprint: devices.fingerprint,
			},
		})
		.from(coupons)
		.innerJoin(accounts, eq(accounts.id, coupons.accountId))
		.innerJoin(devices, eq(devices.id, accounts.deviceId))
		.leftJoin(activeBonuses, eq(coupons.accountId, activeBonuses.accountId))
		.leftJoin(referrBonuses, eq(coupons.accountId, referrBonuses.accountId))
		.where(
			and(
				eq(coupons.status, "template"),
				or(
					eq(coupons.discount, "0"),
					and(not(coupons.isReferral), gte(activeBonuses.amount, coupons.discount)),
					and(coupons.isReferral, gte(referrBonuses.amount, coupons.discount)),
				),
			),
		);

	for (const { coupon, account, device } of templates) {
		const a = new Account(account.accessToken, account.refreshToken, device);
		await refreshAccount(account.id, a);

		const { personalInfo } = await getPersonalInfo(a, true);
		const bonusBalance = personalInfo.Bonus.bonusBalanceAmount;

		let value;
		if (bonusBalance < parseFloat(coupon.discount)) {
			value = /** @type {const} */ ({ status: "reported" });
		} else {
			value = /** @type {const} */ ({ status: "available", discount: bonusBalance.toString() });
		}
		await db.update(coupons).set(value).where(eq(coupons.id, coupon.id));
	}
}

export async function createNewCoupons() {
	const expiredAt = getNext60Days(new Date());

	const subs = await db
		.select({
			familyId: subscriptions.familyId,
			surplus: subscriptions.surplus,
			count: count(coupons.id).as("count"),
			rootId: subscriptions.rootId,
			height: subscriptions.height,
		})
		.from(subscriptions)
		.leftJoin(
			coupons,
			and(
				eq(coupons.familyId, subscriptions.familyId),
				coupons.isReferral,
				eq(coupons.status, "available"),
			),
		)
		.where(gt(subscriptions.expiredAt, sql`now()`))
		.groupBy(subscriptions.familyId)
		.having(({ count }) => lt(count, subscriptions.surplus));

	logger.info("subscriptions", subs);

	for (const sub of subs) {
		if (sub.rootId === null) {
			const empty = await retry(() => registerAccount());
			const root = await retry(() => registerAccount(empty.sessionId));
			root.referrerId = empty.id;
			await db.insert(accounts).values([empty, root]);
			await db.insert(coupons).values([
				{
					accountId: empty.id,
					discount: REFERRAL_REWARD_AMOUNT.toString(),
					isReferral: false,
					status: "template",
					familyId: sub.familyId,
					expiredAt: getNext3Month(new Date()),
				},
				{
					accountId: root.id,
					discount: (2 * REFERRAL_REWARD_AMOUNT).toString(),
					isReferral: true,
					status: "template",
					familyId: sub.familyId,
					expiredAt: expiredAt,
				},
			]);
			sub.rootId = root.id;
			await db
				.update(subscriptions)
				.set({ rootId: root.id })
				.where(eq(subscriptions.familyId, sub.familyId));
		}

		const strategy = await getDoubleReferrerStrategy(sub.height, sub.rootId);
		const iterator = strategy.iterator();
		let referrer = strategy.peek();
		let todo = sub.surplus - sub.count;

		while (referrer && todo > 0) {
			const isLeaf = referrer.depth === sub.height - 1;
			const account = await retry(() => registerAccount(referrer.sessionId));
			account.referrerId = referrer.id;

			await db.insert(accounts).values(account);
			await db.insert(coupons).values({
				status: isLeaf ? "available" : "template",
				accountId: account.id,
				discount: (isLeaf ? 0 : 2 * REFERRAL_REWARD_AMOUNT).toString(),
				isReferral: true,
				familyId: sub.familyId,
				expiredAt: expiredAt,
			});
			if (isLeaf) {
				todo -= 1;
			}
			const result = iterator.next({
				depth: referrer.depth + 1,
				id: account.id,
				sessionId: account.sessionId,
			});
			if (!result.done) {
				referrer = result.value;
			} else {
				break;
			}
		}
		if (strategy.isEmpty()) {
			await db
				.update(subscriptions)
				.set({ rootId: null })
				.where(eq(subscriptions.familyId, sub.familyId));
		}
	}
}

/**
 * Refreshes account tokens in place and syncs them to the database.
 * This mutates the `Account` object and returns the same reference
 * @param {string} accountId
 * @param {Account} account
 * @returns {Promise<Account>}
 */
async function refreshAccount(accountId, account) {
	if (account.isAccessTokenExpired()) {
		const { tokens } = await refreshToken(account);
		account.accessToken = tokens.accessToken.value;
		account.refreshToken = tokens.refreshToken.value;
		await db
			.update(accounts)
			.set({
				accessToken: account.accessToken,
				refreshToken: account.refreshToken,
			})
			.where(eq(accounts.id, accountId));
	}
	return account;
}

/**
 * Fetches receipts with all product info starting from `startDate`
 * @param {Account} account
 * @param {string} couponId
 * @param {Date} startDate
 */
async function getReceiptsWithProducts(account, couponId, startDate) {
	/** @type {Map<string, typeof receipts.$inferInsert>} */
	const _receipts = new Map();
	/** @type {typeof receiptProducts.$inferInsert[]} */
	const _products = [];

	const { sumBalance } = await getLastChequeHeadersFast(account);

	const identities = [];
	for (const month of sumBalance) {
		for (const header of month.headers) {
			const createdAt = new Date(header.created);
			if (createdAt < startDate) {
				continue;
			}
			identities.push({
				created: header.created,
				filId: header.filId,
				loyaltyFactId: header.loyaltyFactId,
			});
			_receipts.set(header.created, {
				couponId: couponId,
				filialId: header.filId,
				receiptId: header.chequeId,
				fiscalNumber: header.fiscalNumber,
				fiscalString: header.identificationString,
				discount: "",
				total: header.sumReg.toString(),
				createdAt: createdAt,
			});
		}
	}

	if (!identities.length) {
		return { receipts: [], products: [] };
	}

	const { chequesInfos } = await getChequesInfos(account, identities);

	for (const cheque of chequesInfos) {
		const receipt = _receipts.get(cheque.created);
		if (receipt === undefined) {
			throw Error("cannot find cheque");
		}
		receipt.discount = cheque.sumDiscount.toString();

		for (const product of cheque.chequeLines) {
			_products.push({
				filialId: cheque.filId,
				receiptId: cheque.chequeId,
				productId: product.lagerId,
				name: product.lagerNameUA,
				unit: product.lagerUnit,
				quantity: product.kolvo.toString(),
				price: product.priceOut.toString(),
				value: product.sumLine.toString(),
			});
		}
	}

	return { receipts: Array.from(_receipts.values()), products: _products };
}

/**
 * @param {string} [referrerGuid]
 * @returns {Promise<typeof accounts.$inferInsert>}
 */
async function registerAccount(referrerGuid) {
	const phone = await getPhoneNumber(SMSHUB_APIKEY, "fora", "ukraine");

	const deviceId = Math.floor(Math.random() * cached_devices.length) + 1;
	const account = new Account("", "", cached_devices[deviceId - 1]);

	const guid = crypto.randomUUID();

	const { otpSend } = await sendOTP(account, guid, phone);

	// TODO: handle captcha request
	// let pageurl = "https://www.google.com/recaptcha/api/siteverify";
	// let sitekey = "6LcafqkUAAAAAFNr8fr2G-3BCsTeVBNa0zeB_xSf";
	if (!otpSend) {
		throw new Error("Can't send OTP: CAPTCHA");
	}

	// TODO: add interval and timeout
	const otpCode = await phone.getCode();

	const { tokens } = await confirmationOtp(account, guid, phone, otpCode);
	account.accessToken = tokens.accessToken.value;
	account.refreshToken = tokens.refreshToken.value;

	const { registered } = await checkUser(account);
	if (registered) {
		throw new RetryError("Already registered");
	}

	const { isUserReferralUse } = await getAppConfigurations(account, Platfrom.ANDROID);
	if (!isUserReferralUse) {
		throw new Error("Referral program disabled");
	}

	let data;
	if (referrerGuid) {
		data = await registerUserReferral(account, guid, phone, referrerGuid);
	} else {
		data = await registerUser(account);
	}
	const { register, barcode } = data;

	if (!register) {
		throw new RetryError("Couldn't register");
	}

	await setBonusToApply(account, guid, phone);

	return {
		id: barcode,
		accessToken: account.accessToken,
		refreshToken: account.refreshToken,
		deviceId: deviceId,
		phone: phone.toDatabaseString(),
		sessionId: guid,
	};
}

/**
 * Returns the next day of a date
 * @param {Date} date
 * @returns {Date}
 */
function getDateAterTomorrow(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 2);
}

/**
 * Returns the expiration date of the bonus
 * @param {Date} date
 * @returns {Date}
 */
function getNext3Month(date) {
	const expiredOnMoth = date.getMonth() + 3;
	const expiredOn = new Date(date.getFullYear(), expiredOnMoth, date.getDate());
	while (expiredOnMoth < expiredOn.getMonth()) {
		expiredOn.setDate(expiredOn.getDate() - 1);
	}
	return expiredOn;
}
/**
 * Returns the expiration date of the referral coupons
 * @param {Date} date
 * @returns {Date}
 */
function getNext60Days(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 60);
}

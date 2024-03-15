import { SMSHUB_APIKEY } from "$env/static/private";
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
	REFERRAL_MINIMUM_SPEND,
	REFERRAL_REWARD_AMOUNT,
	checkUser,
	confirmationOtp,
	getChequesInfos,
	getLastChequeHeadersFast,
	getPersonalInfo,
	refreshToken,
	registerUser,
	registerUserReferral,
	sendOTP,
	setBonusToApply,
} from "$lib/server/fora";
import { getPhoneNumber } from "$lib/server/smshub";
import { and, count, eq, gt, gte, lt, not, or, sql } from "drizzle-orm";

export async function maintenance() {
	await syncCouponInfos();
	await createNewCoupons();
}

export async function syncCouponInfos() {
	const awaitingReceipts = await db
		.select({
			coupon: {
				id: coupons.id,
				status: coupons.status,
				familyId: coupons.familyId,
				totalDiscount: coupons.discount,
				isReferral: coupons.isReferral,
				createdAt: coupons.createdAt,
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
		.where(eq(coupons.status, "awaiting_receipt"));

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

		// Check if the referral reward is triggered
		const rewardReceipts = data.receipts.filter(
			(r) => parseFloat(r.total) + parseFloat(r.discount) >= REFERRAL_MINIMUM_SPEND,
		);
		if (coupon.isReferral && rewardReceipts.length) {
			const accuredOn = getNextDate(
				rewardReceipts.reduce((min, r) => (min.createdAt < r.createdAt ? min : r)).createdAt,
			);
			const expiredOn = getNext3Month(accuredOn);
			_bonuses.push({
				accountId: account.id,
				accuredOn: accuredOn.toISOString(),
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
		}

		// Update coupon status
		let status = coupon.status;
		const usedDiscount = data.receipts.reduce((sum, r) => sum + parseFloat(r.discount), 0);
		if (coupon.isReferral && rewardReceipts.length) {
			status = "applied";
		} else if (!coupon.isReferral && usedDiscount > 0.8 * parseFloat(coupon.totalDiscount)) {
			status = "applied";
		} else {
			status = "assigned";
		}
		await db.update(coupons).set({ status }).where(eq(coupons.id, coupon.id));
	}

	if (_receipts.length && _receiptProducts.length) {
		await db.insert(receipts).values(_receipts).onConflictDoNothing();
		await db.insert(receiptProducts).values(_receiptProducts).onConflictDoNothing();
	}
	if (_bonuses.length && _coupons.length) {
		await db.insert(bonuses).values(_bonuses).onConflictDoNothing();
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

	console.log(subs);

	for (const sub of subs) {
		if (sub.rootId === null) {
			const empty = await registerAccount();
			const root = await registerAccount(empty.sessionId);
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
			await db.update(subscriptions).set({ rootId: root.id });
		}

		const data = await db.execute(sql`
		with recursive parents as (
			select 0 as depth, id, session_id
			from fora.accounts
			where fora.accounts.id = ${sub.rootId}

			union all

			select depth + 1, fora.accounts.id, fora.accounts.session_id
			from parents join fora.accounts on parents.id = fora.accounts.referrer_id
			where depth < ${sub.height}
		) select * from parents order by parents.id;`);

		if (data.rowCount === 0) {
			throw new Error("Couldn't find the root account");
		}

		const dfs = /** @type {{depth: number; id: string; session_id: string}[]} */ (data.rows);

		const maxIndex = 2 ** (sub.height + 1) - 2;
		let index = data.rowCount - 1;
		let todo = sub.surplus - sub.count;

		while (index < maxIndex && todo > 0) {
			const referrer = dfs[index - bubbleStep(sub.height, index)];
			const isLeaf = referrer.depth === sub.height - 1;
			const account = await registerAccount(referrer.session_id);
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
			dfs.push({ depth: referrer.depth + 1, id: account.id, session_id: account.sessionId });

			index += 1;
			if (isLeaf) {
				todo -= 1;
			}
		}
		if (index === maxIndex) {
			await db.update(subscriptions).set({ rootId: null });
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

	if (!identities) {
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

	const { otpSend } = await sendOTP(account, guid, `+${phone.number}`);

	// TODO: handle captcha request
	// let pageurl = "https://www.google.com/recaptcha/api/siteverify";
	// let sitekey = "6LcafqkUAAAAAFNr8fr2G-3BCsTeVBNa0zeB_xSf";
	if (!otpSend) {
		throw new Error("Can't send OTP: CAPTCHA");
	}

	// TODO: add interval and timeout
	const otpCode = await phone.getCode();

	const { tokens } = await confirmationOtp(account, guid, `+${phone.number}`, otpCode);
	account.accessToken = tokens.accessToken.value;
	account.refreshToken = tokens.refreshToken.value;

	console.log("OTP", {
		accessToken: account.accessToken,
		refreshToken: account.refreshToken,
		deviceId: deviceId,
		phone: phone.number,
		sessionId: guid,
	});

	const { registered } = await checkUser(account);

	// TODO: gracefull exit or smth? maybe report this
	if (registered) {
		throw new Error(`Already registered`);
	}

	let data;
	if (referrerGuid) {
		data = await registerUserReferral(account, guid, `+${phone.number}`, referrerGuid);
	} else {
		data = await registerUser(account);
	}
	const { register, barcode } = data;

	console.log("BARCODE", barcode);

	// TODO: gracefull exit or smth? maybe report this
	if (!register) {
		throw new Error(`Couldn't register`);
	}

	await setBonusToApply(account, guid, `+${phone.number}`);

	return {
		id: barcode,
		accessToken: account.accessToken,
		refreshToken: account.refreshToken,
		deviceId: deviceId,
		phone: phone.number,
		sessionId: guid,
	};
}

/**
 * Returns the next day of a date
 * @param {Date} date
 * @returns {Date}
 */
function getNextDate(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
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

/**
 * for binary tree in pre-order array representation
 * @param {number} depth
 * @param {number} index
 * @returns {number}
 */
function bubbleStep(depth, index) {
	const new_index = index % (2 ** depth - 1);
	if (new_index === 0) return index;
	return bubbleStep(depth - 1, new_index - 1);
}

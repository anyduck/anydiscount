import {
	accounts,
	activeBonuses,
	bonuses,
	coupons,
	receiptProducts,
	receipts,
	referrBonuses,
} from "$lib/schema/fora";
import { devices } from "$lib/schema/public";
import { db } from "$lib/server/db";
import {
	Account,
	REFERRAL_MINIMUM_SPEND,
	REFERRAL_REWARD_AMOUNT,
	getChequesInfos,
	getLastChequeHeadersFast,
	getPersonalInfo,
	refreshToken,
} from "$lib/server/fora";
import { and, eq, gte, not, or } from "drizzle-orm";

export async function maintenance() {
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
			const expiredOn = getExpireOn(accuredOn);
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
 * Returns the next day of a date
 * @param {Date} date
 * @returns {Date}
 */
function getNextDate(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/**
 * Returns the expiration date of the bonus
 * @param {Date} accuredOn
 * @returns {Date}
 */
function getExpireOn(accuredOn) {
	const expiredOnMoth = accuredOn.getMonth() + 3;
	const expiredOn = new Date(accuredOn.getFullYear(), expiredOnMoth, accuredOn.getDate());
	while (expiredOnMoth < expiredOn.getMonth()) {
		expiredOn.setDate(expiredOn.getDate() - 1);
	}
	return expiredOn;
}

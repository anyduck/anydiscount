import { accounts, coupons } from "$lib/schema/fora";
import { devices } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { Account, getPersonalInfo, refreshToken } from "$lib/server/fora";
import { error } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, params }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
	}
	const data = await fetchCouponWithAccount(params.id);
	if (!data || data.coupon.userId !== locals.userId) {
		error(404, "Not Found");
	}
	const account = new Account(data.accessToken, data.refreshToken, data.device);
	return {
		coupon: data.coupon,
		streamed: {
			balance: getBalance(data.coupon.accountId, account),
		},
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	mark: async ({ locals, params }) => {
		if (!locals.userId) {
			error(401, "Unauthorized");
		}

		const data = await db
			.update(coupons)
			.set({ status: "hidden" })
			.where(and(eq(coupons.id, params.id), eq(coupons.status, "assigned")))
			.returning({ id: coupons.id });

		return { success: Boolean(data) };
	},
};

/**
 * Fetches the coupon with all the data for making Fora App API requests
 * @param {string} couponId
 */
async function fetchCouponWithAccount(couponId) {
	const data = await db
		.select({
			coupon: coupons,
			accessToken: accounts.accessToken,
			refreshToken: accounts.refreshToken,
			device: devices,
		})
		.from(coupons)
		.innerJoin(accounts, eq(accounts.id, coupons.accountId))
		.innerJoin(devices, eq(devices.id, accounts.deviceId))
		.where(and(eq(coupons.id, couponId), inArray(coupons.status, ["assigned", "hidden"])))
		.limit(1);
	return data.length ? data[0] : undefined;
}

/**
 * Gets an account balace from the Fora App API
 * @param {string} accountId
 * @param {Account} account
 */
async function getBalance(accountId, account) {
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
	const { personalInfo } = await getPersonalInfo(account, true);
	return personalInfo.Bonus.bonusBalanceAmount;
}

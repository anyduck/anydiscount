import { accounts, coupons } from "$lib/schema/fora";
import { devices } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { Account, getPersonalInfo, getQRKeys, refreshToken } from "$lib/server/fora";
import { error, json } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, params }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
	}
	const [data] = await db
		.select({
			coupon: coupons,
			accessToken: accounts.accessToken,
			refreshToken: accounts.refreshToken,
			device: devices,
		})
		.from(coupons)
		.innerJoin(accounts, eq(accounts.id, coupons.accountId))
		.innerJoin(devices, eq(devices.id, accounts.deviceId))
		.where(
			and(
				eq(coupons.id, params.id),
				eq(coupons.userId, locals.userId),
				inArray(coupons.status, ["assigned", "hidden"]),
			),
		);
	if (!data) {
		error(404, "Not Found");
	}

	const account = await refreshAccount(
		data.coupon.accountId,
		new Account(data.accessToken, data.refreshToken, data.device),
	);

	const [{ keys }, { personalInfo }] = await Promise.all([
		getQRKeys(account),
		getPersonalInfo(account, true),
	]);

	return json({ coupon: data.coupon, keys, personalInfo });
}

/**
 * @typedef {Object} Data
 * @property {Omit<typeof import("$lib/schema/fora").coupons.$inferSelect, never>} coupon
 * @property {Awaited<ReturnType<import("$lib/server/fora").getQRKeys>>["keys"]} keys
 * @property {Awaited<ReturnType<import("$lib/server/fora").getPersonalInfo>>["personalInfo"]} personalInfo
 */

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

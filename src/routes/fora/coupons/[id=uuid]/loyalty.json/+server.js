import { accounts, coupons } from "$lib/schema/fora";
import { db } from "$lib/server/db";
import { error, json } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";

/**
 * @typedef {Object} Response
 * @property {Omit<typeof import("$lib/schema/fora").coupons.$inferSelect, never>} coupon
 * @property {Pick<typeof import("$lib/schema/fora").accounts.$inferSelect, "sessionId" | "phone">} account
 */

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, params }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
	}
	const [data] = await db
		.select({
			coupon: coupons,
			account: {
				sessionId: accounts.sessionId,
				phone: accounts.phone,
			},
		})
		.from(coupons)
		.innerJoin(accounts, eq(accounts.id, coupons.accountId))
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

	return json({ coupon: data.coupon, account: data.account });
}

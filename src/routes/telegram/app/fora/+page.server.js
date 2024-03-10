import { coupons } from "$lib/schema/fora";
import { users } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { error, redirect } from "@sveltejs/kit";
import { and, count, eq, gt, isNull, or, sql } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
	}
	return {
		counts: await countAvailableCoupons(locals.userId),
		streamed: {
			coupons: fetchViewableCoupons(locals.userId),
		},
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ locals, url }) => {
		if (!locals.userId) {
			error(401, "Unauthorized");
		}

		const requiredSpend = url.searchParams.get("required_spend");
		if (requiredSpend === null) {
			error(400, "Missing Required Spend");
		}

		const couponId = await assignCouponByRequiredSpend(locals.userId, requiredSpend);
		if (couponId) {
			redirect(303, `fora/coupon/${couponId}`);
		}
		error(409, "Out Of Coupons");
	},
};

/**
 * Counts all available coupons, that can be assigned to the user
 * @param {string} userId
 * @returns
 */
async function countAvailableCoupons(userId) {
	const is_same_family = or(eq(coupons.familyId, users.familyId), isNull(coupons.familyId));
	const data = await db
		.select({ required: coupons.requiredSpend, count: count() })
		.from(coupons)
		.innerJoin(users, and(eq(users.id, userId), is_same_family))
		.where(and(eq(coupons.status, "available"), gt(coupons.expiredAt, sql`now()`)))
		.groupBy(coupons.requiredSpend);
	return {
		required_nothing: data.find((e) => e.required === "0.00")?.count ?? 0,
		required_hundred: data.find((e) => e.required === "100.00")?.count ?? 0,
	};
}

/**
 * Fetches all coupons that users can view
 * @param {string} userId
 * @returns
 */
async function fetchViewableCoupons(userId) {
	const is_viewable = or(eq(coupons.status, "assigned"), eq(coupons.status, "awaiting_receipt"));
	return await db
		.select({
			id: coupons.id,
			status: coupons.status,
			totalDiscount: coupons.totalDiscount,
			requiredSpend: coupons.requiredSpend,
			expiredAt: coupons.expiredAt,
		})
		.from(coupons)
		.where(and(eq(coupons.userId, userId), is_viewable, gt(coupons.expiredAt, sql`now()`)));
}

/**
 * Assigns a new coupon to the user with the specified required spend
 * @param {string} userId
 * @param {string} requiredSpend
 * @returns {Promise<string | undefined>}
 */
async function assignCouponByRequiredSpend(userId, requiredSpend) {
	const is_available = and(
		eq(coupons.status, "available"),
		isNull(coupons.userId),
		gt(coupons.expiredAt, sql`now()`),
	);
	const select_coupon = db
		.select({ id: coupons.id })
		.from(coupons)
		.where(and(is_available, eq(coupons.requiredSpend, requiredSpend)))
		.limit(1)
		.for("update", { skipLocked: true });
	const data = await db
		.update(coupons)
		.set({ status: "assigned", userId: userId })
		.where(eq(coupons.id, select_coupon))
		.returning({ id: coupons.id });
	return data.length ? data[0].id : undefined;
}

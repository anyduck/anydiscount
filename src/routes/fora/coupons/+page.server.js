import { coupons } from "$lib/schema/fora";
import { users } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { REFERRAL_MINIMUM_SPEND } from "$lib/server/fora";
import { error, redirect } from "@sveltejs/kit";
import { and, count, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
	}
	return {
		minimumSpend: REFERRAL_MINIMUM_SPEND,
		coupons: await fetchAvailableCoupons(locals.userId),
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

		const isReferral = url.searchParams.get("is_referral") === "true";
		if (isReferral === null) {
			error(400, "Missing Is Referral");
		}

		const couponId = await assignCouponByIsReferral(locals.userId, isReferral);
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
async function fetchAvailableCoupons(userId) {
	const is_same_family = or(eq(coupons.familyId, users.familyId), isNull(coupons.familyId));
	const data = await db
		.select({ isReferral: coupons.isReferral, count: count() })
		.from(coupons)
		.innerJoin(users, and(eq(users.id, userId), is_same_family))
		.where(and(eq(coupons.status, "available"), gt(coupons.expiredAt, sql`now()`)))
		.groupBy(coupons.isReferral);

	return [
		{
			discount: "50+",
			isReferral: false,
			count: data.find((e) => !e.isReferral)?.count ?? 0,
		},
		{
			discount: "0 або 100",
			isReferral: true,
			count: data.find((e) => e.isReferral)?.count ?? 0,
		},
	];
}

/**
 * Fetches all coupons that the user can view
 * @param {string} userId
 * @returns
 */
async function fetchViewableCoupons(userId) {
	return await db
		.select({
			id: coupons.id,
			status: coupons.status,
			discount: coupons.discount,
			isReferral: coupons.isReferral,
			expiredAt: coupons.expiredAt,
		})
		.from(coupons)
		.where(
			and(
				eq(coupons.userId, userId),
				inArray(coupons.status, ["assigned", "hidden"]),
				gt(coupons.expiredAt, sql`now()`),
			),
		);
}

/**
 * Assigns a new coupon to the user with the specified `isReferral`
 * @param {string} userId
 * @param {boolean} isReferral
 * @returns {Promise<string | undefined>}
 */
async function assignCouponByIsReferral(userId, isReferral) {
	const is_available = and(eq(coupons.status, "available"), gt(coupons.expiredAt, sql`now()`));
	const is_same_family = or(eq(coupons.familyId, users.familyId), isNull(coupons.familyId));
	const select_coupon = db
		.select({ id: coupons.id })
		.from(coupons)
		.innerJoin(users, eq(users.id, userId))
		.where(and(is_available, is_same_family, eq(coupons.isReferral, isReferral)))
		.limit(1)
		.for("update", { skipLocked: true });
	const data = await db
		.update(coupons)
		.set({ status: "assigned", userId: userId })
		.where(eq(coupons.id, select_coupon))
		.returning({ id: coupons.id });
	return data.length ? data[0].id : undefined;
}

import { coupons } from "$lib/schema/fora";
import { users } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { REFERRAL_MINIMUM_SPEND } from "$lib/server/fora";
import { redirect } from "@sveltejs/kit";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.userId) {
		redirect(302, "/auth");
	}

	const available = await db
		.select({
			id: coupons.id,
			discount: coupons.discount,
			expiredAt: coupons.expiredAt,
			isReferral: coupons.isReferral,
		})
		.from(coupons)
		.innerJoin(
			users,
			and(
				eq(users.id, locals.userId),
				or(eq(coupons.familyId, users.familyId), isNull(coupons.familyId)),
			),
		)
		.where(and(eq(coupons.status, "available"), gt(coupons.expiredAt, sql`now()`)))
		.orderBy(coupons.expiredAt);

	return {
		REFERRAL_MINIMUM_SPEND,
		coupons: available,
	};
}

import { coupons } from "$lib/schema/fora";
import { users } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { REFERRAL_MINIMUM_SPEND } from "$lib/server/fora";
import { error } from "@sveltejs/kit";
import { and, eq, gte, isNull, or, sql } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
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
		.where(and(eq(coupons.status, "available"), gte(coupons.expiredAt, sql`CURRENT_DATE`)))
		.orderBy(coupons.expiredAt);

	return {
		REFERRAL_MINIMUM_SPEND,
		coupons: available,
	};
}

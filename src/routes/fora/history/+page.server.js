import { coupons } from "$lib/schema/fora";
import { db } from "$lib/server/db";
import { REFERRAL_MINIMUM_SPEND } from "$lib/server/fora";
import { error } from "@sveltejs/kit";
import { desc, eq } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
	}

	const data = await db
		.select({
			id: coupons.id,
			status: coupons.status,
			discount: coupons.discount,
			isReferral: coupons.isReferral,
			expiredAt: coupons.expiredAt,
		})
		.from(coupons)
		.where(eq(coupons.userId, locals.userId))
		.orderBy(desc(coupons.assignedAt))
		.limit(100);

	return {
		REFERRAL_MINIMUM_SPEND,
		coupons: data,
	};
}

import { coupons } from "$lib/schema/fora";
import { db } from "$lib/server/db";
import { error } from "@sveltejs/kit";
import { and, eq, or } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
	}
	const userCoupons = db
		.select({
			id: coupons.id,
			status: coupons.status,
			totalDiscount: coupons.totalDiscount,
			requiredSpend: coupons.requiredSpend,
			expiredAt: coupons.expiredAt,
		})
		.from(coupons)
		.where(
			and(
				eq(coupons.userId, locals.userId),
				or(eq(coupons.status, "assigned"), eq(coupons.status, "awaiting_receipt")),
			),
		);

	return {
		streamed: {
			coupons: userCoupons,
		},
	};
}

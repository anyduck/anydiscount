import { coupons } from "$lib/schema/fora";
import { db } from "$lib/server/db";
import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, params }) {
	if (!locals.userId) {
		error(401, "Unauthorized");
	}
	const [data] = await db
		.select({ coupon: coupons })
		.from(coupons)
		.where(eq(coupons.id, params.id))
		.limit(1);
	if (!data || !["assigned", "awaiting_receipt"].includes(data.coupon.status)) {
		error(404, "Not Found");
	}
	if (data.coupon.userId !== locals.userId) {
		error(403, "Forbidden");
	}
	return {
		coupon: data.coupon,
	};
}

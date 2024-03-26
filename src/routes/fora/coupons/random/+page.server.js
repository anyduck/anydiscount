import { coupons } from "$lib/schema/fora";
import { users } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { error, redirect } from "@sveltejs/kit";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ locals }) => {
		if (!locals.userId) {
			error(401, "Unauthorized");
		}

		const select_coupon = db
			.select({ id: coupons.id })
			.from(coupons)
			.innerJoin(users, eq(users.id, locals.userId))
			.where(
				and(
					and(eq(coupons.status, "available"), gt(coupons.expiredAt, sql`now()`)),
					or(eq(coupons.familyId, users.familyId), isNull(coupons.familyId)),
				),
			)
			.orderBy(coupons.expiredAt)
			.limit(1)
			.for("update", { skipLocked: true });

		const [coupon] = await db
			.update(coupons)
			.set({ status: "assigned", userId: locals.userId, assignedAt: sql`now()` })
			.where(eq(coupons.id, select_coupon))
			.returning({ id: coupons.id });

		if (coupon) {
			redirect(303, `/fora/coupons/${coupon.id}`);
		}
		error(409, "Out Of Coupons");
	},
};

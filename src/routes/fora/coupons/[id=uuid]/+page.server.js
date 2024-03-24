import { coupons } from "$lib/schema/fora";
import { users } from "$lib/schema/public";
import { db } from "$lib/server/db";
import { error, redirect } from "@sveltejs/kit";
import { and, eq, isNull, or } from "drizzle-orm";

/** @type {import('./$types').Actions} */
export const actions = {
	assign: async ({ locals, params, url }) => {
		if (!locals.userId) {
			error(401, "Unauthorized");
		}

		const isAvailable = and(
			eq(coupons.status, "available"),
			or(
				isNull(coupons.familyId),
				eq(
					coupons.familyId,
					db.select({ familyId: users.familyId }).from(users).where(eq(users.id, locals.userId)),
				),
			),
		);

		const [coupon] = await db
			.update(coupons)
			.set({ status: "assigned", userId: locals.userId })
			.where(and(eq(coupons.id, params.id), isAvailable))
			.returning({ id: coupons.id });

		if (coupon) {
			redirect(303, url.pathname);
		} else {
			error(409, "Not Available");
		}
	},
};

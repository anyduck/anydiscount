import { and, gt, lte, sql } from "drizzle-orm";
import {
	customType,
	date,
	integer,
	numeric,
	pgEnum,
	pgSchema,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { devices, families, users } from "./public";

const ean13 = /** @type {typeof customType<{data: string}>} */ (customType)({
	dataType() {
		return "ean13";
	},
});

export const foraSchema = pgSchema("fora");

/* prettier-ignore */
export const accounts = foraSchema.table("accounts", {
	id: ean13("id").primaryKey(),
	sessionId: uuid("session_id").notNull().unique(),
	phone: text("phone").notNull().unique(), // TODO: constrain length to 12

	deviceId: integer("device_id").notNull().references(() => devices.id),
	referrerId: ean13("referrer_id").references(
		/** @return {import("drizzle-orm/pg-core").AnyPgColumn} */ () => accounts.id,
	),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token").notNull(),

	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const couponStatus = pgEnum('fora"."coupon_status', [
	"template",
	"available",
	"assigned",
	"reported",
	"awaiting_refund",
	"refunded",
	"awaiting_receipt",
	"applied",
]);

/* prettier-ignore */
export const coupons = foraSchema.table("coupons", {
	id: uuid("id").primaryKey(),

	status: couponStatus("status").notNull(),
	familyId: uuid("family_id").references(() => families.id),
	userId: uuid("user_id").references(() => users.id),

	accountId: ean13("account_id").notNull().references(() => accounts.id),
	totalDiscount: numeric("total_discount", { precision: 9, scale: 2 }).notNull(),
	requiredSpend: numeric("required_spend", { precision: 9, scale: 2 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	expiredAt: timestamp("expired_at", { withTimezone: true }).notNull(),
});

/* prettier-ignore */
export const bonuses = foraSchema.table("bonuses", {
	accountId: ean13("account_id").notNull().references(() => accounts.id),
	initialAmount: numeric("initial_amount", { precision: 9, scale: 2 }).notNull(),
	appliedAmount: numeric("applied_amount", { precision: 9, scale: 2 }).notNull().default("0"),
	accuredOn: date("accured_on").notNull(),
	expiredOn: date("expired_on").notNull(),
}, (table) => {
	return {
		pk: primaryKey({ columns: [table.accountId, table.accuredOn] }),
	};
});

/* prettier-ignore */
export const availableBonuses = foraSchema.view("available_bonuses").as((qb) => qb
	.select({
		accountId: bonuses.accountId,
		availableAmount: sql`sum(${bonuses.initialAmount} - ${bonuses.appliedAmount})`
			.mapWith(String)
			.as("available_amount"),
	})
	.from(bonuses)
	.where(and(lte(bonuses.accuredOn, "now()"), gt(bonuses.expiredOn, "now()")))
	.groupBy(bonuses.accountId),
);

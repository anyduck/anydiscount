import { and, eq, gt, lte, sql, sum } from "drizzle-orm";
import {
	customType,
	date,
	foreignKey,
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
	id: uuid("id").primaryKey().default(sql`uuid_generate_v7()`),

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
	accountId: ean13("account_id").primaryKey().references(() => accounts.id),
	amount: numeric("amount", { precision: 9, scale: 2 }).notNull(),
	accuredOn: date("accured_on").notNull(),
	expiredOn: date("expired_on").notNull(),
});

/* prettier-ignore */
export const activeBonuses = foraSchema.view("active_bonuses").as((qb) => qb
	.select({ accountId: bonuses.accountId, amount: bonuses.amount })
	.from(bonuses)
	.where(and(lte(bonuses.accuredOn, "now()"), gt(bonuses.expiredOn, "now()")))
);

/* prettier-ignore */
export const referrBonuses = foraSchema.view("referr_bonuses").as((qb) => qb
	.select({
		accountId: sql`${accounts.referrerId}`.as('referr_bonuses"."account_id'),
		amount: sum(bonuses.amount).as('referr_bonuses"."amount'),
	})
	.from(activeBonuses)
	.innerJoin(accounts, eq(accounts.id, bonuses.accountId))
	.groupBy(accounts.referrerId),
);

/* prettier-ignore */
export const receipts = foraSchema.table("receipts", {
	couponId: uuid("coupon_id").notNull().references(() => coupons.id),

	filialId: integer("filial_id").notNull(),
	receiptId: integer("receipt_id").notNull(),
	fiscalString: text("fiscal_string").notNull(),
	fiscalNumber: text("fiscal_number").unique(),

	discount: numeric("discount", { precision: 9, scale: 2 }).notNull(),
	total: numeric("total", { precision: 9, scale: 2 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => {
	return {
		pk: primaryKey({ columns: [table.filialId, table.receiptId] }),
	};
});

/* prettier-ignore */
export const receiptProducts = foraSchema.table("receipt_products", {
	filialId: integer("filial_id").notNull(),
	receiptId: integer("receipt_id").notNull(),

	productId: integer("product_id").notNull(),
	name: text("name").notNull(),
	unit: text("unit").notNull(),

	quantity: numeric("quantity", { precision: 9, scale: 3 }).notNull(),
	price: numeric("price", { precision: 9, scale: 2 }).notNull(),
	value: numeric("value", { precision: 9, scale: 2 }).notNull(),
}, (table) => {
	return {
		pk: primaryKey({ columns: [table.filialId, table.receiptId, table.productId] }),
		receiptReference: foreignKey({
			columns: [table.filialId, table.receiptId],
			foreignColumns: [receipts.filialId, receipts.receiptId],
		}),
	};
});

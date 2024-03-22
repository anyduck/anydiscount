import { inet, pgTable, primaryKey, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	familyId: uuid("family_id").references(() => families.id),
	signupIp: inet("signup_ip").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* prettier-ignore */
export const accounts = pgTable("accounts", {
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	providerId: text("provider_id").notNull(),
	providerUserId: text("provider_user_id").notNull(),
}, (table) => {
	return {
		pk: primaryKey({ columns: [table.providerId, table.providerUserId] }),
	};
});

export const families = pgTable("families", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
});

export const devices = pgTable("devices", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	brand: text("brand").notNull(),
	model: text("model").notNull(),
	fingerprint: text("fingerprint").notNull(),
});

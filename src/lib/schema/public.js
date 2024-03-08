import { bigint, inet, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	telegramId: bigint("telegram_id", { mode: "number" }).unique(),
	familyId: uuid("family_id").references(() => families.id),
	signupIp: inet("signup_ip").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

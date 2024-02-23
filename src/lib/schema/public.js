import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	brand: text("brand").notNull(),
	model: text("model").notNull(),
	fingerprint: text("fingerprint").notNull(),
});

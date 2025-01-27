import "dotenv/config";
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: "./drizzle",
	schema: "./src/lib/schema/*",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.POSTGRES_URL,
	},
});

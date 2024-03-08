import { POSTGRES_URL } from "$env/static/private";
import { createPool } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";

export const db = drizzle(createPool({ connectionString: POSTGRES_URL }));

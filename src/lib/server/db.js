import { POSTGRES_URL } from "$env/static/private";
import { createPool } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";

import * as foraSchema from "$lib/schema/fora";
import * as publicSchema from "$lib/schema/public";

const client = createPool({ connectionString: POSTGRES_URL });
export const db = drizzle(client, { schema: { ...publicSchema, ...foraSchema } });

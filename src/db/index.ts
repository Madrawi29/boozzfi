import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL || "file:./data/b00zz-fi.sqlite";

export const client = createClient({ url: databaseUrl });
export const db = drizzle(client, { schema });
export { schema };

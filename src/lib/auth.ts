import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/src/db";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000",
  secret: process.env.BETTER_AUTH_SECRET || "dev-only-b00zz-fi-change-me-before-production",
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema
  }),
  emailAndPassword: {
    enabled: true
  },
  plugins: [nextCookies()]
});

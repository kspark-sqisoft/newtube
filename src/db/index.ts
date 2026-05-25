import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/env";

//drizzle-orm/neon-http로 Neon DB에 연결
export const db = drizzle(env.DATABASE_URL);

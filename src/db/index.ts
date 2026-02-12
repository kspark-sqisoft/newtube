import { drizzle } from "drizzle-orm/neon-http";

//drizzle-orm/neon-http로 Neon DB에 연결
export const db = drizzle(process.env.DATABASE_URL!);

import { env } from "@/env";

export const THUMBNAIL_FALLBACK = "/placeholder.svg";

//Crucial to modify in .env to production domain (including protocol)
export const APP_URL = env.NEXT_PUBLIC_APP_URL;

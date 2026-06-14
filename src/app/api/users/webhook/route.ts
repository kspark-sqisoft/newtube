import { db } from "@/db";
import { env } from "@/env";
import { users } from "@/db/schema";
import { formatClerkName } from "@/lib/clerk-utils";
import { logger } from "@/lib/logger";
import { WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { Webhook } from "svix";

export async function POST(req: Request) {
  const wh = new Webhook(env.CLERK_SIGNING_SECRET);

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing Svix headers", {
      status: 400,
    });
  }

  // svix 도 송신측 raw bytes 기준이라 req.text() 로 검증해야 false negative 없음.
  const body = await req.text();

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error("Clerk webhook verification failed", err);
    return new Response("Error: Verification error", {
      status: 400,
    });
  }

  const eventType = evt.type;

  if (eventType === "user.created") {
    const { data } = evt;
    await db
      .insert(users)
      .values({
        clerkId: data.id,
        name: formatClerkName(data),
        imageUrl: data.image_url,
      })
      .onConflictDoNothing();
  }

  if (eventType === "user.deleted") {
    const { data } = evt;
    if (!data.id) {
      return new Response("Error: Missing user id", { status: 400 });
    }
    await db.delete(users).where(eq(users.clerkId, data.id));
  }

  if (eventType === "user.updated") {
    const { data } = evt;
    if (!data.id) {
      return new Response("Error: Missing user id", { status: 400 });
    }
    await db
      .update(users)
      .set({
        name: formatClerkName(data),
        imageUrl: data.image_url,
      })
      .where(eq(users.clerkId, data.id));
  }

  return new Response("Webhook received", { status: 200 });
}

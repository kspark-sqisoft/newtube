import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { videos } from "@/db/schema";
import { mux } from "@/lib/mux";
import {
  VideoAssetCreatedWebhookEvent,
  VideoAssetDeletedWebhookEvent,
  VideoAssetErroredWebhookEvent,
  VideoAssetReadyWebhookEvent,
  VideoAssetTrackReadyWebhookEvent,
} from "@mux/mux-node/resources/webhooks";
import { NextRequest } from "next/server";

const SIGNING_SECRET = process.env.MUX_WEBHOOK_SECRET!;

type WebHookEvent =
  | VideoAssetCreatedWebhookEvent
  | VideoAssetErroredWebhookEvent
  | VideoAssetReadyWebhookEvent
  | VideoAssetTrackReadyWebhookEvent
  | VideoAssetDeletedWebhookEvent;

export const POST = async (request: NextRequest) => {
  try {
    if (!SIGNING_SECRET) {
      console.error("MUX_WEBHOOK_SECRET is not set");
      return new Response("MUX_WEBHOOK_SECRET is not set", { status: 500 });
    }

    const headersPayload = await headers();
    const muxSignature = headersPayload.get("mux-signature");

    if (!muxSignature) {
      console.error("Mux signature is not set");
      return new Response("Mux signature is not set", { status: 400 });
    }

    const payload = await request.json();
    const body = JSON.stringify(payload);

    mux.webhooks.verifySignature(
      body,
      {
        "mux-signature": muxSignature,
      },
      SIGNING_SECRET
    );

    console.log("Webhook received:", payload.type);

    switch (payload.type as WebHookEvent["type"]) {
      case "video.asset.created": {
        const data = payload.data as VideoAssetCreatedWebhookEvent["data"];
        if (!data.upload_id) {
          return new Response("Upload ID is not set", { status: 400 });
        }
        await db
          .update(videos)
          .set({
            muxAssetId: data.id,
            muxStatus: data.status,
            updatedAt: new Date(),
          })
          .where(eq(videos.muxUploadId, data.upload_id));

        console.log("✅ Video asset created:", data.id);
        break;
      }

      default: {
        console.log("ℹ️  Unhandled webhook type", payload.type);
        break;
      }
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    console.error("Unhandled webhook error", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

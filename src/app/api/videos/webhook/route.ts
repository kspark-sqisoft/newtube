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

      case "video.asset.ready": {
        const data = payload.data as VideoAssetReadyWebhookEvent["data"];
        const playbackId = data.playback_ids?.[0].id;
        if (!data.upload_id) {
          return new Response("Missing upload ID", { status: 400 });
        }
        if (!playbackId) {
          return new Response("Missing playback ID", { status: 400 });
        }
        const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
        const previewUrl = `https://image.mux.com/${playbackId}/animated.gif`;
        const duration = data.duration ? Math.round(data.duration * 1000):0;

        await db
          .update(videos)
          .set({
            muxPlaybackId: playbackId,
            muxStatus: data.status,
            thumbnailUrl,
            previewUrl,
            duration
          })
          .where(eq(videos.muxUploadId, data.upload_id));
          console.log("✅ Video asset ready:", data.id);
        break;
      }

      case "video.asset.errored": {
        const data = payload.data as VideoAssetErroredWebhookEvent["data"];
        if (!data.upload_id) {
          return new Response("Upload ID is not set", { status: 400 });
        }
        await db
          .update(videos)
          .set({
            muxStatus: data.status,
            
          })
          .where(eq(videos.muxUploadId, data.upload_id));

        console.error("❌ Video asset errored:", data.id, data.errors);
        break;
      }

      case "video.asset.deleted": {
        const data = payload.data as VideoAssetDeletedWebhookEvent["data"];
        if (!data.upload_id) {
          return new Response("Upload ID is not set", { status: 400 });
        }
        await db.delete(videos).where(eq(videos.muxUploadId, data.upload_id));
        console.log("🗑️  Video deleted:", data.upload_id);
        break;
      }

      case "video.asset.track.ready": {
        const data = payload.data as VideoAssetTrackReadyWebhookEvent["data"] & {
          asset_id: string;
        };

        console.log("📝 Video asset track ready:", data);

        const assetId = data.asset_id;
        const trackId = data.id;
        const status = data.status;

        if (!assetId) {
          return new Response("Missing asset ID", { status: 400 });
        }
        await db
          .update(videos)
          .set({
            muxTrackId: trackId,
            muxTrackStatus: status,
            
          })
          .where(eq(videos.muxAssetId, assetId));

        console.log("🎵  Track processed", {
          assetId,
          trackId,
          status,
        });

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

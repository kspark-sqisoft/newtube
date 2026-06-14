import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { UTApi } from "uploadthing/server";

import { db } from "@/db";
import { env } from "@/env";
import { videos } from "@/db/schema";
import { mux } from "@/lib/mux";
import { logger } from "@/lib/logger";
import {
  VideoAssetCreatedWebhookEvent,
  VideoAssetDeletedWebhookEvent,
  VideoAssetErroredWebhookEvent,
  VideoAssetReadyWebhookEvent,
  VideoAssetTrackReadyWebhookEvent,
} from "@mux/mux-node/resources/webhooks";
import { NextRequest } from "next/server";

const SIGNING_SECRET = env.MUX_WEBHOOK_SECRET;

type WebHookEvent =
  | VideoAssetCreatedWebhookEvent
  | VideoAssetErroredWebhookEvent
  | VideoAssetReadyWebhookEvent
  | VideoAssetTrackReadyWebhookEvent
  | VideoAssetDeletedWebhookEvent;

export const POST = async (request: NextRequest) => {
  if (!SIGNING_SECRET) {
    logger.error("MUX_WEBHOOK_SECRET is not set");
    return new Response("MUX_WEBHOOK_SECRET is not set", { status: 500 });
  }

  const headersPayload = await headers();
  const muxSignature = headersPayload.get("mux-signature");

  if (!muxSignature) {
    logger.warn("Missing mux-signature header");
    return new Response("Mux signature is not set", { status: 400 });
  }

  // 서명은 송신측 raw bytes 기준이므로 req.text() 로 받아서 parse 와 verify 모두 처리.
  // JSON.parse → stringify 는 키 순서·공백 차이로 false negative 가 날 수 있음.
  const body = await request.text();

  try {
    mux.webhooks.verifySignature(
      body,
      { "mux-signature": muxSignature },
      SIGNING_SECRET,
    );
  } catch (error) {
    logger.warn("Mux webhook signature verification failed", { error: String(error) });
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: { type: string; data: unknown };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    logger.info("Mux webhook received", { type: payload.type });

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

        logger.info("Video asset created", { assetId: data.id });
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
        const tempThumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
        const tempPreviewUrl = `https://image.mux.com/${playbackId}/animated.gif`;
        const duration = data.duration ? Math.round(data.duration * 1000):0;
        const utapi = new UTApi();
        const [uploadedThumbnail, uploadedPreview] = await utapi.uploadFilesFromUrl([
          tempThumbnailUrl,
          tempPreviewUrl,
        ])

        if(!uploadedPreview.data || !uploadedThumbnail.data) {
          return new Response("Failed to upload thumbnail or preview", { status: 500 });
        }

        const {key:thumbnailKey, url:thumbnailUrl} = uploadedThumbnail.data;
        const {key:previewKey, url:previewUrl} = uploadedPreview.data;

        

        await db
          .update(videos)
          .set({
            muxPlaybackId: playbackId,
            muxStatus: data.status,
            muxAssetId: data.id,
            thumbnailUrl,
            thumbnailKey,
            previewUrl,
            previewKey,
            duration
          })
          .where(eq(videos.muxUploadId, data.upload_id));
          logger.info("Video asset ready", { assetId: data.id });
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

        logger.error("Video asset errored", undefined, {
          assetId: data.id,
          errors: data.errors,
        });
        break;
      }

      case "video.asset.deleted": {
        const data = payload.data as VideoAssetDeletedWebhookEvent["data"];
        if (!data.upload_id) {
          return new Response("Upload ID is not set", { status: 400 });
        }
        await db.delete(videos).where(eq(videos.muxUploadId, data.upload_id));
        logger.info("Video deleted", { uploadId: data.upload_id });
        break;
      }

      case "video.asset.track.ready": {
        const data = payload.data as VideoAssetTrackReadyWebhookEvent["data"] & {
          asset_id: string;
        };

        logger.info("Video asset track ready", { data });

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

        logger.info("Track processed", { assetId, trackId, status });

        break;
      }


      default: {
        logger.info("Unhandled mux webhook type", { type: payload.type });
        break;
      }
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    logger.error("Unhandled mux webhook error", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

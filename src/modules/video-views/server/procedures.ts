import { db } from "@/db";
import { canAccessVideo } from "@/lib/video-access";
import { videos, videoViews } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const videoViewsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { videoId } = input;
      const { id: userId } = ctx.user;

      const [video] = await db
        .select({
          id: videos.id,
          visibility: videos.visibility,
          userId: videos.userId,
        })
        .from(videos)
        .where(eq(videos.id, videoId));

      if (
        !video ||
        !canAccessVideo({
          visibility: video.visibility,
          ownerId: video.userId,
          viewerId: userId,
        })
      ) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [createdVideoView] = await db
        .insert(videoViews)
        .values({
          videoId,
          userId,
        })
        .onConflictDoNothing({
          target: [videoViews.userId, videoViews.videoId],
        })
        .returning();

      if (createdVideoView) return createdVideoView;

      const [existingVideoView] = await db
        .select()
        .from(videoViews)
        .where(
          and(eq(videoViews.videoId, videoId), eq(videoViews.userId, userId)),
        );

      return existingVideoView!;
    }),
});

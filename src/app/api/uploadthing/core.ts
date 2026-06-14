import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { UploadThingError, UTApi } from "uploadthing/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, videos } from "@/db/schema";
import { logger } from "@/lib/logger";

const f = createUploadthing();

// 기존 키를 background 로 정리. 새 파일 저장이 완료된 뒤에만 호출해서
// 업로드 실패 시 기존 자산이 영구히 사라지는 사고를 막는다.
const deleteOldKey = (key: string | null | undefined) => {
  if (!key) return;
  const utapi = new UTApi();
  utapi.deleteFiles(key).catch((error) => {
    logger.error("Failed to delete previous upload key", error, { key });
  });
};

export const ourFileRouter = {
  bannerUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const { userId: clerkUserId } = await auth();

      if (!clerkUserId) throw new UploadThingError("Unauthorized");

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkUserId));
      if (!existingUser) throw new UploadThingError("Unauthorized");

      return {
        userId: existingUser.id,
        previousKey: existingUser.bannerKey ?? null,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db
        .update(users)
        .set({
          bannerUrl: file.url,
          bannerKey: file.key,
        })
        .where(eq(users.id, metadata.userId));

      // 새 키가 저장된 이후에만 옛 키 정리
      deleteOldKey(metadata.previousKey);

      return { uploadedBy: metadata.userId };
    }),

  thumbnailUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .input(
      z.object({
        videoId: z.string().uuid(),
      }),
    )
    .middleware(async ({ input }) => {
      const { userId: clerkUserId } = await auth();

      if (!clerkUserId) throw new UploadThingError("Unauthorized");

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkUserId));
      if (!user) throw new UploadThingError("Unauthorized");

      const [existingVideo] = await db
        .select({ thumbnailKey: videos.thumbnailKey })
        .from(videos)
        .where(and(eq(videos.id, input.videoId), eq(videos.userId, user.id)));

      if (!existingVideo) throw new UploadThingError("Video not found");

      return {
        user,
        videoId: input.videoId,
        previousKey: existingVideo.thumbnailKey ?? null,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db
        .update(videos)
        .set({
          thumbnailUrl: file.url,
          thumbnailKey: file.key,
        })
        .where(
          and(
            eq(videos.id, metadata.videoId),
            eq(videos.userId, metadata.user.id),
          ),
        );

      deleteOldKey(metadata.previousKey);

      return { uploadedBy: metadata.user.id };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

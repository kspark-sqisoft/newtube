import { db } from "@/db";
import {
  subscriptions,
  users,
  videoReactions,
  videos,
  videoUpdateSchema,
  videoViews,
} from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { mux } from "@/lib/mux";
import { TRPCError } from "@trpc/server";
import {
  and,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  or,
  lt,
  desc,
} from "drizzle-orm";
import { z } from "zod";
import { UTApi } from "uploadthing/server";
import { workflow } from "@/lib/workflow";

//tRPC 라우터: createTRPCRouter로 비디오용 프로시저들을 하나의 라우터로 묶음
export const videosRouter = createTRPCRouter({
  getManySubscribed: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { id: userId } = ctx.user;
      const { cursor, limit } = input;

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select({
            userId: subscriptions.creatorId,
          })
          .from(subscriptions)
          .where(eq(subscriptions.viewerId, userId)),
      );

      const data = await db
        .with(viewerSubscriptions)
        .select({
          ...getTableColumns(videos),
          user: users,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like"),
            ),
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike"),
            ),
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.userId, users.id),
        )
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? or(
                  lt(videos.updatedAt, cursor.updatedAt),
                  and(
                    eq(videos.updatedAt, cursor.updatedAt),
                    lt(videos.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        //요청한 항목 수보다 항상 한 개 더 조회하여 다음 배치에 추가로 로드할 데이터가 있는지 확인할 수 있게 함
        .limit(limit + 1);

      const hasMore = data.length > limit;
      //Remove the last item if there is more data
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),

  getManyTrending: baseProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            viewCount: z.number(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, limit } = input;

      const viewCountSubquery = db.$count(
        videoViews,
        eq(videoViews.videoId, videos.id),
      );

      const data = await db
        .select({
          ...getTableColumns(videos),
          user: users,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like"),
            ),
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike"),
            ),
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .where(
          and(
            eq(videos.visibility, "public"),

            cursor
              ? or(
                  lt(viewCountSubquery, cursor.viewCount),
                  and(
                    eq(viewCountSubquery, cursor.viewCount),
                    lt(videos.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(viewCountSubquery), desc(videos.id))
        //요청한 항목 수보다 항상 한 개 더 조회하여 다음 배치에 추가로 로드할 데이터가 있는지 확인할 수 있게 함
        .limit(limit + 1);

      const hasMore = data.length > limit;
      //Remove the last item if there is more data
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            viewCount: lastItem.viewCount,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),
  //비디오 목록 조회 (특정 카테고리/유저 필터, 커서 페이징), baseProcedure라서 로그인 없이도 호출 가능합니다.
  //프로시저 정의와 입력 스키마
  getMany: baseProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().nullish(), //특정 카테고리의 비디오 목록 조회
        userId: z.string().uuid().nullish(), //특정 유저의 비디오 목록 조회
        cursor: z
          .object({
            id: z.string().uuid(), //마지막 본 비디오 ID
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    //쿼리 핸들러와 입력 분해
    .query(async ({ input }) => {
      const { cursor, limit, categoryId, userId } = input;

      //어떤 컬럼을 가져오는지
      const data = await db
        .select({
          ...getTableColumns(videos), //videos 테이블의 모든 컬럼(id, title, userId, visibility 등)을 그대로 포함합니다
          user: users, //업로더 정보를 위해 users 테이블을 조인하고, 결과에 user라는 이름으로 한 번에 넣습니다 (나중에 .innerJoin(users, ...)로 조인).
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)), //각 비디오별로 videoViews에서 videoId가 해당 비디오인 행 개수를 세서 viewCount로 반환합니다.
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like"),
            ),
          ), //같은 비디오에 대해 videoReactions에서 type === "like"인 행만 세서 likeCount로 반환합니다.
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike"),
            ),
          ), //같은 비디오에 대해 videoReactions에서 type === "dislike"인 행만 세서 dislikeCount로 반환합니다.
        })
        .from(videos) //기준 테이블 videos에서 데이터를 가져옵니다.
        .innerJoin(users, eq(videos.userId, users.id)) //videos.userId와 users.id가 같은 행만 남깁니다. 업로더가 없는 비디오는 결과에 안 나옵니다.
        .where(
          and(
            eq(videos.visibility, "public"), //공개 비디오만 조회합니다.
            categoryId ? eq(videos.categoryId, categoryId) : undefined, //categoryId가 넘어왔으면 해당 카테고리 비디오만, 없으면 이 조건은 적용 안 함(undefined는 and에서 무시).
            userId ? eq(videos.userId, userId) : undefined, //userId가 넘어왔으면 해당 사용자가 올린 비디오만, 없으면 전체.
            cursor
              ? or(
                  lt(videos.updatedAt, cursor.updatedAt), //수정일이 커서의 updatedAt보다 더 과거인 행만 가져옵니다.
                  and(
                    eq(videos.updatedAt, cursor.updatedAt),
                    lt(videos.id, cursor.id), //수정일은 같고, ID가 커서의 id보다 작은 행 (같은 시각에 여러 개일 때 순서 보장).
                  ),
                )
              : undefined, //커서가 있을 때만 “이 커서보다 이전” 행만 가져오는 조건을 넣습니다.
          ),
        )
        .orderBy(desc(videos.updatedAt), desc(videos.id)) //최신 수정일 순, 같으면 ID 내림차순으로 정렬합니다. 커서 조건과 맞춰서 “다음 페이지”가 일관되게 나옵니다.
        //요청한 항목 수보다 항상 한 개 더 조회하여 다음 배치에 추가로 로드할 데이터가 있는지 확인할 수 있게 함
        .limit(limit + 1);

      const hasMore = data.length > limit; //limit + 1개까지 가져왔으므로, data.length가 limit보다 크면 “다음 페이지가 있다”는 뜻입니다.
      //Remove the last item if there is more data
      const items = hasMore ? data.slice(0, -1) : data; //다음 페이지가 있으면 마지막 한 개는 제거해서 클라이언트에는 정확히 limit개만 넘깁니다. 없으면 그대로 data를 items로 씁니다.
      const lastItem = items[items.length - 1]; //클라이언트에게 줄 마지막 비디오 하나를 잡습니다. 이걸 기준으로 다음 요청의 커서를 만듭니다.
      const nextCursor = hasMore //다음 페이지가 있으면, 그 다음 요청에서 사용할 커서를 lastItem의 id와 updatedAt로 만듭니다. 없으면 null(더 이상 페이지 없음).
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        items, //이번에 반환할 비디오 목록 (최대 limit개)
        nextCursor, //다음 페이지 요청 시 getMany의 cursor 인자로 넘기면 됩니다.
      };
    }),

  getOne: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { clerkUserId } = ctx;
      let userId;
      const [user] = await db
        .select()
        .from(users)
        .where(inArray(users.clerkId, clerkUserId ? [clerkUserId] : []));

      if (user) {
        userId = user.id;
      }

      const viewerReactions = db.$with("viewer_reactions").as(
        db
          .select({
            videoId: videoReactions.videoId,
            type: videoReactions.type,
          })
          .from(videoReactions)
          .where(inArray(videoReactions.userId, userId ? [userId] : [])),
      );

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select()
          .from(subscriptions)
          .where(inArray(subscriptions.viewerId, userId ? [userId] : [])),
      );

      const [existingVideo] = await db
        .with(viewerReactions, viewerSubscriptions)
        .select({
          ...getTableColumns(videos),
          user: {
            ...getTableColumns(users),
            subscriberCount: db.$count(
              subscriptions,
              eq(subscriptions.creatorId, users.id),
            ),
            viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(
              Boolean,
            ),
          },
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like"),
            ),
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike"),
            ),
          ),
          viewerReaction: viewerReactions.type,
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .leftJoin(viewerReactions, eq(viewerReactions.videoId, videos.id))
        .leftJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.creatorId, users.id),
        )
        .where(eq(videos.id, input.id));
      // .groupBy(
      //   videos.id,
      //   users.id,
      //   viewerReactions.type,
      // )

      if (!existingVideo) throw new TRPCError({ code: "NOT_FOUND" });

      return existingVideo;
    }),

  generateTitle: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { workflowRunId } = await workflow.trigger({
        url: `${process.env.UPSTASH_WORKFLOW_URL}/api/videos/workflows/title`,
        body: { userId, videoId: input.id },
      });
      return workflowRunId;
    }),

  generateDescription: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { workflowRunId } = await workflow.trigger({
        url: `${process.env.UPSTASH_WORKFLOW_URL}/api/videos/workflows/description`,
        body: { userId, videoId: input.id },
      });
      return workflowRunId;
    }),

  generateThumbnail: protectedProcedure
    .input(z.object({ id: z.string().uuid(), prompt: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const { workflowRunId } = await workflow.trigger({
        url: `${process.env.UPSTASH_WORKFLOW_URL}/api/videos/workflows/thumbnail`,
        body: { userId, videoId: input.id, prompt: input.prompt },
      });
      return workflowRunId;
    }),

  revalidate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));

      if (!existingVideo) throw new TRPCError({ code: "NOT_FOUND" });

      if (!existingVideo.muxUploadId)
        throw new TRPCError({ code: "BAD_REQUEST" });

      const upload = await mux.video.uploads.retrieve(
        existingVideo.muxUploadId,
      );
      if (!upload || !upload.asset_id)
        throw new TRPCError({ code: "BAD_REQUEST" });

      const asset = await mux.video.assets.retrieve(upload.asset_id);

      if (!asset) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const playbackId = asset.playback_ids?.[0].id;
      const duration = asset.duration ? Math.round(asset.duration * 1000) : 0;

      const [updatedVideo] = await db
        .update(videos)
        .set({
          muxPlaybackId: playbackId,
          muxStatus: asset.status,
          muxAssetId: asset.id,
          duration,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      return updatedVideo;
    }),

  restoreThumbnail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));
      if (!existingVideo) throw new TRPCError({ code: "NOT_FOUND" });

      if (existingVideo.thumbnailKey) {
        const utapi = new UTApi();
        await utapi.deleteFiles(existingVideo.thumbnailKey);
        await db
          .update(videos)
          .set({ thumbnailKey: null, thumbnailUrl: null })
          .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));
      }

      if (!existingVideo.muxPlaybackId)
        throw new TRPCError({ code: "BAD_REQUEST" });

      const utapi = new UTApi();
      const tempThumbnailUrl = `https://image.mux.com/${existingVideo.muxPlaybackId}/thumbnail.jpg`;
      const uploadedThumbnail =
        await utapi.uploadFilesFromUrl(tempThumbnailUrl);
      if (!uploadedThumbnail.data)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { key: thumbnailKey, url: thumbnailUrl } = uploadedThumbnail.data;

      const [updatedVideo] = await db
        .update(videos)
        .set({
          thumbnailUrl,
          thumbnailKey,
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      return updatedVideo;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      // 삭제하기 전에 비디오 정보를 먼저 가져옴
      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Mux asset이 있으면 삭제
      if (existingVideo.muxAssetId) {
        try {
          await mux.video.assets.delete(existingVideo.muxAssetId);
        } catch (error) {
          // Mux asset 삭제 실패해도 로그만 남기고 계속 진행
          console.error("Failed to delete Mux asset:", error);
        }
      }

      // UploadThing에서 업로드된 파일들 삭제
      const utapi = new UTApi();
      const filesToDelete: string[] = [];

      if (existingVideo.thumbnailKey) {
        filesToDelete.push(existingVideo.thumbnailKey);
      }
      if (existingVideo.previewKey) {
        filesToDelete.push(existingVideo.previewKey);
      }

      if (filesToDelete.length > 0) {
        try {
          await utapi.deleteFiles(filesToDelete);
        } catch (error) {
          // 파일 삭제 실패해도 로그만 남기고 계속 진행
          console.error("Failed to delete files from UploadThing:", error);
        }
      }

      // 데이터베이스에서 비디오 삭제
      const [removeVideo] = await db
        .delete(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      return removeVideo;
    }),

  update: protectedProcedure
    .input(videoUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      if (!input.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [updatedVideo] = await db
        .update(videos)
        .set({
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          visibility: input.visibility,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      if (!updatedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updatedVideo;
    }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.user;

    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        passthrough: userId,
        playback_policy: ["public"],
        input: [
          {
            generated_subtitles: [
              {
                language_code: "en",
                name: "English",
              },
            ],
          },
        ],
      },
      cors_origin: "*", //TODO: In production, set to your url
    });

    const [video] = await db
      .insert(videos)
      .values({
        userId,
        title: "Untitled",
        muxStatus: "waiting",
        muxUploadId: upload.id,
      })
      .returning();

    return {
      video: video,
      url: upload.url,
    };
  }),
});

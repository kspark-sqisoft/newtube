import { db } from "@/db";
import {
  commentLikeCountExpr,
  commentDislikeCountExpr,
  commentReactionStats,
} from "@/db/aggregates";
import { commentReactions, comments, users } from "@/db/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import {
  desc,
  and,
  eq,
  getTableColumns,
  lt,
  or,
  count,
  inArray,
  isNull,
  isNotNull,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const commentsRouter = createTRPCRouter({
  remove: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [deletedComment] = await db
        .delete(comments)
        .where(and(eq(comments.id, id), eq(comments.userId, userId)))
        .returning();

      if (!deletedComment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      return deletedComment;
    }),

  create: protectedProcedure
    .input(
      z.object({
        parentId: z.string().uuid().nullish(),
        videoId: z.string().uuid(),
        // 공백만으로 댓글 생성 방지 + 최대 길이 제한 (DoS)
        value: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { parentId, videoId, value } = input;
      const { id: userId } = ctx.user;

      // 답글 검증: 부모 존재 + 부모가 reply 아님 + 부모가 같은 videoId
      if (parentId) {
        const [parent] = await db
          .select({ id: comments.id, parentId: comments.parentId, videoId: comments.videoId })
          .from(comments)
          .where(eq(comments.id, parentId));

        if (!parent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Parent comment not found" });
        }
        if (parent.parentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot reply to a reply" });
        }
        if (parent.videoId !== videoId) {
          // 다른 비디오의 댓글에 답글을 가장한 데이터 변조 방지
          throw new TRPCError({ code: "BAD_REQUEST", message: "Parent comment does not belong to this video" });
        }
      }

      const [createdComment] = await db
        .insert(comments)
        .values({
          videoId,
          userId,
          parentId,
          value,
        })
        .returning();
      return createdComment;
    }),

  getMany: baseProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        parentId: z.string().uuid().nullish(),
        // 커서 키는 정렬 키와 반드시 일치해야 페이지네이션 일관성이 보장됨 (createdAt 기준)
        cursor: z
          .object({
            id: z.string().uuid(),
            createdAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      const { parentId, videoId, cursor, limit } = input;

      const viewerReactions = db.$with("viewer_reactions").as(
        db
          .select({
            commentId: commentReactions.commentId,
            type: commentReactions.type,
          })
          .from(commentReactions)
          .where(inArray(commentReactions.userId, userId ? [userId] : [])),
      );

      const replies = db.$with("replies").as(
        db
          .select({
            parentId: comments.parentId,
            count: count(comments.id).as("count"),
          })
          .from(comments)
          .where(isNotNull(comments.parentId))
          .groupBy(comments.parentId),
      );

      const [totalData, data] = await Promise.all([
        db
          .select({
            count: count(),
          })
          .from(comments)
          .where(
            and(eq(comments.videoId, videoId), isNull(comments.parentId)),
          ),

        db
          .with(viewerReactions, replies)
          .select({
            ...getTableColumns(comments),
            user: users,
            viewerReaction: viewerReactions.type,
            replyCount: replies.count,
            likeCount: commentLikeCountExpr,
            dislikeCount: commentDislikeCountExpr,
          })
          .from(comments)
          .where(
            and(
              eq(comments.videoId, videoId),
              parentId ? eq(comments.parentId, parentId) : isNull(comments.parentId),
              cursor
                ? or(
                    lt(comments.createdAt, cursor.createdAt),
                    and(
                      eq(comments.createdAt, cursor.createdAt),
                      lt(comments.id, cursor.id),
                    ),
                  )
                : undefined,
            ),
          )
          .innerJoin(users, eq(comments.userId, users.id))
          .leftJoin(
            commentReactionStats,
            eq(commentReactionStats.commentId, comments.id),
          )
          .leftJoin(viewerReactions, eq(comments.id, viewerReactions.commentId))
          .leftJoin(replies, eq(comments.id, replies.parentId))
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(limit + 1),
      ]);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            createdAt: lastItem.createdAt,
          }
        : null;

      return {
        totalCount: totalData[0].count,
        items,
        nextCursor,
      };
    }),
});

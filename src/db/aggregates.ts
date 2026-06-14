import { sql } from "drizzle-orm";

import { db } from "@/db";
import {
  commentReactions,
  comments,
  playlistVideos,
  subscriptions,
  videoReactions,
  videos,
  videoViews,
} from "@/db/schema";

/**
 * videos 테이블에 LEFT JOIN해서 영상별 조회수를 한 번에 집계하는 subquery.
 * 기존: db.$count(videoViews, eq(...)) 가 각 row 별로 scalar subquery 를 실행.
 * 개선: 인덱스(video_views_video_id_idx)와 함께 GROUP BY 한 번에 집계.
 */
export const videoViewStats = db
  .select({
    videoId: videoViews.videoId,
    viewCount: sql<number>`COUNT(*)::int`.as("view_count"),
  })
  .from(videoViews)
  .groupBy(videoViews.videoId)
  .as("video_view_stats");

/**
 * 영상별 like / dislike 수를 한 번의 집계로 산출.
 * COUNT(*) FILTER(WHERE ...) 패턴은 Postgres 9.4+ 표준.
 */
export const videoReactionStats = db
  .select({
    videoId: videoReactions.videoId,
    likeCount:
      sql<number>`COUNT(*) FILTER (WHERE ${videoReactions.type} = 'like')::int`.as(
        "like_count",
      ),
    dislikeCount:
      sql<number>`COUNT(*) FILTER (WHERE ${videoReactions.type} = 'dislike')::int`.as(
        "dislike_count",
      ),
  })
  .from(videoReactions)
  .groupBy(videoReactions.videoId)
  .as("video_reaction_stats");

/** 크리에이터별 구독자 수 */
export const subscriberStats = db
  .select({
    creatorId: subscriptions.creatorId,
    subscriberCount: sql<number>`COUNT(*)::int`.as("subscriber_count"),
  })
  .from(subscriptions)
  .groupBy(subscriptions.creatorId)
  .as("subscriber_stats");

/** 사용자별 업로드 영상 수 */
export const userVideoStats = db
  .select({
    userId: videos.userId,
    videoCount: sql<number>`COUNT(*)::int`.as("video_count"),
  })
  .from(videos)
  .groupBy(videos.userId)
  .as("user_video_stats");

/** 영상별 댓글 수 */
export const videoCommentStats = db
  .select({
    videoId: comments.videoId,
    commentCount: sql<number>`COUNT(*)::int`.as("comment_count"),
  })
  .from(comments)
  .groupBy(comments.videoId)
  .as("video_comment_stats");

/** 댓글별 like / dislike 수 */
export const commentReactionStats = db
  .select({
    commentId: commentReactions.commentId,
    likeCount:
      sql<number>`COUNT(*) FILTER (WHERE ${commentReactions.type} = 'like')::int`.as(
        "like_count",
      ),
    dislikeCount:
      sql<number>`COUNT(*) FILTER (WHERE ${commentReactions.type} = 'dislike')::int`.as(
        "dislike_count",
      ),
  })
  .from(commentReactions)
  .groupBy(commentReactions.commentId)
  .as("comment_reaction_stats");

/** 재생목록별 영상 수 */
export const playlistVideoStats = db
  .select({
    playlistId: playlistVideos.playlistId,
    videoCount: sql<number>`COUNT(*)::int`.as("video_count"),
  })
  .from(playlistVideos)
  .groupBy(playlistVideos.playlistId)
  .as("playlist_video_stats");

export const viewCountExpr = sql<number>`COALESCE(${videoViewStats.viewCount}, 0)`;
export const likeCountExpr = sql<number>`COALESCE(${videoReactionStats.likeCount}, 0)`;
export const dislikeCountExpr = sql<number>`COALESCE(${videoReactionStats.dislikeCount}, 0)`;
export const subscriberCountExpr = sql<number>`COALESCE(${subscriberStats.subscriberCount}, 0)`;
export const videoCountExpr = sql<number>`COALESCE(${userVideoStats.videoCount}, 0)`;
export const commentCountExpr = sql<number>`COALESCE(${videoCommentStats.commentCount}, 0)`;
export const commentLikeCountExpr = sql<number>`COALESCE(${commentReactionStats.likeCount}, 0)`;
export const commentDislikeCountExpr = sql<number>`COALESCE(${commentReactionStats.dislikeCount}, 0)`;
export const playlistVideoCountExpr = sql<number>`COALESCE(${playlistVideoStats.videoCount}, 0)`;

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { videoReactions, videoViews } from "@/db/schema";

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

export const viewCountExpr = sql<number>`COALESCE(${videoViewStats.viewCount}, 0)`;
export const likeCountExpr = sql<number>`COALESCE(${videoReactionStats.likeCount}, 0)`;
export const dislikeCountExpr = sql<number>`COALESCE(${videoReactionStats.dislikeCount}, 0)`;

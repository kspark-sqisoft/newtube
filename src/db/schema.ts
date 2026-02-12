// DB 스키마 (Drizzle + Zod)
import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  timestamp,
  uniqueIndex,
  integer,
  pgEnum,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

// 좋아요/싫어요 타입
export const reactionType = pgEnum("reaction_type", ["like", "dislike"]);

// playlists와 videos는 직접 1:1/1:N이 아니라, 중간 테이블 playlist_videos를 통한 N:M(다대다) 관계입니다.
// 재생목록-영상 N:M 매핑  이 플레이리스트에 이 비디오가 들어 있다
// 한 플레이리스트 → 여러 비디오 (playlist_videos 통해)
// 한 비디오 → 여러 플레이리스트 (playlist_videos 통해)
export const playlistVideos = pgTable(
  "playlist_videos",
  {
    playlistId: uuid("playlist_id") //재생목록 ID
      .references(() => playlists.id, { onDelete: "cascade" })
      .notNull(),
    videoId: uuid("video_id") //영상 ID
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    //규칙: 한 플레이리스트에 같은 영상이 한 번만 들어감 (유저 규칙은 아님).
    primaryKey({
      name: "playlist_videos_pk",
      columns: [t.playlistId, t.videoId],
    }),
  ],
);

// playlistVideos → playlist, video
export const playlistVideosRelations = relations(playlistVideos, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistVideos.playlistId],
    references: [playlists.id],
  }),
  video: one(videos, {
    fields: [playlistVideos.videoId],
    references: [videos.id],
  }),
}));

// 재생목록
// playlists와 users 관계는 1:N 관계입니다. 한 사용자가 여러 재생목록을 만들 수 있습니다.
// 한 플레이리스트(playlists) → 한 사용자(users)에게만 속함
export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  userId: uuid("user_id") //재생목록을 만든 사람
    .references(() => users.id, {
      onDelete: "cascade",
    })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// playlists → user, playlistVideos[]
export const playlistRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, {
    //플레이리스트 -> 소유자 1명
    fields: [playlists.userId],
    references: [users.id],
  }),
  playlistVideos: many(playlistVideos), //플레이리스트 -> 영상 여러 개
}));

// 사용자 (Clerk 연동)
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").unique().notNull(),
    name: text("name").notNull(),
    bannerUrl: text("banner_url"),
    bannerKey: text("banner_key"),
    imageUrl: text("image_url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    //“clerk_id 컬럼에 clerk_id_idx라는 unique 인덱스를 걸어서, 값이 중복되지 않고 이 컬럼으로 조회가 빨라지게 한다”는 의미입니다.
    uniqueIndex("clerk_id_idx").on(t.clerkId),
  ],
);

// users → videos[], videoViews[], subscriptions[], comments[], playlists[] 등
export const userRelations = relations(users, ({ many }) => ({
  videos: many(videos),
  videoViews: many(videoViews),
  videoReactions: many(videoReactions),
  subscriptions: many(subscriptions, {
    relationName: "subscriptions_viewer_id_fkey",
  }),
  subscribers: many(subscriptions, {
    relationName: "subscriptions_creator_id_fkey",
  }),
  comments: many(comments),
  commentReactions: many(commentReactions),
  playlists: many(playlists),
}));

// subscriptions 는 자체가 중간 테이블 입니다.
// subscriptions는 users 테이블 하나를 viewer(구독자)와 creator(채널) 두 역할로 참조하는, users 간 N:M 관계를 담는 테이블입니다.
// 채널 구독   구독자(viewer) → 크리에이터(creator)” 관계, (viewerId, creatorId) 복합 PK로 한 사용자가 같은 채널을 한 번만 구독.
// 구독자는 다수의 크레에이터가 있고 크리에이터는 다수의 구독자가 있습니다.
export const subscriptions = pgTable(
  "subscriptions",
  {
    viewerId: uuid("viewer_id") //구독자
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    creatorId: uuid("creator_id") //크리에이터
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    //규칙: 한 유저(viewer)가 한 채널(creator) 구독 한 번만.
    primaryKey({
      name: "subscriptions_pk",
      columns: [t.viewerId, t.creatorId],
    }),
  ],
);

// subscriptions → viewer(user), creator(user)
export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  viewer: one(users, {
    fields: [subscriptions.viewerId],
    references: [users.id],
    relationName: "subscriptions_viewer_id_fkey",
  }),
  creator: one(users, {
    fields: [subscriptions.creatorId],
    references: [users.id],
    relationName: "subscriptions_creator_id_fkey",
  }),
}));

// 영상 카테고리
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    //카테고리 이름은 중복될 수 없고, 이름으로 조회할 때 name_idx 인덱스를 쓴다
    uniqueIndex("name_idx").on(t.name),
  ],
);

// 해강 카테고리에 속한 영상들 videos[]
export const categoryRelations = relations(categories, ({ many }) => ({
  videos: many(videos),
}));

// 영상 공개 여부
export const videoVisibility = pgEnum("video_visibility", [
  "public",
  "private",
]);

// 영상 (Mux 스트리밍 메타 포함)
// 한 카테고리 → 여러 비디오 (1:N)
// 한 사용자(users) → 여러 비디오(videos) (1:N) 업로드 가능
export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),

  muxStatus: text("mux_status"),
  muxAssetId: text("mux_asset_id").unique(),
  muxUploadId: text("mux_upload_id").unique(),
  muxPlaybackId: text("mux_playback_id").unique(),
  muxTrackId: text("mux_track_id").unique(),
  muxTrackStatus: text("mux_track_status"),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailKey: text("thumbnail_key"),
  previewUrl: text("preview_url"),
  previewKey: text("preview_key"),
  duration: integer("duration").default(0).notNull(),
  visibility: videoVisibility("visibility").default("private").notNull(),
  userId: uuid("user_id") //업로더
    .references(() => users.id, {
      onDelete: "cascade",
    })
    .notNull(),

  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }), //카테고리

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videoInsertSchema = createInsertSchema(videos);
export const videoUpdateSchema = createUpdateSchema(videos);
export const videoSelectSchema = createSelectSchema(videos);

// videos → user, category, views[], reactions[], comments[], playlistVideos[]
// user: 업로더 (users 1명), category: 카테고리 (categories 1개), views: 조회수 (videoViews[]), reactions: 좋아요/싫어요 (videoReactions[]), comments: 댓글 (comments[]), playlistVideos: 재생목록 (playlistVideos[])
export const videoRelations = relations(videos, ({ one, many }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [videos.categoryId],
    references: [categories.id],
  }),
  views: many(videoViews),
  reactions: many(videoReactions),
  comments: many(comments),
  playlistVideos: many(playlistVideos),
}));

// 댓글 (parentId 있으면 대댓글)
// 한 사용자(users) → 여러 댓글(comments) 작성 가능 (1:N)
// 한 영상(videos) → 여러 댓글(comments) 작성 가능 (1:N)
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"), //대댓글인 경우 부모 댓글 ID
    userId: uuid("user_id") //댓글을 남긴 사람
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    videoId: uuid("video_id") //댓글을 남긴 영상
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    value: text("value").notNull(), //댓글 내용
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => {
    return [
      //대댓글인 경우 부모 댓글을 참조하는 외래키 제약조건
      foreignKey({
        columns: [t.parentId],
        foreignColumns: [t.id],
        name: "comments_parent_id_fkey",
      }).onDelete("cascade"),
    ];
  },
);

// comments → user, video, parent(comment), reactions[], replies[]
export const commentRelations = relations(comments, ({ one, many }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [comments.videoId],
    references: [videos.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comments_parent_id_fkey",
  }),
  reactions: many(commentReactions),
  replies: many(comments, {
    relationName: "comments_parent_id_fkey",
  }),
}));

export const commentInsertSchema = createInsertSchema(comments);
export const commentSelectSchema = createSelectSchema(comments);
export const commentUpdateSchema = createUpdateSchema(comments);

// 댓글 좋아요/싫어요
// users (1) ──< comment_reactions (N) … 한 사용자가 여러 댓글에 반응 가능
// comments (1) ──< comment_reactions (N) … 한 댓글에 여러 사용자의 반응 가능
export const commentReactions = pgTable(
  "comment_reactions",
  {
    userId: uuid("user_id") //반응을 남긴 사람
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    commentId: uuid("comment_id") //반응을 남긴 댓글
      .references(() => comments.id, { onDelete: "cascade" })
      .notNull(),
    type: reactionType("type").notNull(), //좋아요, 싫어요
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    //규칙: 한 유저가 한 댓글에 반응(좋아요/싫어요) 한 번만.
    primaryKey({
      name: "comment_reactions_pk",
      columns: [t.userId, t.commentId],
    }),
  ],
);

// commentReactions → user, comment
export const commentReactionRelations = relations(
  commentReactions,
  ({ one }) => ({
    user: one(users, {
      fields: [commentReactions.userId],
      references: [users.id],
    }),
    comment: one(comments, {
      fields: [commentReactions.commentId],
      references: [comments.id],
    }),
  }),
);

// 영상 시청 기록 (유저별 1회)
// user: 시청한 사용자(users 1명), video: 시청한 영상(videos 1개)
// users (1) ──< video_views (N)	한 사용자가 여러 영상을 시청 → 여러 view 행
// videos (1) ──< video_views (N)	한 영상을 여러 사용자가 시청 → 여러 view 행
// users (1)  ──────<  video_views (N)  >──────  (1) videos
export const videoViews = pgTable(
  "video_views",
  {
    userId: uuid("user_id") //시청한 사람
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    videoId: uuid("video_id") //시청한 영상
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    //규칙: 한 유저가 한 영상에 대한 시청 기록 1개만 (유저당 조회수 1회).
    primaryKey({
      name: "video_views_pk",
      columns: [t.userId, t.videoId],
    }),
  ],
);

// videoViews → user, video
export const videoViewsRelations = relations(videoViews, ({ one }) => ({
  user: one(users, {
    fields: [videoViews.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoViews.videoId],
    references: [videos.id],
  }),
}));

export const videoViewSelectSchema = createSelectSchema(videoViews);
export const videoViewInsertSchema = createInsertSchema(videoViews);
export const videoViewUpdateSchema = createUpdateSchema(videoViews);

// 영상 좋아요/싫어요  (userId, videoId) 복합 PK로 유저당 영상당 하나의 반응
// users (1) ──< video_reactions (N)	한 사용자가 여러 영상에 반응 → 여러 reaction 행
// videos (1) ──< video_reactions (N)	한 영상에 여러 사용자가 반응 → 여러 reaction 행
// users (1)  ──────<  video_reactions (N)  >──────  (1) videos
export const videoReactions = pgTable(
  "video_reactions",
  {
    userId: uuid("user_id") //반응을 남긴 사람
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    videoId: uuid("video_id") //반응을 남긴 영상
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    type: reactionType("type").notNull(), //좋아요, 싫어요
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    //(user_id, video_id) 조합이 한 테이블 안에서 유일해야 한다는 제약입니다.
    // “한 유저가 한 영상에 대해 반응(좋아요 또는 싫어요)을 한 번만 가질 수 있다”는 규칙이 DB 레벨에서 보장됩니다.
    primaryKey({
      name: "video_reactions_pk",
      columns: [t.userId, t.videoId],
    }),
  ],
);

// videoReactions → user, video
export const videoReactionsRelations = relations(videoReactions, ({ one }) => ({
  user: one(users, {
    fields: [videoReactions.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoReactions.videoId],
    references: [videos.id],
  }),
}));

export const videoReactionsSelectSchema = createSelectSchema(videoReactions);
export const videoReactionsInsertSchema = createInsertSchema(videoReactions);
export const videoReactionsUpdateSchema = createUpdateSchema(videoReactions);

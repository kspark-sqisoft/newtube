# 전체 테이블 관계 요약

---

## 1. users (사용자)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| → | videos | 1 : N | videos.user_id | 한 사용자가 여러 영상 업로드 |
| → | playlists | 1 : N | playlists.user_id | 한 사용자가 여러 플레이리스트 소유 |
| → | subscriptions | N : N (중간 테이블: subscriptions) | viewer_id, creator_id | 구독자↔채널(둘 다 users) |
| → | comments | 1 : N | comments.user_id | 한 사용자가 여러 댓글 작성 |
| → | comment_reactions | 1 : N | comment_reactions.user_id | 한 사용자가 여러 댓글에 반응 |
| → | video_views | 1 : N | video_views.user_id | 한 사용자가 여러 영상 시청 |
| → | video_reactions | 1 : N | video_reactions.user_id | 한 사용자가 여러 영상에 반응 |

---

## 2. categories (카테고리)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | videos | 1 : N | videos.category_id | 한 카테고리에 여러 영상 (비디오는 0~1개 카테고리) |

---

## 3. videos (영상)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | users | N : 1 | videos.user_id | 업로더 1명 |
| ← | categories | N : 1 | videos.category_id | 카테고리 0~1개 (nullable) |
| ↔ | playlists | N : M | playlist_videos | 한 영상이 여러 플리에 포함 가능 |
| → | comments | 1 : N | comments.video_id | 한 영상에 여러 댓글 |
| → | video_views | 1 : N | video_views.video_id | 한 영상 시청 기록 여러 개 |
| → | video_reactions | 1 : N | video_reactions.video_id | 한 영상에 좋아요/싫어요 여러 개 |

---

## 4. playlists (재생목록)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | users | N : 1 | playlists.user_id | 소유자 1명 |
| ↔ | videos | N : M | playlist_videos | 한 플리에 여러 영상, 한 영상이 여러 플리에 |

---

## 5. playlist_videos (플레이리스트–영상 연결)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | playlists | N : 1 | playlist_id | 어떤 플리에 속하는지 |
| ← | videos | N : 1 | video_id | 어떤 영상이 들어 있는지 |

**역할:** playlists ↔ videos 의 **중간 테이블** (N:M 구현).

---

## 6. subscriptions (구독)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | users | N : 1 | viewer_id | 구독하는 사람 |
| ← | users | N : 1 | creator_id | 구독받는 채널(사용자) |

**역할:** users(구독자) ↔ users(채널) 의 **중간 테이블** (N:M, 같은 users 테이블을 두 번 참조).

---

## 7. comments (댓글)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | users | N : 1 | comments.user_id | 작성자 1명 |
| ← | videos | N : 1 | comments.video_id | 어느 영상의 댓글인지 |
| ← | comments | N : 1 | comments.parent_id | 대댓글일 때 부모 댓글 (self) |
| → | comment_reactions | 1 : N | comment_reactions.comment_id | 한 댓글에 여러 반응 |

---

## 8. comment_reactions (댓글 좋아요/싫어요)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | users | N : 1 | user_id | 반응한 사람 |
| ← | comments | N : 1 | comment_id | 반응이 달린 댓글 |

**역할:** users ↔ comments 의 N:M을 (user_id, comment_id)로 구현. 한 사용자·한 댓글당 반응 1개.

---

## 9. video_views (영상 시청 기록)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | users | N : 1 | user_id | 시청한 사람 |
| ← | videos | N : 1 | video_id | 시청된 영상 |

**역할:** users ↔ videos 의 시청 관계. (user_id, video_id) 복합 PK로 유저당 영상당 1회만 저장(조회수).

---

## 10. video_reactions (영상 좋아요/싫어요)

| 관계 | 대상 테이블 | 관계 유형 | 연결 컬럼 | 설명 |
|------|-------------|-----------|-----------|------|
| ← | users | N : 1 | user_id | 반응한 사람 |
| ← | videos | N : 1 | video_id | 반응이 달린 영상 |

**역할:** users ↔ videos 의 반응 관계. (user_id, video_id) 복합 PK로 유저당 영상당 like/dislike 1개.

---

# 관계 다이어그램 (한눈에)

```
                    ┌─────────────┐
                    │   users     │
                    └──────┬──────┘
         ┌────────────────┼────────────────┬─────────────────┬──────────────────┬─────────────────┐
         │ 1:N             │ 1:N            │ 1:N              │ 1:N              │ 1:N             │ N:M
         ▼                 ▼                ▼                 ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌─────────────┐   ┌──────────┐     ┌─────────────┐   ┌─────────────┐
   │  videos  │     │playlists │     │subscriptions │   │ comments │     │ video_views │   │video_reactions
   │ user_id  │     │ user_id  │     │viewer_id     │   │ user_id  │     │ user_id     │   │ user_id     │
   └────┬─────┘     └────┬─────┘     │creator_id   │   └────┬─────┘     │ video_id    │   │ video_id    │
        │                │           └─────────────┘        │           └─────────────┘   └─────────────┘
        │ category_id     │ N:M                              │ 1:N
        │                ▼                                  ▼
   ┌────┴────┐     ┌─────────────────┐                ┌──────────────────┐
   │categories     │     │ playlist_videos │                │ comment_reactions│
   └─────────┘     │ playlist_id       │                │ user_id, comment_id
                   │ video_id          │                └──────────────────┘
                   └─────────────────┘
```

---

# 한 줄 요약

| 테이블 | 한 줄 요약 |
|--------|------------|
| **users** | 모든 관계의 중심(업로더, 구독자/채널, 댓글 작성자, 시청·반응 주체) |
| **categories** | 영상이 0~1개 붙는 1:N |
| **videos** | users·categories와 1:N, playlists와 N:M(playlist_videos), comments/views/reactions와 1:N |
| **playlists** | users와 1:N, videos와 N:M(playlist_videos) |
| **playlist_videos** | playlists ↔ videos 중간 테이블 |
| **subscriptions** | users(구독자) ↔ users(채널) 중간 테이블 |
| **comments** | users·videos와 N:1, parent_id로 대댓글, comment_reactions와 1:N |
| **comment_reactions** | users ↔ comments 반응 (user당 댓글당 1개) |
| **video_views** | users ↔ videos 시청 기록 (유저당 영상당 1회) |
| **video_reactions** | users ↔ videos 좋아요/싫어요 (유저당 영상당 1개) |

# 04. 데이터 모델

원본은 `src/db/schema.ts`. 본 문서는 그것을 사람이 빠르게 읽을 수 있게 정리한 것.

## 1. ERD (논리)

```
                    ┌──────────┐
                    │  users   │ id (uuid PK), clerk_id (unique)
                    └────┬─────┘
            ┌────────────┼────────────────────────────┐
            │            │ uploads (1:N)              │
            ▼            ▼                            ▼
   ┌────────────────┐ ┌────────┐               ┌─────────────┐
   │ subscriptions  │ │ videos │──category────►│ categories  │
   │ (viewer,creator│ └───┬────┘               └─────────────┘
   │  복합 PK, N:M) │     │
   └────────────────┘     ├────► video_views (user,video 복합 PK)
                          ├────► video_reactions (user,video 복합 PK, type enum)
                          ├────► comments (parent_id self-FK)
                          │           └──► comment_reactions (user,comment 복합 PK)
                          └────► playlist_videos (playlist,video 복합 PK)
                                       └──► playlists ──► users
```

## 2. 테이블 명세

### users
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid PK | `defaultRandom()` |
| clerk_id | text UNIQUE NOT NULL | Clerk userId. webhook 동기화. |
| name | text NOT NULL | "first_name last_name" |
| image_url | text NOT NULL | Clerk 프로필 사진 |
| banner_url / banner_key | text NULL | 채널 배너 (UploadThing) |
| created_at / updated_at | timestamp | |

인덱스: `clerk_id_idx UNIQUE(clerk_id)`

### categories
| 컬럼 | 타입 |
|------|------|
| id | uuid PK |
| name | text UNIQUE NOT NULL |
| description | text NULL |

인덱스: `name_idx UNIQUE(name)`
시드: `src/scripts/seed-categories.ts`

### videos
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid PK | |
| title | text NOT NULL | 초기값 "Untitled" |
| description | text NULL | |
| mux_status | text NULL | `waiting → preparing → ready / errored` |
| mux_asset_id | text UNIQUE NULL | |
| mux_upload_id | text UNIQUE NULL | 사용자→Mux 직접 업로드 식별자 |
| mux_playback_id | text UNIQUE NULL | 스트리밍 키 |
| mux_track_id | text UNIQUE NULL | 자막 트랙 |
| mux_track_status | text NULL | |
| thumbnail_url / thumbnail_key | text NULL | UploadThing key |
| preview_url / preview_key | text NULL | 애니메이션 GIF |
| duration | int NOT NULL DEFAULT 0 | ms |
| visibility | enum('public','private') NOT NULL DEFAULT 'private' | |
| user_id | uuid NOT NULL → users(id) ON DELETE CASCADE | |
| category_id | uuid NULL → categories(id) ON DELETE SET NULL | |
| created_at / updated_at | timestamp | |

인덱스:
- `videos_user_id_updated_at_idx (user_id, updated_at)` — 채널/스튜디오 목록
- `videos_category_id_idx (category_id)` — 카테고리 필터
- `videos_visibility_updated_at_idx (visibility, updated_at)` — 공개 목록 정렬

### subscriptions
| 컬럼 | 타입 |
|------|------|
| viewer_id | uuid NOT NULL → users(id) CASCADE |
| creator_id | uuid NOT NULL → users(id) CASCADE |
| created_at / updated_at | timestamp |

PK: `(viewer_id, creator_id)` (한 채널을 한 번만 구독)
인덱스: `subscriptions_creator_id_idx(creator_id)` — 구독자 수 집계용

### video_views
| 컬럼 | 타입 |
|------|------|
| user_id | uuid CASCADE |
| video_id | uuid CASCADE |
| created_at / updated_at | timestamp |

PK: `(user_id, video_id)` (유저당 영상당 1행)
인덱스: `video_views_video_id_idx(video_id)`

### video_reactions
| 컬럼 | 타입 |
|------|------|
| user_id | uuid CASCADE |
| video_id | uuid CASCADE |
| type | enum('like','dislike') NOT NULL |
| created_at / updated_at | timestamp |

PK: `(user_id, video_id)` (유저당 영상당 1행 — like/dislike 토글)
인덱스: `video_reactions_video_id_type_idx(video_id, type)`

### comments
| 컬럼 | 타입 |
|------|------|
| id | uuid PK |
| parent_id | uuid NULL → comments(id) CASCADE (self-FK, named `comments_parent_id_fkey`) |
| user_id | uuid NOT NULL CASCADE |
| video_id | uuid NOT NULL CASCADE |
| value | text NOT NULL |
| created_at / updated_at | timestamp |

인덱스:
- `comments_video_id_created_at_idx (video_id, created_at)` — 영상 댓글 정렬
- `comments_parent_id_idx (parent_id)` — 대댓글
- `comments_user_id_idx (user_id)`

규칙: 대댓글에 또 다른 대댓글 금지 (procedure 레벨, 09절 참고)

### comment_reactions
| 컬럼 | 타입 |
|------|------|
| user_id | uuid CASCADE |
| comment_id | uuid CASCADE |
| type | enum('like','dislike') NOT NULL |
| created_at / updated_at | timestamp |

PK: `(user_id, comment_id)`
인덱스: `comment_reactions_comment_id_idx(comment_id)`

### playlists
| 컬럼 | 타입 |
|------|------|
| id | uuid PK |
| name | text NOT NULL |
| description | text NULL |
| user_id | uuid NOT NULL CASCADE |
| created_at / updated_at | timestamp |

인덱스: `playlists_user_id_updated_at_idx(user_id, updated_at)` — 사용자별 목록 + 커서

### playlist_videos
| 컬럼 | 타입 |
|------|------|
| playlist_id | uuid CASCADE |
| video_id | uuid CASCADE |
| created_at / updated_at | timestamp |

PK: `(playlist_id, video_id)` (한 플레이리스트에 같은 영상 1회만)
인덱스: `playlist_videos_video_id_idx(video_id)` — 어느 플레이리스트에 들어있는지 역추적

## 3. 관계 다이어그램

```
users 1 ──< videos N           (uploader)
users 1 ──< subscriptions N    (viewer 역할)
users 1 ──< subscriptions N    (creator 역할)
users 1 ──< video_views N
users 1 ──< video_reactions N
users 1 ──< comments N
users 1 ──< comment_reactions N
users 1 ──< playlists N

videos 1 ──< video_views N
videos 1 ──< video_reactions N
videos 1 ──< comments N
videos 1 ──< playlist_videos N

categories 1 ──< videos N

comments 1 ──< comments N      (parent_id self-FK)
comments 1 ──< comment_reactions N

playlists 1 ──< playlist_videos N
```

## 4. 집계 패턴 (`src/db/aggregates.ts`)

```sql
-- video_view_stats
SELECT video_id, COUNT(*) AS view_count
FROM video_views
GROUP BY video_id;

-- video_reaction_stats
SELECT video_id,
       COUNT(*) FILTER (WHERE type='like')    AS like_count,
       COUNT(*) FILTER (WHERE type='dislike') AS dislike_count
FROM video_reactions
GROUP BY video_id;
```

목록 쿼리는 항상:

```ts
.leftJoin(videoViewStats,    eq(videoViewStats.videoId,    videos.id))
.leftJoin(videoReactionStats, eq(videoReactionStats.videoId, videos.id))
// SELECT 에 viewCountExpr / likeCountExpr / dislikeCountExpr 사용
```

이 패턴을 **반드시** 따른다. `db.$count(...)` 를 select 안에 직접 넣으면 row 마다 scalar
subquery 가 실행되어 N+1 발생.

상세 쿼리(`videos.getOne` 같이 row 1 개) 는 `db.$count` 허용.

## 5. 커서 페이지네이션 규약

모든 목록 procedure 는 동일 패턴:

```ts
.where(and(
  ...filters,
  cursor
    ? or(
        lt(table.updatedAt, cursor.updatedAt),
        and(
          eq(table.updatedAt, cursor.updatedAt),
          lt(table.id, cursor.id),
        ),
      )
    : undefined,
))
.orderBy(desc(table.updatedAt), desc(table.id))
.limit(limit + 1)
```

- `limit + 1` 로 다음 페이지 존재 여부 판정.
- 정렬 키는 `(updatedAt, id)` 또는 `(viewCount, id)` (트렌딩) / `(likedAt, id)` (좋아요 목록).
- 같은 정렬 키 값이 충돌해도 `id` 가 tiebreaker.

## 6. 마이그레이션

`drizzle/` 아래 SQL 파일이 단일 진실. 변경 절차:

```bash
# 1) src/db/schema.ts 수정
# 2) 마이그레이션 SQL 생성
bunx drizzle-kit generate
# 3) drizzle/*.sql 검토 + 커밋
# 4) 적용
bunx drizzle-kit migrate    # production
bunx drizzle-kit push        # dev 빠른 적용 (마이그레이션 파일 없이)
```

`drizzle-kit push` 는 dev 만. production 은 마이그레이션 파일을 통해 변경 이력을 남길 것.

## 7. ON DELETE 정책 요약

| 부모 | 자식 | 정책 | 이유 |
|------|------|------|------|
| users | videos | CASCADE | 계정 삭제 시 영상 함께 삭제 |
| users | subscriptions(viewer/creator) | CASCADE | |
| users | video_views / reactions / comments / playlists | CASCADE | |
| videos | video_views / reactions / comments / playlist_videos | CASCADE | |
| comments | comment_reactions | CASCADE | |
| comments | comments(parent) | CASCADE | 부모 댓글 삭제 시 자식도 삭제 |
| categories | videos | SET NULL | 카테고리 삭제는 영상을 죽이지 않음 |
| playlists | playlist_videos | CASCADE | |

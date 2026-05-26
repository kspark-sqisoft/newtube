# 05. API 명세

## 1. 구성

| 종류 | 위치 | 용도 |
|------|------|------|
| tRPC | `/api/trpc/[trpc]` → `src/trpc/routers/_app.ts` | 모든 비즈니스 RPC |
| REST webhook | `/api/users/webhook`, `/api/videos/webhook` | 외부 서비스 → 우리 |
| REST workflow | `/api/videos/workflows/{title,description,thumbnail}` | QStash → 우리 (멱등 step 실행) |
| REST upload | `/api/uploadthing` | UploadThing 파일 라우터 |
| REST current user | `/api/(home)/users/current` (route handler) | 현재 사용자 정보 |

본 문서는 procedure 레벨 시그니처와 의미를 정리한다. 인풋/아웃풋 정확한 타입은
코드의 zod 스키마와 `inferProcedureOutput` 을 사용해야 한다.

## 2. tRPC 라우터 인덱스 (`src/trpc/routers/_app.ts`)

| 키 | 모듈 | 파일 |
|----|------|------|
| `categories` | categories | `src/modules/categories/server/procedures.ts` |
| `studio` | studio | `src/modules/studio/server/procedures.ts` |
| `videos` | videos | `src/modules/videos/server/procedures.ts` |
| `videoViews` | video-views | `src/modules/video-views/server/procedures.ts` |
| `videoReactions` | video-reactions | `src/modules/video-reactions/server/procedures.ts` |
| `subscriptions` | subscriptions | `src/modules/subscriptions/server/procedures.ts` |
| `comments` | comments | `src/modules/comments/server/procedures.ts` |
| `commentReactions` | comment-reactions | `src/modules/comment-reactions/server/procedures.ts` |
| `suggestions` | suggestions | `src/modules/suggestions/server/procedures.ts` |
| `search` | search | `src/modules/search/server/procedures.ts` |
| `playlists` | playlists | `src/modules/playlists/server/procedures.ts` |
| `users` | users | `src/modules/users/server/procedures.ts` |

## 3. procedure 별 시그니처

표기: `[A]` = baseProcedure (인증 불필요) / `[P]` = protectedProcedure / 입력 → 출력.

### videos

| Procedure | 종류 | Input | Output | 설명 |
|-----------|------|-------|--------|------|
| `getMany` | `[A] query` | `{ categoryId?, userId?, cursor?, limit }` | `{ items, nextCursor }` | 공개 영상 목록 + 필터 |
| `getManyTrending` | `[A] query` | `{ cursor?, limit }` | `{ items, nextCursor }` | viewCount DESC |
| `getManySubscribed` | `[P] query` | `{ cursor?, limit }` | `{ items, nextCursor }` | 내가 구독한 채널의 공개 영상 |
| `getOne` | `[A] query` | `{ id }` | 영상 + user + count + viewerReaction + viewerSubscribed | NOT_FOUND |
| `create` | `[P] mutation` | — | `{ video, url }` | Mux upload URL 발급 + DB row 생성 |
| `update` | `[P] mutation` | `videoUpdateSchema` (id 필수) | updatedVideo | 본인 영상만 |
| `remove` | `[P] mutation` | `{ id }` | removedVideo | Mux asset + UT 파일 정리 |
| `revalidate` | `[P] mutation` | `{ id }` | updatedVideo | webhook 누락 복구 |
| `restoreThumbnail` | `[P] mutation` | `{ id }` | updatedVideo | Mux 기본 썸네일로 |
| `generateTitle` | `[P] mutation` | `{ id }` | workflowRunId | Upstash Workflow 트리거 |
| `generateDescription` | `[P] mutation` | `{ id }` | workflowRunId | |
| `generateThumbnail` | `[P] mutation` | `{ id, prompt(≥10) }` | workflowRunId | DALL·E 3 |

### studio

| Procedure | 종류 | Input | Output |
|-----------|------|-------|--------|
| `getMany` | `[P] query` | `{ cursor?, limit }` | 내 영상 목록 (view/comment/like count 포함) |
| `getOne` | `[P] query` | `{ id }` | 내 영상 1건 (NOT_FOUND if not mine) |

### categories

| Procedure | 종류 | Input | Output |
|-----------|------|-------|--------|
| `getMany` | `[A] query` | — | `Category[]` |

### videoViews

`create` (`[P] mutation`) — `{ videoId }` → 시청 기록 추가 (이미 있으면 멱등).

### videoReactions

| Procedure | 종류 | Input | 설명 |
|-----------|------|-------|------|
| `like` | `[P] mutation` | `{ videoId }` | 토글 — 이미 like 면 제거, dislike 면 교체 |
| `dislike` | `[P] mutation` | `{ videoId }` | 동일 |

### subscriptions

| Procedure | 종류 | Input | Output |
|-----------|------|-------|--------|
| `getMany` | `[P] query` | `{ cursor?, limit }` | 내가 구독한 채널 목록 + subscriberCount |
| `create` | `[P] mutation` | `{ userId }` | BAD_REQUEST 시 본인 채널 |
| `remove` | `[P] mutation` | `{ userId }` | |

### comments

| Procedure | 종류 | Input | 비고 |
|-----------|------|-------|------|
| `getMany` | `[A] query` | `{ videoId, parentId?, cursor?, limit }` | totalCount + items |
| `create` | `[P] mutation` | `{ videoId, parentId?, value }` | 대댓글의 대댓글 금지 |
| `remove` | `[P] mutation` | `{ id }` | 본인 댓글만 |

### commentReactions

`like` / `dislike` (`[P] mutation`) — `{ commentId }`.

### suggestions

`getMany` (`[A] query`) — `{ videoId, cursor?, limit }` — 같은 카테고리의 다른 공개 영상.

### search

`getMany` (`[A] query`) — `{ query?, categoryId?, cursor?, limit }` — `ilike '%query%'`.

### playlists

| Procedure | 종류 | Input | 설명 |
|-----------|------|-------|------|
| `create` | `[P] mutation` | `{ name }` | |
| `remove` | `[P] mutation` | `{ id }` | 본인 것만 |
| `getOne` | `[P] query` | `{ id }` | |
| `getMany` | `[P] query` | `{ cursor?, limit }` | 내 재생목록 + videoCount + 최근 영상 썸네일 |
| `getManyForVideo` | `[P] query` | `{ videoId, cursor?, limit }` | + `containsVideo` boolean |
| `getVideos` | `[P] query` | `{ playlistId, cursor?, limit }` | 재생목록 안 공개 영상 |
| `addVideo` | `[P] mutation` | `{ playlistId, videoId }` | 중복 시 CONFLICT |
| `removeVideo` | `[P] mutation` | `{ playlistId, videoId }` | |
| `getLiked` | `[P] query` | `{ cursor?, limit }` | 좋아요한 공개 영상 (가상 재생목록) |
| `getHistory` | `[P] query` | `{ cursor?, limit }` | 시청 기록 (가상 재생목록) |

### users

`getOne` (`[A] query`) — `{ id }` — user + viewerSubscribed + videoCount + subscriberCount.

## 4. 에러 코드 매핑

| TRPCError code | HTTP | 사용처 |
|----------------|------|--------|
| UNAUTHORIZED | 401 | 미인증 / DB user 없음 |
| FORBIDDEN | 403 | 본인 리소스 아님 (playlists 일부) |
| NOT_FOUND | 404 | 리소스 없음 / 본인 것 아님 |
| BAD_REQUEST | 400 | 셀프 구독 / 대댓글의 대댓글 / 검증 실패 |
| CONFLICT | 409 | 재생목록 중복 추가 |
| TOO_MANY_REQUESTS | 429 | 레이트 리밋 초과 (사용자당 10req/10s) |
| INTERNAL_SERVER_ERROR | 500 | 외부 서비스 실패 (UploadThing 등) |

## 5. REST endpoint 명세

### `POST /api/users/webhook` (Clerk)

- 헤더: `svix-id`, `svix-timestamp`, `svix-signature`
- 검증: `svix.Webhook(CLERK_SIGNING_SECRET).verify`
- 처리:
  - `user.created` → INSERT users
  - `user.updated` → UPDATE users (name, image_url)
  - `user.deleted` → DELETE users WHERE clerk_id

### `POST /api/videos/webhook` (Mux)

- 헤더: `mux-signature`
- 검증: `mux.webhooks.verifySignature(body, headers, MUX_WEBHOOK_SECRET)`
- 처리되는 이벤트:
  - `video.asset.created` → mux_status, mux_asset_id 갱신
  - `video.asset.ready` → playback_id 저장 + Mux 썸네일/프리뷰를 UploadThing 으로 영구 복사
  - `video.asset.errored` → mux_status 갱신, 에러 로그
  - `video.asset.deleted` → DB row 삭제
  - `video.asset.track.ready` → mux_track_id, mux_track_status (자막)

응답: `200 "Webhook processed"` / 검증 실패 `400` / 시크릿 미설정 `500`.

### `POST /api/videos/workflows/title` (Upstash Workflow)

- 트리거: `videos.generateTitle` → `workflow.trigger(...)`
- 입력: `{ userId, videoId }` (zod 검증, **캐스팅 금지**)
- 단계:
  1. `get-video` — DB SELECT (소유권 검사)
  2. `get-transcript` — `https://stream.mux.com/{playbackId}/text/{trackId}.txt` 로 fetch
  3. `generate-title` — OpenAI gpt-4o chat.completions
  4. `update-video` — UPDATE videos.title

### `POST /api/videos/workflows/description`

동일 구조. 시스템 프롬프트만 다름.

### `POST /api/videos/workflows/thumbnail`

- 입력: `{ userId, videoId, prompt(≥10) }`
- 단계: `get-video` → `generate-thumbnail` (DALL·E 3, 1792x1024) → `cleanup-thumbnail` (기존 UT 파일 삭제 + DB null) → `upload-thumbnail` (UT 복사) → `update-video`.

### `POST/GET /api/uploadthing`

UploadThing 의 표준 라우트 핸들러. 라우터 정의는 `src/app/api/uploadthing/core.ts`.

## 6. tRPC 호출 패턴

### 서버 컴포넌트 (RSC)

```tsx
// page.tsx
import { HydrateClient, trpc } from "@/trpc/server";

export default async function Page() {
  void trpc.videos.getMany.prefetchInfinite({ limit: DEFAULT_LIMIT });
  return (
    <HydrateClient>
      <VideosSection />
    </HydrateClient>
  );
}
```

### 클라이언트 컴포넌트

```tsx
"use client";
import { trpc } from "@/trpc/client";

const [data, query] = trpc.videos.getMany.useSuspenseInfiniteQuery(
  { limit: DEFAULT_LIMIT },
  { getNextPageParam: (last) => last.nextCursor },
);
```

### generateMetadata 등 서버 직접 호출

```ts
import { createCaller } from "@/trpc/server";
try {
  const caller = await createCaller();
  const video = await caller.videos.getOne({ id });
  return { title: video.title };
} catch (e) {
  // NOT_FOUND 처리
}
```

`force-dynamic` 은 Clerk auth 또는 사용자별 데이터에 의존하는 page 에만 — layout/view 컴포넌트에는 효과 없음.

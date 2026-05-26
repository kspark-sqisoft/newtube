# 06. 도메인 모듈 가이드

`src/modules/<name>/` 구조의 모듈 카탈로그. 각 모듈은 `server/procedures.ts` (없을 수도 있음)
와 `ui/` (views / sections / components) 로 구성된다.

## 모듈 목록

| 모듈 | server | ui | 라우트 키 |
|------|--------|----|-----------|
| auth | — | layout-only | (Clerk 위임) |
| categories | ✅ | filter UI | `categories` |
| comments | ✅ | comment-form, comment-item, comment-replies | `comments` |
| comment-reactions | ✅ | (인라인) | `commentReactions` |
| home | — | home-layout, home-sidebar, home-navbar, categories-section | — |
| playlists | ✅ | playlist 컴포넌트들 | `playlists` |
| search | ✅ | search-input, categories-section, search-section | `search` |
| studio | ✅ | studio-layout, studio-sidebar, studio-navbar, video-form, sections | `studio` |
| subscriptions | ✅ | subscription-button, subscriptions-section | `subscriptions` |
| suggestions | ✅ | suggestions-section | `suggestions` |
| users | ✅ | user-info, user-page-banner/info/section, user-avatar 등 | `users` |
| videos | ✅ | video-player, video-banner, video-description, video-top-row, sections | `videos` |
| video-reactions | ✅ | (인라인) | `videoReactions` |
| video-views | ✅ | (인라인) | `videoViews` |

## 핵심 모듈 상세

### videos
가장 큰 모듈. 영상의 라이프사이클 전체를 책임진다.
- **server** (`procedures.ts`): 12 개 procedure (3.절 참고).
- **ui**:
  - `views/` — 영상 상세 페이지 root, sections 컴포지션
  - `sections/` — `video-section`, `comments-section`, `suggestions-section` (각각 Suspense 경계)
  - `components/` — `video-player` (Mux Player), `video-banner` (처리중/에러 배너), `video-top-row` (좋아요/싫어요/공유), `video-description`, `video-thumbnail`
- **types.ts**: `inferProcedureOutput` 으로 `VideoGetOneOutput`, `VideoGetManyOutput` 등 export.

### studio
크리에이터 페이지. videos 와 짝.
- **server**: `getMany` (내 영상 목록 + commentCount/likeCount), `getOne` (소유권 검사)
- **ui**: video-form (제목/설명/카테고리/공개), thumbnail-upload-modal, thumbnail-generate-modal (DALL·E 프롬프트), studio-uploader (Mux Uploader 래퍼)

### comments
- 대댓글 1 레벨만 허용 — `create` 가 부모 댓글의 `parentId` 가 null 인지 검사.
- `getMany` 는 `parentId` 입력으로 최상위/대댓글 두 모드를 한 procedure 로 처리.
- `replies` CTE 로 부모 댓글의 답글 수까지 1 회 쿼리에 포함.

### playlists
- 일반 재생목록 + 두 가상 재생목록(`getLiked`, `getHistory`).
- 카드 썸네일은 가장 최근 추가된 영상의 썸네일을 SQL subquery 로 가져옴 (`getMany` 의 `thumbnailUrl` select).
- `getManyForVideo` 는 영상 상세에서 "이 영상이 들어있는 내 재생목록" 표시용 — `containsVideo` boolean 포함.

### subscriptions
- 셀프 구독 금지 (`BAD_REQUEST`).
- `getMany` 는 N:M 의 viewer 측 인덱스(`subscriptions_pk` 첫 컬럼 = viewer_id) 활용.
- creator 측 조회(구독자 수 등) 는 `subscriptions_creator_id_idx` 활용.

### search
- 전체 텍스트 검색은 사용하지 않음. `ilike '%query%'` (대소문자 무시).
- 운영 규모가 커지면 Postgres FTS / `pg_trgm` / 외부 검색엔진으로 교체 검토.

### suggestions
- 단순한 카테고리 매칭 + 자기 자신 제외 + 공개 영상.
- 본격적인 추천 알고리즘은 없음.

### users
- 채널 페이지용 단일 조회 procedure 만 노출.
- `viewerSubscribed`, `videoCount`, `subscriberCount` 포함.

### auth
- procedure 없음. Clerk 의 `<SignIn />`, `<SignUp />` 을 페이지로 노출하는 얇은 모듈.

## 의존성 그래프 (도메인 간)

```
videos ─── 의존 ──► users, categories
playlists ──► videos (via playlist_videos)
playlists.getLiked ──► video_reactions
playlists.getHistory ──► video_views
search ──► videos, users
suggestions ──► videos
subscriptions ──► users
comments ──► users, videos
comment-reactions ──► comments
video-reactions / video-views ──► videos
studio ──► videos
```

순환 의존 없음. 모든 도메인은 `db`, `trpc/init`, `lib/*` 에만 의존.

## 새 모듈 추가 체크리스트

1. `src/modules/<name>/server/procedures.ts` 생성 → `createTRPCRouter({...})` export.
2. `src/trpc/routers/_app.ts` 에 라우터 등록 (객체 키가 곧 클라이언트 namespace).
3. (필요 시) `src/db/schema.ts` 에 테이블 + 인덱스 + relations 추가 → `bunx drizzle-kit generate`.
4. `src/modules/<name>/ui/{views,sections,components}` 에 UI 컴포넌트 분리.
5. `src/app/...` 에 page.tsx 추가 → server 에서 `trpc.x.y.prefetch()` + `<HydrateClient>` 로 감싸기.
6. 무한 스크롤은 `(updatedAt, id)` 또는 `(viewCount, id)` 커서 패턴 + `limit + 1` 트릭.
7. 목록 쿼리는 반드시 `video_view_stats / video_reaction_stats` LEFT JOIN 패턴.
8. mutation 은 기본적으로 `protectedProcedure`. 소유권 검사는 `where(eq(table.id, input.id), eq(table.userId, ctx.user.id))`.

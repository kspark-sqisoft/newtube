# 03. 시스템 아키텍처

## 1. 컨텍스트 다이어그램 (C4 Level 1)

```
                    ┌─────────────────────────────┐
                    │       사용자 (브라우저)     │
                    └──────────────┬──────────────┘
                                   │ HTTPS
                                   ▼
                    ┌─────────────────────────────┐
                    │      newtube (Next.js 15)   │
                    │  ┌───────────────────────┐  │
                    │  │ App Router (RSC)      │  │
                    │  │ tRPC v11 + ReactQuery │  │
                    │  └───────────────────────┘  │
                    └──┬──┬──┬──┬──┬──┬──┬──┬─────┘
                       │  │  │  │  │  │  │  │
        ┌──────────────┘  │  │  │  │  │  │  └──────────────┐
        ▼                 ▼  ▼  ▼  ▼  ▼  ▼                 ▼
   ┌────────┐      ┌──────┐ ┌──┐ ┌────┐ ┌──┐ ┌────────┐ ┌──────────┐
   │  Neon  │      │Clerk │ │M │ │Upst│ │UT│ │ OpenAI │ │  ngrok   │
   │  PG    │      │ Auth │ │ux│ │ash │ │  │ │gpt-4o  │ │ (dev only)│
   └────────┘      └──────┘ └──┘ │Red │ └──┘ │dall-e3 │ └──────────┘
                                 │+QS │      └────────┘
                                 │tash│
                                 └────┘
```

## 2. 컨테이너 다이어그램 (C4 Level 2)

newtube 단일 Next.js 앱 내부 구조:

```
┌────────────────────────────────────────────────────────────────────┐
│                         Next.js App                                │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  App Router                                                  │  │
│  │  ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────────────────┐   │  │
│  │  │(home)/  │ │(studio)│ │(auth)/ │ │ api/                │   │  │
│  │  │  page   │ │  page  │ │ page   │ │ ├ trpc/[trpc]       │   │  │
│  │  │  views  │ │  views │ │        │ │ ├ users/webhook     │   │  │
│  │  └────┬────┘ └───┬────┘ └────────┘ │ ├ videos/webhook    │   │  │
│  │       │          │                 │ ├ videos/workflows/ │   │  │
│  │       │          │                 │ │   ├ title         │   │  │
│  │       │          │                 │ │   ├ description   │   │  │
│  │       │          │                 │ │   └ thumbnail     │   │  │
│  │       │          │                 │ └ uploadthing       │   │  │
│  │       │          │                 └─────────────────────┘   │  │
│  └───────┼──────────┼────────────────────────────────────────────┘  │
│          │          │                                               │
│          ▼          ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  src/modules/<도메인>/                                       │  │
│  │  ├── server/procedures.ts   ← tRPC                           │  │
│  │  └── ui/                                                     │  │
│  │       ├── views/             ← page 안의 root component      │  │
│  │       ├── sections/          ← 페이지 한 섹션, Suspense 분리 │  │
│  │       └── components/        ← 도메인 전용 작은 컴포넌트     │  │
│  └────────────┬─────────────────────────────────────────────────┘  │
│               │                                                     │
│               ▼                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  src/trpc/  (init, server, client, routers/_app)             │  │
│  │  src/db/    (drizzle, schema, aggregates)                    │  │
│  │  src/lib/   (mux, redis, ratelimit, workflow, uploadthing,   │  │
│  │              logger, utils)                                  │  │
│  │  src/env.ts (zod 검증)                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

## 3. 데이터 흐름

### 3.1 영상 업로드 — happy path

```
사용자 ──"Create"──► [Client]
    [Client] ──videos.create──► [Server]
        [Server] ──uploads.create──► [Mux]
        [Mux] ──{id, url}──► [Server]
        [Server] ──INSERT video (mux_status='waiting', mux_upload_id)──► [Neon]
    [Server] ──{video, url}──► [Client]
사용자 ──"파일 선택"──► [Mux Uploader] ──PUT file──► [Mux]
[Mux] ──webhook video.asset.created──► [Server]
    [Server] ──UPDATE mux_status='preparing', mux_asset_id──► [Neon]
[Mux] ──webhook video.asset.ready──► [Server]
    [Server] ──fetch thumbnail.jpg + animated.gif──► [Mux Image]
    [Server] ──uploadFilesFromUrl([...])──► [UploadThing]
    [Server] ──UPDATE mux_status='ready', playback_id, thumbnail_url, preview_url──► [Neon]
[Mux] ──webhook video.asset.track.ready──► [Server]
    [Server] ──UPDATE mux_track_id, mux_track_status──► [Neon]
```

### 3.2 자동 제목 생성

```
[Client] ──videos.generateTitle──► [Server]
    [Server] ──workflow.trigger {url, body}──► [Upstash QStash]
    [Server] ──workflowRunId──► [Client]
[QStash] ──POST /api/videos/workflows/title──► [Server]
    [Workflow context]
      ├ step "get-video"      → SELECT video
      ├ step "get-transcript" → fetch txt from Mux
      ├ step "generate-title" → openai chat.completions.create (gpt-4o)
      └ step "update-video"   → UPDATE videos.title
```

각 step 은 QStash 가 재시도/재진입 보장. 모든 step 은 멱등.

### 3.3 영상 조회 (목록)

```
RSC page ──trpc.videos.getMany.prefetch──► [Server tRPC caller]
    [caller] ──SELECT ... LEFT JOIN video_view_stats LEFT JOIN video_reaction_stats──► [Neon]
    [caller] ──items + nextCursor──► [Hydration payload]
HydrateClient ──pre-filled React Query cache──► [Client]
useSuspenseInfiniteQuery ──cache hit, no fetch──► [Client]
사용자 ──스크롤──► InfiniteScroll trigger ──fetchNextPage──► tRPC HTTP ──► [Server]
```

## 4. 모듈 패턴

- **위치**: `src/modules/<도메인>/`
- **레이어**:
  - `server/procedures.ts` — tRPC procedure 의 단일 출구. router 등록은 `src/trpc/routers/_app.ts`.
  - `ui/views/` — page 의 최상위 컴포넌트. RSC 가 prefetch 후 client 컴포넌트로 전달.
  - `ui/sections/` — 한 페이지 안의 큰 섹션. Suspense + ErrorBoundary 분리 단위.
  - `ui/components/` — 도메인 전용 작은 컴포넌트.
  - `types.ts` — 클라이언트가 쓰는 도메인 타입 (`inferProcedureOutput`).
- **격리**: 모듈 간 직접 의존은 최소화. 공통은 `src/components/ui`, `src/lib`, `src/db`, `src/trpc` 만.

## 5. 인증 흐름

```
[Browser] ──cookie──► [Clerk middleware]
    middleware.ts: createRouteMatcher 로 보호 경로면 auth.protect()
[Browser] ──/api/trpc/...──► [Server]
    createTRPCContext (cache):
        clerk auth() → clerkUserId
        DB SELECT user WHERE clerk_id = clerkUserId
        return { clerkUserId, user }
    protectedProcedure middleware:
        if !clerkUserId → UNAUTHORIZED
        if !ctx.user   → UNAUTHORIZED ("User not found in database")
        ratelimit.limit(user.id) → TOO_MANY_REQUESTS on overflow
        next({ ctx })
```

Clerk webhook (`/api/users/webhook`) 이 DB user 행을 만들어 두지 않으면 protectedProcedure 가 깨진다.
회원 가입 직후 첫 요청이 들어오는 타이밍에 webhook 이 도착하지 않은 경우 사용자가 잠시 401 을 받을 수 있다 — 운영 시 webhook 지연 모니터링 필요.

## 6. 디렉터리 구조

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 로그인/가입 (Clerk)
│   ├── (home)/                   # 일반 사용자
│   │   ├── feed/
│   │   ├── playlists/
│   │   ├── search/
│   │   ├── subscriptions/
│   │   ├── users/[userId]/
│   │   └── videos/[videoId]/
│   ├── (studio)/                 # 크리에이터 스튜디오
│   │   └── studio/
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts  # tRPC HTTP handler
│   │   ├── uploadthing/route.ts
│   │   ├── users/webhook/
│   │   └── videos/
│   │       ├── webhook/
│   │       └── workflows/{title,description,thumbnail}/
│   ├── layout.tsx                # 루트 layout
│   └── ...
├── components/                   # 공용
│   ├── ui/                       # shadcn/ui
│   ├── filter-carousel.tsx
│   ├── infinite-scroll.tsx
│   ├── responsive-dialog.tsx
│   └── user-avatar.tsx
├── db/
│   ├── index.ts                  # drizzle 클라이언트
│   ├── schema.ts                 # 테이블/관계 정의
│   └── aggregates.ts             # subquery 헬퍼
├── env.ts                        # zod 환경변수 검증
├── hooks/                        # use-intersection-observer 등
├── lib/                          # 외부 서비스 클라이언트 + 유틸
│   ├── logger.ts
│   ├── mux.ts
│   ├── ratelimit.ts
│   ├── redis.ts
│   ├── uploadthing.ts
│   ├── utils.ts
│   └── workflow.ts
├── middleware.ts                 # Clerk 보호 라우트
├── modules/                      # 도메인 모듈
│   ├── auth/
│   ├── categories/
│   ├── comments/
│   ├── comment-reactions/
│   ├── home/
│   ├── playlists/
│   ├── search/
│   ├── studio/
│   ├── subscriptions/
│   ├── suggestions/
│   ├── users/
│   ├── videos/
│   ├── video-reactions/
│   └── video-views/
├── scripts/
│   └── seed-categories.ts
└── trpc/
    ├── init.ts                   # tRPC 초기화 + protectedProcedure
    ├── client.tsx                # React Provider
    ├── server.tsx                # RSC HydrateClient + createCaller
    ├── query-client.ts
    └── routers/_app.ts           # 도메인 라우터 집합
```

## 7. 트레이드오프 메모

| 결정 | 이유 | 대안 |
|------|------|------|
| Neon HTTP 드라이버 | Vercel/Edge 호환, 커넥션 풀 없음, RTT 비용 작음 | TCP + pgbouncer — 더 빠르지만 인프라 복잡 |
| Mux direct upload | 서버 트래픽 절감, 큰 영상도 안정적 | 서버 프록시 — 단순하지만 비용/속도 불리 |
| Upstash Workflow | OpenAI 같은 외부 호출을 멱등 step 으로 분리, 재시도 자동 | 인라인 호출 — 빠르지만 실패 시 사용자 영향 |
| 모든 페이지네이션 커서 | offset 의 페이지 점프/누락 문제 회피, 안정 정렬 | offset — 페이지 점프 가능, 대규모에서 느림 |
| tRPC v11 RC | 타입 안전 풀스택 / React Query 통합 | REST + OpenAPI — 더 표준이지만 타입 안전성 손실 |

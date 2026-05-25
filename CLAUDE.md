# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 명령어

```bash
bun install                       # 의존성 설치
bun run dev                       # Next dev 서버
bun run dev:all                   # Next + ngrok webhook 터널 (Mux/Clerk webhook 테스트)
bun run build                     # 프로덕션 빌드
bun run lint                      # ESLint (next lint)
bun run typecheck                 # tsc --noEmit
bun run test                      # Vitest (jsdom + React Testing Library)
bun run test:watch                # Vitest watch
bunx vitest run path/to.test.ts   # 단일 테스트 파일 실행
bunx vitest run -t "test name"    # 이름으로 특정 테스트 실행

bunx drizzle-kit push             # 개발용: 스키마 직접 적용
bunx drizzle-kit generate         # 프로덕션용: 마이그레이션 SQL 생성
bunx drizzle-kit migrate          # 프로덕션용: 마이그레이션 적용
bunx drizzle-kit studio           # 브라우저 DB 탐색기
bun src/scripts/seed-categories.ts  # 카테고리 시드
```

## 아키텍처

### 모듈 패턴 (`src/modules/<name>/`)
도메인별로 격리되어 있고 두 layer 로 분리: `server/procedures.ts` (tRPC procedures) + `ui/` (views/sections/components). 새 기능은 새 모듈을 만들거나 기존 모듈을 확장하는 방식으로 추가. router 등록은 `src/trpc/routers/_app.ts`.

### 환경변수 (`src/env.ts`)
모든 환경변수는 zod 로 부팅 시 검증됨. `process.env.X!` 직접 참조 금지 — `import { env } from "@/env"` 사용. 서버 변수와 클라이언트 변수(`NEXT_PUBLIC_*`)는 별도 스키마이고, Proxy 로 클라이언트 측에서 서버 변수 접근 시 throw. 누락된 환경변수가 있으면 앱이 부팅 시 즉시 실패한다.

### tRPC 컨텍스트와 protectedProcedure (`src/trpc/init.ts`)
`createTRPCContext` 는 `cache()` 로 감싸져 있어 요청당 1회만 실행, Clerk auth + DB user 조회까지 모두 수행. `protectedProcedure` 는 `ctx.user` 가 이미 있다고 가정하고 재조회하지 않음. 새 protected 라우트 추가 시 user 조회를 또 하지 말 것 — `ctx.user` 사용.

### 비디오 통계 집계 (`src/db/aggregates.ts`)
viewCount / likeCount / dislikeCount 는 반드시 `videoViewStats` + `videoReactionStats` subquery 를 LEFT JOIN 하는 패턴 사용. `db.$count(...)` 를 select 안에 직접 넣으면 row 마다 scalar subquery 가 실행되어 N+1 발생. 신규 비디오 목록 procedure 를 추가할 때:
```ts
.leftJoin(videoViewStats, eq(videoViewStats.videoId, videos.id))
.leftJoin(videoReactionStats, eq(videoReactionStats.videoId, videos.id))
// select 에서 viewCountExpr, likeCountExpr, dislikeCountExpr 사용
```

### DB 스키마 변경 (`src/db/schema.ts`)
FK 컬럼을 추가할 때 항상 `index()` 도 함께 정의 (조회 패턴 고려). 복합 PK 의 두 번째 컬럼만으로 조회한다면 별도 인덱스 필요. 변경 후 `bunx drizzle-kit generate` 로 마이그레이션 파일 생성 후 commit. 개발 중에는 `push` 도 가능.

### Server / Client tRPC 패턴 (`src/trpc/server.tsx`)
- 서버 컴포넌트(page.tsx): `trpc.x.y.prefetch()` 로 query 채우고 `<HydrateClient>` 로 감싸면 클라이언트에서 동일 query 가 캐시 히트
- `generateMetadata` 등 서버 측에서 procedure 결과가 필요한 경우: `createCaller()` 사용 (try/catch 로 NOT_FOUND 처리)
- `force-dynamic` 은 Clerk auth 또는 사용자별 데이터에 의존하는 page 에만 — layout/view 컴포넌트에는 효과 없음

### Webhook & Workflow
- `src/app/api/users/webhook/route.ts` — Clerk webhook, svix 로 서명 검증
- `src/app/api/videos/webhook/route.ts` — Mux webhook, `mux.webhooks.verifySignature` 로 검증
- `src/app/api/videos/workflows/{title,description,thumbnail}/route.ts` — Upstash Workflow handler. `context.requestPayload` 는 항상 zod parse (캐스팅 금지). 외부 URL 콜백이 필요해 dev 환경에서는 ngrok (`bun run dev:all`) 또는 `UPSTASH_WORKFLOW_URL` 에 공개 URL 필수.

### 로깅 (`src/lib/logger.ts`)
ESLint `no-console` 규칙 활성화. `logger.info/warn/error` 사용. `error.tsx` / `global-error.tsx` / `scripts/` / `env.ts` / `logger.ts` 만 console 직접 호출 허용.

### 테스트 (`vitest.config.mts` + `vitest.setup.ts`)
Next.js 공식 가이드 패턴 (`@vitejs/plugin-react` + `jsdom` + `@testing-library/react`). 파일은 `src/**/*.{test,spec}.{ts,tsx}` 패턴, 보통 `__tests__/` 디렉토리에 둠. `@testing-library/jest-dom/vitest` matcher 가 setup 으로 자동 로드된다. **async Server Components 는 Vitest 미지원** — 그런 페이지는 E2E (Playwright 등) 로 검증.

### 코멘트
파일 내 주석은 한국어가 많음 (도메인/스키마 설명 위주). 새 코드의 주석도 한국어로 통일.

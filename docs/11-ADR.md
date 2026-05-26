# 11. ADR — Architecture Decision Records

본 문서는 현재 코드베이스에 박혀 있는 주요 결정들을 사후 ADR 형식으로 기록한 것이다.
미래 변경 시 "왜 이런 식으로 되어 있는가" 의 근거.

---

## ADR-001: tRPC v11 + TanStack Query 5 + superjson

**컨텍스트**: 풀스택 타입 안전성을 원하지만 GraphQL 도입 비용은 크다.
**결정**: tRPC v11 (RC) 사용. RSC 에서 `prefetch` + `HydrateClient`, 클라이언트는 React Query.
**결과**:
- DB 스키마 → procedure → 컴포넌트까지 타입 한 줄로 흐름.
- REST 스키마 정의 / OpenAPI 생성 / SDK 작성 모두 불필요.
- 데이터 변환은 superjson 으로 Date / undefined / Map 까지 안전 전송.
**대안**:
- REST + zod + 클라이언트 SDK 직접 작성 — 타입 안전성 손실.
- GraphQL (Apollo / urql) — schema-first 학습 비용, RSC 통합 미성숙.
**위험**: tRPC v11 이 RC 단계 — GA 후 일부 API 변경 가능. lock 갱신 시 changelog 확인.

---

## ADR-002: Drizzle ORM + Neon HTTP 드라이버

**컨텍스트**: Postgres 필요, Vercel/Edge 친화, ORM 의 type 추론 원함.
**결정**: Drizzle ORM + `drizzle-orm/neon-http` (HTTP fetch 기반, 커넥션 풀 없음).
**결과**:
- 마이그레이션은 `drizzle-kit generate` 가 schema diff 로 생성.
- raw SQL 도 `sql\`...\`` 템플릿 리터럴로 안전.
- 커넥션 풀 관리 불필요 (Neon HTTP 가 stateless).
**대안**:
- Prisma — 런타임 무겁고 Edge 호환 미흡 (개선 중).
- raw SQL — 타입 안전성 손실.
- TCP + pgbouncer — 더 빠르지만 인프라 복잡.
**위험**: HTTP 드라이버는 매 쿼리 RTT 비용 → 동일 요청에서 여러 쿼리를 묶을 수록 유리.

---

## ADR-003: 요청당 1회 Clerk auth + DB user 조회

**컨텍스트**: 한 요청에서 여러 procedure 호출 시 매번 Clerk + DB 조회는 낭비.
**결정**: `createTRPCContext = cache(async () => {...})` 로 React 18+ `cache()` 활용 (`src/trpc/init.ts:13`).
**결과**:
- 같은 요청에서 procedure N개 호출해도 Clerk auth() 와 DB SELECT users 는 각 1회.
- protectedProcedure 미들웨어는 `ctx.user` 가 이미 있다고 가정 — 재조회 금지 규칙.
**대안**:
- 매 procedure 마다 조회 — 단순하지만 비용 증가.
- middleware 에서 한 번 조회해 request header 로 전달 — Next 13+ middleware 의 제약 (DB 접근 어려움).

---

## ADR-004: 영상 통계는 LEFT JOIN + GROUP BY 한 번에

**컨텍스트**: `db.$count(videoViews, eq(...))` 를 select 에 직접 쓰면 row 마다 scalar subquery 실행 → N+1.
**결정**: `src/db/aggregates.ts` 에 `videoViewStats`, `videoReactionStats` subquery 정의. 모든 목록 procedure 가 이를 LEFT JOIN.
**결과**: 100개 영상 목록도 1쿼리. 인덱스(`video_views_video_id_idx`, `video_reactions_video_id_type_idx`)와 함께 빠름.
**예외**: 단일 영상 상세 (`videos.getOne`) 는 row 1개라 `db.$count` 허용.
**규칙**: 새 영상 목록 procedure 추가 시 반드시 이 패턴 사용 — CLAUDE.md 에도 명시.

---

## ADR-005: 모든 페이지네이션은 커서 기반

**컨텍스트**: offset/limit 는 페이지 점프 / 누락 / 대규모 데이터에서 느림.
**결정**: 모든 목록 procedure 는 `(updatedAt DESC, id DESC)` 또는 `(viewCount DESC, id DESC)` 의 `or(lt(a), and(eq(a), lt(b)))` 패턴.
**결과**:
- 무한 스크롤 안정 (새 데이터 추가돼도 중복/누락 없음).
- `limit + 1` 트릭으로 다음 페이지 존재 판정.
- 모든 procedure 가 동일 구조 → 리뷰/추가 비용 낮음.
**대안**: offset — 페이지 이동 가능하지만 학습용 / 무한 스크롤에 부적합.

---

## ADR-006: OpenAI 호출은 Upstash Workflow 로 분리

**컨텍스트**: 자막 fetch → OpenAI → DB update 는 수 초 이상 걸리고 실패 가능.
**결정**: Upstash Workflow (`@upstash/workflow/nextjs`) 의 `serve()` 핸들러로 분리. 각 단계는 `context.run(name, fn)` 또는 `context.call(...)` 로 멱등 step.
**결과**:
- 사용자 요청은 즉시 반환 (`workflowRunId`).
- QStash 가 단계 단위 재시도.
- DALL·E 결과 URL 같이 만료되는 자원도 다음 단계에서 즉시 UploadThing 으로 복사 → 안전.
**대안**:
- 인라인 호출 — 빠르지만 실패 시 사용자 응답에 직접 영향. tRPC 30초 타임아웃 위험.
- 직접 cron / 자체 큐 구축 — 인프라 부담.
**제약**: `UPSTASH_WORKFLOW_URL` 이 QStash 에서 콜백 가능한 공개 URL 이어야 함 (dev 는 ngrok).

---

## ADR-007: zod 기반 환경변수 검증 + Proxy 격리

**컨텍스트**: production 에서 missing env 로 인한 사고 잦음. 클라이언트 번들에 서버 시크릿이 새는 사고도 빈번.
**결정**: `src/env.ts` 에서:
- server / client env 를 별도 스키마로 zod 검증.
- 부팅 시 실패하면 즉시 throw.
- Proxy `get` 으로 클라이언트에서 server 전용 키 접근 시 throw.
**결과**:
- 배포 직후 missing env 즉시 발견 (런타임 첫 요청에서 throw 라도 빠르게 노출).
- `import { env } from "@/env"` 강제, `process.env.X!` 금지 규칙.
**대안**: `@t3-oss/env-nextjs` — 비슷한 효과, 외부 의존 추가. 자체 작성으로 충분.

---

## ADR-008: 모듈 패턴 (`src/modules/<도메인>/`)

**컨텍스트**: Next.js App Router 만으로는 도메인 경계가 약함. 페이지가 자체 fetch 와 컴포넌트를 가지면 응집도가 떨어짐.
**결정**: 도메인별로 `modules/<name>/{server,ui}` 디렉터리. server 는 tRPC procedure, ui 는 views/sections/components 3 단계.
**결과**:
- 새 기능은 새 모듈 (또는 확장) 로 격리.
- 페이지(`app/.../page.tsx`) 는 얇은 wrapper — module 의 view 를 가져와 prefetch + HydrateClient 만.
- 모듈 간 직접 의존 거의 없음.
**대안**: feature folder, atomic design 등 — 본 프로젝트 규모에서는 module 단위가 가장 균형.

---

## ADR-009: Mux Direct Upload + webhook 동기화

**컨텍스트**: 영상 파일은 수십~수백 MB. 서버를 경유하면 대역폭/시간 비용 큼.
**결정**: 사용자가 `videos.create` 호출 → Mux 의 direct upload URL 발급 → 브라우저가 직접 Mux 로 PUT. 이후 Mux webhook 으로 상태 동기화 (`video.asset.created/ready/errored/track.ready/deleted`).
**결과**:
- 서버 대역폭 절감.
- 큰 영상도 안정적 (브라우저 → CDN 직결).
- ready 시 임시 썸네일/프리뷰를 우리 UploadThing 으로 복사 → Mux URL 만료에 대비.
**대안**: 서버 프록시 업로드 — 단순하지만 비용/타임아웃 부담.
**보완**: webhook 누락 대비 `videos.revalidate` 수동 동기화 procedure 제공.

---

## ADR-010: 레이트 리밋은 user.id 기준 sliding window 10/10s

**컨텍스트**: 인증 사용자가 같은 mutation 을 반복하거나 악의적 폭주를 막아야 한다.
**결정**: `@upstash/ratelimit` + Upstash Redis. `Ratelimit.slidingWindow(10, "10s")`. 키는 DB `user.id`.
**결과**:
- 모든 `protectedProcedure` 호출에 자동 적용.
- 초과 시 TRPCError `TOO_MANY_REQUESTS`.
**한계**:
- baseProcedure (비인증) 에는 미적용 → 검색/홈은 보호 없음. 필요시 IP 기반 별도 인스턴스 추가.
- 10/10s 는 일반 사용자 인터랙션 기준. 일괄 작업이 필요한 신규 기능은 화이트리스트 또는 키 분리 검토.

---

## ADR-011: ESLint `no-console` + 자체 logger

**컨텍스트**: production 노이즈 / 로그 일관성 / 향후 외부 로깅 통합.
**결정**: ESLint `no-console: warn` (`warn/error` 만 허용). 모든 일반 로그는 `src/lib/logger.ts` 의 `logger.info/warn/error` 사용. 예외 파일: `logger.ts`, `env.ts`, `scripts/**`, `app/**/error.tsx`, `app/**/global-error.tsx`.
**결과**:
- production 에서 `info/debug` 자동 무시.
- 외부 로깅 도입 시 `logger.ts` 한 곳만 교체.

---

## ADR-012: Vitest + RTL — Next.js 공식 가이드 그대로

**컨텍스트**: 가벼운 단위 테스트 인프라 필요.
**결정**: Next.js 공식 가이드의 Vitest 구성 (`@vitejs/plugin-react` + `jsdom` + `@testing-library/react`).
**결과**:
- 빠른 실행, 친숙한 API.
- 한계: async Server Components 미지원 → 해당 케이스는 E2E (Playwright 등) 필요.
**대안**: Jest — 더 무겁고, ESM/TS 설정 복잡.

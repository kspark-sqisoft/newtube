# 02. TRD — Technical Requirements Document

## 1. 런타임 / 배포 환경

| 항목 | 값 |
|------|-----|
| Node 호환 런타임 | Vercel Functions (Edge 아님, Node runtime) — `@neondatabase/serverless` HTTP 드라이버 사용 |
| 로컬 개발 | Bun (`bun run dev`) |
| 패키지 매니저 | Bun (`bun.lock` 커밋됨) |
| Node 버전 | 의존성 기준 Next 15 + React 19 호환 (Node 18.18+ / 20 LTS 권장) |
| DB | Neon Postgres (HTTP 드라이버) |
| 캐시 / 큐 | Upstash Redis + QStash (REST) |
| 영상 | Mux Direct Upload + Mux 스트리밍 |
| 객체 저장소 | UploadThing |

## 2. 성능 / 확장성

### 2.1 쿼리 패턴

- **목록 쿼리**: 항상 `viewCountExpr / likeCountExpr / dislikeCountExpr` + LEFT JOIN 두 개로 1회 집계.
  - 금지: `db.$count(...)` 를 select 안에 직접 사용 (row 마다 scalar subquery → N+1).
  - 위반 케이스 → `src/db/aggregates.ts` 의 `videoViewStats`, `videoReactionStats` 로 교체.
- **상세 쿼리** (`videos.getOne`): 단일 영상은 row 수가 1 이므로 `db.$count` 허용.
- **커서 페이지네이션**: 모든 무한 스크롤은 `(updatedAt DESC, id DESC)` 또는 `(viewCount DESC, id DESC)` 의 `or(lt(a), and(eq(a), lt(b)))` 패턴으로 안정 정렬.
- **limit + 1 트릭**: 다음 페이지 존재 여부를 1행 더 가져와 판정.

### 2.2 인덱스 전제

- 모든 FK 컬럼에 단독 인덱스 또는 복합 인덱스 포함 (`src/db/schema.ts`).
- 복합 PK 의 첫 번째 컬럼 외 단독 조회 패턴이면 별도 index 정의 (예: `subscriptions_creator_id_idx`).
- 정렬 키 + 필터 조합 (예: `videos_visibility_updated_at_idx`) 으로 ORDER BY 디스크 정렬 회피.

### 2.3 컨텍스트 재사용

- `createTRPCContext = cache(async () => { ... })` (`src/trpc/init.ts:13`) — 한 요청에서 여러 procedure 가 호출돼도 Clerk auth + DB user 조회는 1 회.
- `protectedProcedure` 미들웨어는 `ctx.user` 가 비어있다고 가정하지 않고 **이미 있다고 가정** — 중복 조회 금지.

### 2.4 영상 변환

- 영상 변환은 Mux 가 비동기로 처리 → webhook 으로 상태 동기화. 사용자 응답을 블로킹하지 않는다.
- OpenAI 호출(제목/설명/썸네일)은 Upstash Workflow 단계(`context.run`, `context.call`)로 분리해 재시도/멱등성 확보.

## 3. 보안 / 인가

상세는 [08-SECURITY.md](./08-SECURITY.md).

- 모든 mutation 은 원칙적으로 `protectedProcedure`.
- 리소스 소유권 검사는 항상 `where(eq(table.id, input.id), eq(table.userId, ctx.user.id))` 형태로 SQL 레벨에서 강제.
- 외부 webhook 은 시그니처 검증 후에만 사이드이펙트 수행:
  - Clerk: `svix.Webhook(SIGNING_SECRET).verify(body, headers)`
  - Mux: `mux.webhooks.verifySignature(body, headers, SIGNING_SECRET)`
- 환경변수는 `src/env.ts` 의 zod 스키마로 부팅 시 검증. `process.env.X!` 직접 참조 금지.
- 클라이언트 번들에서 서버 전용 env 접근 시 Proxy 가 throw (`src/env.ts:65`).

## 4. 신뢰성

### 4.1 Webhook 멱등성

- Mux webhook 은 동일 이벤트가 재전송될 수 있음. 모든 핸들러는 `UPDATE ... WHERE muxUploadId = ?` 형태로 멱등.
- Clerk webhook 도 마찬가지로 `clerkId` UNIQUE 제약 + UPSERT/UPDATE 패턴.

### 4.2 워크플로 실패 시

- Upstash Workflow 의 `context.run(name, fn)` 단계는 자동 재시도. 모든 단계는 멱등하게 작성:
  - `update-video` 는 `WHERE id = ? AND user_id = ?` 로 안전.
  - `cleanup-thumbnail` 후 `upload-thumbnail` 실패해도 다음 재시도 시 기존 키가 없어 그대로 재진행.
- DALL·E 결과 URL 은 만료되므로 즉시 UploadThing 으로 복사.

### 4.3 외부 자원 정리

- 영상 삭제(`videos.remove`) 시 Mux asset / UploadThing 썸네일·프리뷰까지 정리. 외부 자원 정리 실패는 로그만 남기고 DB 삭제는 진행 (`logger.error`) — DB 정합성을 외부 서비스 가용성보다 우선.

## 5. 관측성 / 로깅

- `src/lib/logger.ts` — 환경 분리형 로거.
  - `production` 에서는 `info/debug` 무시.
  - `warn/error` 는 항상 출력.
- ESLint `no-console: warn` 정책. console 직접 호출은 다음 파일에서만 허용:
  - `src/lib/logger.ts`, `src/env.ts`, `src/scripts/**`, `src/app/**/error.tsx`, `src/app/**/global-error.tsx`
- 외부 로깅(Sentry/Axiom 등) 통합 시 `logger.ts` 한 곳만 교체.

## 6. 코드 표준

| 영역 | 규칙 |
|------|------|
| 타입 안전 | tsc strict, `bun run typecheck` 가 CI/PR 게이트 |
| 린트 | ESLint (`next lint`) + `no-console` 규칙 |
| 주석 | 한국어. 도메인/스키마/쿼리 의도 위주 |
| 환경변수 | 반드시 `src/env.ts` 의 `env.X` 로 접근 |
| DB 변경 | 스키마 수정 → `bunx drizzle-kit generate` → 마이그레이션 SQL 커밋 |
| 모듈 추가 | `src/modules/<name>/{server,ui}` 패턴, router 는 `src/trpc/routers/_app.ts` 에 등록 |

## 7. 의존성 정책

- **Next.js**: 15.x (App Router 만 사용)
- **React**: 19.x
- **tRPC**: v11.0.0-rc — 안정화 전이지만 핵심 API 변경 없을 가능성 높음. 정식 11.0 GA 시 lock 갱신.
- **Drizzle**: 0.39.x — `drizzle-kit` 과 마이너 버전 정렬 필요.
- **Clerk**: 6.x
- **Mux**: `@mux/mux-node` 9.x, `@mux/mux-player-react` 3.x
- **Upstash**: workflow 0.2.x, redis 1.34.x, ratelimit 2.x — REST 기반이므로 Edge 호환

## 8. 호환성 / 비호환성

- **Edge Runtime 비사용** — Mux SDK / svix / 일부 외부 호출이 Node 런타임 가정.
- **async Server Components 단위 테스트 불가** — Vitest 한계. 해당 페이지는 E2E (Playwright 등) 로 검증.
- **이미지 외부 호스트 허용** — `next.config.ts` 의 `remotePatterns`: `image.mux.com`, `utfs.io`.

## 9. 빌드 / CI

| Task | Command |
|------|---------|
| install | `bun install` |
| dev | `bun run dev` (or `bun run dev:all` for ngrok webhooks) |
| typecheck | `bun run typecheck` |
| lint | `bun run lint` |
| test | `bun run test` |
| build | `bun run build` |

위 5 개 모두 통과를 PR 머지 기준으로 한다.

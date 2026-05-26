# 09. 테스트 전략

## 1. 도구

| 도구 | 용도 | 설정 |
|------|------|------|
| Vitest | 단위 테스트 러너 | `vitest.config.mts` |
| @vitejs/plugin-react | JSX 변환 | |
| jsdom | DOM 환경 | `environment: "jsdom"` |
| @testing-library/react | 컴포넌트 렌더 | |
| @testing-library/jest-dom | DOM matcher | `vitest.setup.ts` 에서 자동 로드 |
| @testing-library/user-event | 인터랙션 시뮬레이션 | |
| vite-tsconfig-paths | `@/...` alias | |

설정 출처: Next.js 공식 가이드 ([nextjs.org/docs/app/guides/testing/vitest](https://nextjs.org/docs/app/guides/testing/vitest)).

## 2. 파일 컨벤션

- 패턴: `src/**/*.{test,spec}.{ts,tsx}` (`vitest.config.mts` 의 `include`)
- 위치: 보통 `__tests__/` 디렉터리 (테스트 대상 옆)
- 명령:

```bash
bun run test                        # 전체 한 번 실행
bun run test:watch                  # 변경 감지 모드
bunx vitest run path/to.test.ts     # 단일 파일
bunx vitest run -t "test name"      # 이름으로 필터
```

## 3. 무엇을 테스트 가능한가

| 대상 | 가능? | 비고 |
|------|------|------|
| 순수 함수 (`src/lib/utils.ts` 등) | ✅ | 간단하고 빠름 |
| zod 스키마 | ✅ | 입력 검증 케이스 |
| 클라이언트 컴포넌트 ("use client") | ✅ | RTL 로 렌더 + interact |
| 동기 server 컴포넌트 | ✅ (제한적) | props 단순한 경우만 |
| **async server 컴포넌트** | ❌ | Vitest 미지원 — E2E 권장 |
| tRPC procedure | ✅ | `appRouter.createCaller(ctx)` 로 직접 호출 — 단 DB / Clerk / Mux 등 외부 의존 mock 필요 |
| Webhook 핸들러 | ✅ (제한적) | 외부 SDK mock 필요 |
| Upstash Workflow handler | ⚠️ | `serve()` 가 감싸므로 step 함수만 분리해서 테스트 권장 |

## 4. 권장 테스트 우선순위

1. **순수 로직** (`src/lib/utils.ts`, 페이지네이션 헬퍼, 포매터)
2. **procedure 비즈니스 규칙** — 권한 검사, 도메인 규칙 (대댓글의 대댓글 금지, 셀프 구독 금지 등)
3. **컴포넌트 — 핵심 사용자 인터랙션** (form 제출, 버튼 토글)
4. **integration** (Suspense + ErrorBoundary 경계)
5. **E2E** — async RSC, 영상 업로드 풀 플로우, webhook 시뮬레이션 (Playwright 등)

## 5. tRPC procedure 테스트 패턴 (가이드)

```ts
import { appRouter } from "@/trpc/routers/_app";
import type { Context } from "@/trpc/init";

const ctx: Context = {
  clerkUserId: "user_123",
  user: { id: "uuid-...", /* ... */ },
};
const caller = appRouter.createCaller(ctx);

await expect(caller.subscriptions.create({ userId: ctx.user.id }))
  .rejects.toMatchObject({ code: "BAD_REQUEST" });
```

DB / Mux / Upstash 는 vitest `vi.mock` 으로 모듈 단위 mock 권장. 진짜 통합은 컨테이너 DB
+ Playwright 로 별도 레이어.

## 6. CI 게이트 (권장)

PR 머지 전 다음 모두 통과:

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

`build` 가 실패하면 환경변수 누락 가능성 — CI 에서는 더미 값 또는 GitHub Secrets 주입.

## 7. 한계 / 알려진 이슈

- **async Server Component 미지원** — Suspense / async fetch 가 있는 page.tsx 는 단위 테스트 불가.
- **Edge Runtime 차이 없음** (현재 Edge 안 씀) — 추후 Edge 전환 시 별도 검토.
- **DB 통합 테스트 부재** — 현재 schema 변경 시 자동 검증 없음. Drizzle 의 `meta/_journal` 변경 detect 정도가 차선.
- **Webhook 시그니처 mock 위험** — 실제 svix / mux 서명 로직을 우회하므로 통합 테스트는 staging 환경에서.

## 8. 추가로 도입하면 좋을 것

- **Playwright** — async RSC, 업로드 플로우, 인증 플로우 E2E.
- **MSW (Mock Service Worker)** — Mux / OpenAI / Clerk API 응답 시뮬레이션.
- **drizzle-kit check** — schema/마이그레이션 정합성 자동 검증.
- **`@vitest/coverage-v8`** — 커버리지 리포트.

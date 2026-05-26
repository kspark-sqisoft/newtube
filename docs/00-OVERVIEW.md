# 00. 프로덕트 개요

## 한 줄 요약

YouTube 의 핵심 사용자 가치 — **영상 업로드 / 시청 / 검색 / 구독 / 반응 / 재생목록 / 추천** — 을
재현한 풀스택 학습 프로젝트.

## 누가 / 무엇을 / 어떻게

| 역할 | 활동 |
|------|------|
| 시청자 | 홈 피드 / 트렌딩 / 검색 / 카테고리 / 채널 페이지에서 공개 영상 탐색 → 영상 시청, 좋아요·싫어요, 댓글·대댓글, 재생목록 추가, 채널 구독 |
| 크리에이터 | 스튜디오에서 영상 업로드 (Mux Direct Upload) → 변환 완료 후 메타데이터(제목·설명·썸네일) 편집 → OpenAI 기반 자동 생성도 가능 → 공개/비공개 토글 |
| 시스템 | Mux webhook 으로 영상 라이프사이클 추적, Clerk webhook 으로 사용자 동기화, Upstash Workflow 로 OpenAI 호출을 비동기 단계로 분리 |

## 핵심 사용자 여정

1. **회원 가입** — Clerk SSO/이메일. Clerk webhook 이 `users` 테이블에 미러링 한다.
2. **영상 업로드** — 스튜디오에서 "Create" → Mux uploader 가 직접 Mux 로 업로드 → webhook 으로 `mux_status` 가 `waiting → preparing → ready` 로 전이 → ready 시 썸네일/프리뷰 자동 추출 → UploadThing 에 영구 저장.
3. **자동 메타데이터** — 자막(transcript) 기반으로 제목·설명을 OpenAI 가 생성. 썸네일은 사용자 프롬프트 + DALL·E 3 로 생성.
4. **공개 발행** — `visibility` 를 `public` 으로 변경하면 홈/검색/트렌딩에 노출.
5. **상호작용** — 시청 기록(`video_views`), 반응(`video_reactions`), 댓글(`comments`), 구독(`subscriptions`), 재생목록(`playlists`).

## 비기능 가치 제안

- **타입 안전 End-to-End** — DB 스키마(Drizzle) → 서버 procedure(tRPC) → 클라이언트 훅까지 한 타입.
- **요청당 1회 사용자 조회** — `cache()` 로 `createTRPCContext` 를 감싸 N 회 procedure 호출에서도 Clerk auth + DB user 조회는 1 회 (`src/trpc/init.ts:13`).
- **N+1 회피** — viewCount/likeCount/dislikeCount 는 `video_view_stats` / `video_reaction_stats` subquery 1 회 LEFT JOIN 으로 끝낸다 (`src/db/aggregates.ts`).
- **레이트 리밋** — 모든 protectedProcedure 호출은 user.id 기준 슬라이딩 윈도우 10req/10s (`src/lib/ratelimit.ts`).
- **부팅 시 환경변수 검증** — `src/env.ts` 의 zod 스키마가 누락된 키를 즉시 throw → 운영 중 missing env 사고 방지.

## 무엇이 아니다 (범위 외)

- 라이브 스트리밍 (Mux Live API 사용 안 함)
- 광고 / 결제 / Premium
- 추천 알고리즘 (단순 카테고리 매칭 + 최신순)
- 알림 (푸시/이메일)
- 모더레이션 (신고/차단/AI 필터)
- i18n (자막 자동 생성 외에는 한국어 UI 일부)

## 기술 스택 요약

| 영역 | 사용 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) + React 19 |
| 데이터 | Drizzle ORM + Neon Postgres |
| RPC | tRPC v11 + TanStack Query 5 + superjson |
| 인증 | Clerk + svix webhook |
| 영상 | Mux (업로드/스트리밍/자막) |
| 큐 / 비동기 | Upstash Workflow (QStash) |
| 캐시 / 리밋 | Upstash Redis + @upstash/ratelimit |
| AI | OpenAI (gpt-4o, dall-e-3) |
| 파일 호스팅 | UploadThing |
| UI | shadcn/ui + Tailwind + Radix UI |
| 테스트 | Vitest + React Testing Library |
| 런타임 | Bun (dev), Node 호환 (build/runtime) |

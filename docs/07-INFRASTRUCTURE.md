# 07. 인프라 / 외부 서비스 / 환경

## 1. 외부 서비스 매트릭스

| 서비스 | 용도 | 환경변수 | 호출 방향 | 비고 |
|--------|------|----------|-----------|------|
| Neon Postgres | 메인 DB | `DATABASE_URL` | 앱 → Neon (HTTP) | `@neondatabase/serverless` |
| Clerk | 인증 | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SIGNING_SECRET` | 양방향 (webhook 포함) | svix 서명 검증 |
| Mux | 영상 업로드/스트리밍/자막 | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET` | 양방향 (webhook 포함) | 직접 업로드 URL |
| Upstash Redis | 레이트 리밋 | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | 앱 → Upstash (REST) | sliding window 10/10s |
| Upstash QStash + Workflow | 비동기 워크플로 (OpenAI 호출 래핑) | `QSTASH_TOKEN`, `UPSTASH_WORKFLOW_URL` | 양방향 — QStash 가 우리 endpoint 호출 | 공개 URL 필요 |
| OpenAI | 제목/설명 (gpt-4o), 썸네일 (dall-e-3) | `OPENAI_API_KEY` | 앱 → OpenAI | workflow 내부에서만 |
| UploadThing | 이미지/썸네일 호스팅 | `UPLOADTHING_TOKEN` | 양방향 (라우터 + REST) | utfs.io 도메인 |
| ngrok (dev only) | webhook 노출 | (로컬 도메인) | 외부 → 로컬 | `bun run dev:all` |

## 2. 환경변수 카탈로그 (`src/env.ts`)

### 서버 전용 (zod `serverEnvSchema`)

| 변수 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `DATABASE_URL` | url | ✅ | Neon Postgres 연결 문자열 |
| `CLERK_SECRET_KEY` | string | ✅ | Clerk 서버 시크릿 |
| `CLERK_SIGNING_SECRET` | string | ✅ | Clerk webhook svix 서명 |
| `MUX_TOKEN_ID` | string | ✅ | Mux API |
| `MUX_TOKEN_SECRET` | string | ✅ | |
| `MUX_WEBHOOK_SECRET` | string | ✅ | webhook 서명 검증 |
| `UPSTASH_REDIS_REST_URL` | url | ✅ | 레이트 리밋 |
| `UPSTASH_REDIS_REST_TOKEN` | string | ✅ | |
| `QSTASH_TOKEN` | string | ✅ | Upstash Workflow 트리거 |
| `UPSTASH_WORKFLOW_URL` | url | ✅ | QStash 가 콜백할 우리 base URL (dev: ngrok) |
| `OPENAI_API_KEY` | string | ✅ | |
| `UPLOADTHING_TOKEN` | string | (선택) | optional 로 정의되어 있으나 실질적으로 필요 |

### 클라이언트 (`clientEnvSchema`)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | SSR 절대 URL 베이스 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | (optional) | Clerk publishable |

### 접근 규칙

- 항상 `import { env } from "@/env"` 사용. `process.env.X!` 금지.
- 클라이언트에서 서버 전용 env 접근 시 Proxy 가 throw (`src/env.ts:65`).
- 부팅 시 zod 검증 실패하면 즉시 throw → 운영 missing env 사고 방지.

## 3. Webhook 셋업

### Clerk → `/api/users/webhook`

1. Clerk Dashboard → Webhooks → Add Endpoint
2. URL: `https://<도메인>/api/users/webhook` (dev: ngrok URL)
3. 구독 이벤트: `user.created`, `user.updated`, `user.deleted`
4. Signing secret 을 `CLERK_SIGNING_SECRET` 에 복사

### Mux → `/api/videos/webhook`

1. Mux Dashboard → Settings → Webhooks → Create new endpoint
2. URL: `https://<도메인>/api/videos/webhook`
3. Signing secret 을 `MUX_WEBHOOK_SECRET` 에 복사
4. 처리 이벤트: `video.asset.created/ready/errored/deleted`, `video.asset.track.ready`

### Upstash Workflow

- `workflow.trigger({ url, body })` 호출 시 `UPSTASH_WORKFLOW_URL` 베이스에 `/api/videos/workflows/...` path 를 붙임.
- 따라서 `UPSTASH_WORKFLOW_URL` 은 dev/staging/prod 별로 다르게 설정. dev 는 ngrok 공개 URL 필수.

## 4. 로컬 개발 시작

```bash
# 0) Bun 설치 — https://bun.sh
bun install

# 1) .env.local 채우기
cp .env.example .env.local
# DATABASE_URL, Clerk, Mux, Upstash, OpenAI, UploadThing 키 입력

# 2) DB 스키마 적용
bunx drizzle-kit push

# 3) 카테고리 시드
bun src/scripts/seed-categories.ts

# 4) 개발 서버
bun run dev
# 또는 (Mux/Clerk webhook 도 ngrok 으로 노출):
bun run dev:all
```

### ngrok 고정 도메인

`package.json` 의 `dev:webhook` 은 고정 도메인을 사용:

```json
"dev:webhook": "ngrok http --url=conceivable-justifyingly-venice.ngrok-free.dev 3000"
```

자기 ngrok 고정 도메인으로 바꿔서 사용. 또는 random 도메인 사용 시 매번 webhook URL 갱신 필요.

## 5. 배포 가이드

### 권장 플랫폼: Vercel

이유:
- Next.js 15 + React 19 First-class 지원
- Neon HTTP 드라이버와 잘 맞음 (커넥션 풀 불필요)
- Mux/Upstash/Clerk webhook 안정

### 배포 절차

1. Vercel 프로젝트 생성 → GitHub 리포 연결
2. Environment Variables 등록 (위 표의 모든 값)
3. Build Command: `bun run build` (또는 `next build`)
4. Output: Vercel 자동 감지
5. 첫 배포 후 production URL 확보 → 다음 값 갱신:
   - `NEXT_PUBLIC_APP_URL` = production URL
   - `UPSTASH_WORKFLOW_URL` = production URL
   - Clerk / Mux webhook endpoint URL 도 production 으로 교체

### DB 마이그레이션

```bash
# CI 또는 수동
bunx drizzle-kit migrate
```

`drizzle/*.sql` 파일은 항상 커밋. `push` 는 dev 만.

## 6. 이미지 / 외부 호스트

`next.config.ts` 의 `images.remotePatterns` — 허용 목록:

| 호스트 | 용도 |
|--------|------|
| `image.mux.com` | Mux 임시 썸네일 (`video.asset.ready` 핸들러에서 영구 복사 전 fallback) |
| `utfs.io` | UploadThing 영구 호스팅 |

새 외부 호스트 추가 시 여기에도 등록.

## 7. 비용 / 한도 관찰 포인트

| 서비스 | 무료 한도 | 모니터링 포인트 |
|--------|-----------|----------------|
| Neon | 0.5 GB / 1 compute | row 수, slow query |
| Clerk | 10,000 MAU | active users |
| Mux | 시간당 일정 분 무료 | encoding minutes / streaming minutes |
| Upstash Redis | 10,000 commands/day | ratelimit hit rate |
| Upstash QStash | 500 messages/day | workflow trigger 수 |
| OpenAI | pay-as-you-go | gpt-4o token, dall-e-3 image |
| UploadThing | 2 GB / 무료 | upload size |

학습 프로젝트 한도 안에서 충분히 운영 가능. 사용자/영상 수가 늘면 OpenAI 와 Mux 비용이 먼저 증가한다.

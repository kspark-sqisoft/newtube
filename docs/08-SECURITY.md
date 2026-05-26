# 08. 보안 / 인증 / 인가

## 1. 위협 모델 (간략)

| 자산 | 위협 | 완화 |
|------|------|------|
| 사용자 계정 | 세션 탈취, 가짜 로그인 | Clerk SSO + 쿠키 (Clerk SDK 위임) |
| 영상 데이터 | 타 사용자 영상 수정/삭제 | procedure 레벨 owner 검사 (`userId = ctx.user.id`) |
| 비공개 영상 | 무권한 접근 | `where(visibility = 'public')` 강제 (목록 / 검색 / 추천) |
| 외부 webhook | 위조된 이벤트로 DB 조작 | svix / Mux 서명 검증 |
| 환경변수 / 시크릿 | 코드 누출 | `.env.local` 미커밋, `src/env.ts` 클라이언트 노출 차단 |
| API 남용 / DoS | 무차별 요청 | Upstash 슬라이딩 윈도우 ratelimit |
| OpenAI 비용 폭주 | 무한 호출 | protectedProcedure + ratelimit + Workflow 단계 |

## 2. 인증 (Authentication)

- Clerk 가 단일 진실. 세션 쿠키 / OAuth / 이메일 모두 Clerk 위임.
- 모든 RSC / API 진입 시 Clerk `auth()` 로 `clerkUserId` 추출.
- DB `users.clerk_id` 가 Clerk userId 와 1:1.

### 사용자 동기화

- Clerk webhook (`/api/users/webhook`):
  - `user.created` → INSERT users
  - `user.updated` → UPDATE users
  - `user.deleted` → DELETE users (CASCADE 로 videos 등 함께 삭제)
- 가입 직후 첫 요청이 webhook 보다 빠르면 `protectedProcedure` 가 "User not found in database" 로 401. **재시도하면 회복** — 이 윈도우는 보통 수십~수백 ms.

## 3. 인가 (Authorization)

### protectedProcedure 미들웨어 (`src/trpc/init.ts:45`)

```ts
if (!ctx.clerkUserId) throw new TRPCError({ code: "UNAUTHORIZED" });
if (!ctx.user)        throw new TRPCError({ code: "UNAUTHORIZED" });
const { success } = await ratelimit.limit(ctx.user.id);
if (!success) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
```

이 미들웨어가 통과한 procedure 안에서 `ctx.user` 는 **반드시 존재**.

### 리소스 소유권

mutation 의 표준 패턴:

```ts
.where(and(
  eq(videos.id, input.id),
  eq(videos.userId, ctx.user.id),
))
```

`returning()` 으로 영향받은 row 가 없으면 NOT_FOUND throw. 이렇게 하면 "다른 사람 리소스 id 를 알아내도 못 만짐" 이 SQL 레벨에서 보장.

playlists 의 일부 procedure 는 명시적으로 FORBIDDEN 도 던지지만, 결과적으로 같은 보호.

### 공개 vs 비공개

목록 / 검색 / 추천 / 재생목록 영상 조회는 **항상** `eq(videos.visibility, "public")` 조건 포함. 비공개 영상은 본인 스튜디오에서만 보인다 (`studio.getMany` 는 `eq(videos.userId, userId)` 만 사용 — visibility 무관).

## 4. 웹훅 시그니처 검증

### Clerk

```ts
const wh = new Webhook(env.CLERK_SIGNING_SECRET);
wh.verify(body, {
  "svix-id": svix_id,
  "svix-timestamp": svix_timestamp,
  "svix-signature": svix_signature,
}); // throws on invalid
```

헤더 누락 시 400. 검증 실패 시 400.

### Mux

```ts
mux.webhooks.verifySignature(
  body,
  { "mux-signature": muxSignature },
  SIGNING_SECRET,
); // throws on invalid
```

서명 없음 → 400. 시크릿 미설정 → 500.

**둘 다 검증 후에만 DB 작업 수행** — body 를 먼저 파싱하더라도 사이드 이펙트는 시그니처 통과 후.

## 5. 레이트 리밋

`src/lib/ratelimit.ts`:

```ts
new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10s"),
});
```

- 적용 대상: 모든 `protectedProcedure` (`src/trpc/init.ts:65`)
- 키: `ctx.user.id` (DB user UUID)
- 한도 초과 시: TRPCError `TOO_MANY_REQUESTS` (HTTP 429)
- 비인증(baseProcedure) 호출에는 적용 안 됨 — 필요 시 IP 기반으로 별도 적용 검토.

## 6. 환경변수 / 시크릿

- `.env.local` 은 `.gitignore`. `.env.example` 만 커밋.
- `src/env.ts` 의 zod 스키마가 부팅 시 검증.
- 클라이언트 번들에서 서버 전용 env 접근 시 Proxy 가 throw.
- 시크릿 회전 시 다음 모두 갱신: Vercel/배포 플랫폼, Clerk Webhook secret, Mux Webhook secret.

## 7. 입력 검증

- 모든 tRPC procedure 는 zod `.input(...)` 정의 필수.
- Workflow handler 도 `inputSchema.parse(context.requestPayload)` 로 zod 검증 (캐스팅 금지).
- Webhook body 는 외부 SDK 가 type 보장 — 단, optional 필드(`data.upload_id` 등) 는 핸들러에서 명시적 null 체크 후 400.

## 8. SQL Injection / XSS

- Drizzle ORM 으로 모든 쿼리 작성. raw SQL 도 `sql\`...\`` 템플릿 리터럴 + 변수 보간 (`${variable}`) → 파라미터 바인딩 자동.
- `playlists.getMany` / `getManyForVideo` 의 subquery 는 `sql<...>\`(SELECT ... ${tableRef})\`` 형태 — 사용자 입력이 들어가지 않으므로 안전.
- 사용자 텍스트(댓글 등) 는 React 가 기본 escape. `dangerouslySetInnerHTML` 사용 금지 (현재 코드베이스에 없음).

## 9. CORS / CSRF

- Mux upload `cors_origin: "*"` (`videos.create`) — 학습용. **프로덕션에서는 자기 도메인으로 제한** (TODO 주석 있음).
- tRPC 는 same-origin 호출 (Next.js 앱과 같은 origin). CSRF 는 Clerk 세션 쿠키의 `SameSite` 가 기본 보호.

## 10. 알려진 한계 / TODO

- `videos.create` 의 Mux upload `cors_origin: "*"` 를 프로덕션 도메인으로 제한.
- baseProcedure 에 IP 기반 ratelimit 없음 — 검색/홈 폭주 가능성.
- 신고 / 차단 / 모더레이션 도구 없음.
- 댓글에 길이 제한 없음 (`z.string()`) → 매우 긴 문자열 가능. 필요시 `.max(N)` 추가.
- 비밀번호 정책 / 2FA 는 Clerk Dashboard 설정에 위임.

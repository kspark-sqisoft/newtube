# 01. PRD — Product Requirements Document

> 본 PRD 는 현재 구현된 기능을 역으로 정리한 것이다. "앞으로 만들 것" 이 아니라
> "지금 무엇이 동작하는지" 를 기준으로 한다.

## 1. 문제 정의

영상 콘텐츠 플랫폼의 핵심 사용자 가치 — 업로드, 시청, 발견, 상호작용 — 을
학습용 풀스택 프로젝트에서 작동하는 형태로 구현한다.

## 2. 타깃 사용자

- **시청자 (P0)** — 회원 가입 후 공개 영상을 탐색 / 시청 / 반응.
- **크리에이터 (P0)** — 영상을 업로드하고 메타데이터를 관리.
- **익명 사용자 (P1)** — 가입 없이 일부 페이지(랜딩) 열람. 단, 상호작용은 모두 로그인 필요.

## 3. 기능 요구사항

### 3.1 인증 (Authentication)

| ID | 요구사항 | 구현 위치 |
|----|---------|-----------|
| AUTH-1 | 사용자는 Clerk SSO/이메일/OAuth 로 가입/로그인 한다 | `src/app/(auth)/sign-in`, `sign-up` |
| AUTH-2 | Clerk 의 `user.created/updated/deleted` 이벤트는 webhook 을 통해 `users` 테이블과 양방향 동기화 | `src/app/api/users/webhook/route.ts` |
| AUTH-3 | 보호된 경로(`/studio`, `/subscriptions`, `/feed/subscribed`, `/playlists/*`)는 미인증 시 자동 리다이렉트 | `src/middleware.ts` |

### 3.2 영상 업로드 (Video Upload)

| ID | 요구사항 | 비고 |
|----|---------|------|
| UP-1 | 사용자는 스튜디오에서 "Create" 버튼으로 새 영상을 시작한다 | `videos.create` mutation |
| UP-2 | Mux Direct Upload URL 을 받아 브라우저 → Mux 로 직접 업로드한다 | 서버 트래픽 절감 |
| UP-3 | 업로드와 동시에 자막(영어) 자동 생성을 요청한다 | `generated_subtitles: en` |
| UP-4 | 업로드 도중/완료 후 Mux webhook 으로 `mux_status` 가 갱신된다 | `created → preparing → ready` |
| UP-5 | `ready` 시 썸네일/애니메이션 프리뷰가 UploadThing 으로 영구 복사된다 | Mux URL 은 만료 가능 |
| UP-6 | webhook 누락 시 사용자가 "revalidate" 로 수동 동기화 가능 | `videos.revalidate` |

### 3.3 영상 메타데이터 (Metadata)

| ID | 요구사항 | 구현 |
|----|---------|------|
| META-1 | 제목/설명/카테고리/공개여부 편집 | `videos.update` |
| META-2 | 자막 기반으로 제목 자동 생성 (OpenAI gpt-4o) | `videos.generateTitle` → Upstash Workflow |
| META-3 | 자막 기반으로 설명 자동 생성 | `videos.generateDescription` |
| META-4 | 사용자 프롬프트 + DALL·E 3 로 썸네일 자동 생성 | `videos.generateThumbnail` (prompt ≥ 10자) |
| META-5 | 썸네일을 Mux 기본 썸네일로 복원 | `videos.restoreThumbnail` |
| META-6 | 영상 삭제 시 Mux asset 과 UploadThing 파일 모두 정리 | `videos.remove` |

### 3.4 시청 / 발견 (Discovery)

| ID | 요구사항 | 정렬 키 |
|----|---------|---------|
| DISC-1 | 홈 — 공개 영상을 최신 수정일 순으로 페이지네이션 | `videos.getMany` (updatedAt DESC) |
| DISC-2 | 카테고리 / 채널 필터 | `categoryId`, `userId` 입력 |
| DISC-3 | 트렌딩 — 조회수 순 | `videos.getManyTrending` (viewCount DESC) |
| DISC-4 | 구독 피드 — 내가 구독한 채널의 공개 영상 | `videos.getManySubscribed` |
| DISC-5 | 제목 검색 (LIKE 기반) + 카테고리 필터 | `search.getMany` (`ilike %query%`) |
| DISC-6 | 영상 상세 — 업로더 정보, 조회수/좋아요/싫어요, 내 반응, 구독 상태 | `videos.getOne` |
| DISC-7 | 연관 추천 — 같은 카테고리의 다른 공개 영상 | `suggestions.getMany` |
| DISC-8 | 채널 페이지 — 채널 정보 + 영상 카운트 + 구독자 수 | `users.getOne` |

### 3.5 상호작용 (Interaction)

| ID | 요구사항 | 제약 |
|----|---------|------|
| INT-1 | 시청 기록 추가 — 1 영상당 1 사용자 1 회 | `(user_id, video_id)` 복합 PK |
| INT-2 | 좋아요/싫어요 — 같은 영상에 한 종류만 | `(user_id, video_id)` 복합 PK |
| INT-3 | 댓글 작성 / 삭제 (본인 댓글만) | `comments.create/remove` |
| INT-4 | 대댓글 — 1 단계만 (대댓글에 대댓글 금지) | BAD_REQUEST 반환 |
| INT-5 | 댓글 좋아요/싫어요 | `comment_reactions` |
| INT-6 | 채널 구독 / 구독 취소 (본인 채널은 금지) | `subscriptions.create/remove` |
| INT-7 | 구독 채널 목록 페이지네이션 | `subscriptions.getMany` |

### 3.6 재생목록 (Playlists)

| ID | 요구사항 | 비고 |
|----|---------|------|
| PL-1 | 사용자별 재생목록 생성 / 삭제 | `playlists.create/remove` |
| PL-2 | 재생목록에 영상 추가 / 제거 (소유자만) | `playlists.addVideo/removeVideo` |
| PL-3 | 같은 영상 중복 추가 금지 | `(playlist_id, video_id)` 복합 PK + 409 CONFLICT |
| PL-4 | 좋아요한 영상 목록 (시스템 재생목록) | `playlists.getLiked` |
| PL-5 | 시청 기록 목록 (시스템 재생목록) | `playlists.getHistory` |
| PL-6 | 영상 상세 화면에서 "이 영상이 들어있는 내 재생목록 목록" 확인 | `playlists.getManyForVideo` |
| PL-7 | 재생목록 카드 썸네일은 가장 최근 추가된 영상의 썸네일 | SQL subquery |

## 4. 비기능 요구사항 (요약)

상세는 [02-TRD.md](./02-TRD.md).

- **성능**: 영상 목록 쿼리는 1회 SELECT 로 viewCount/likeCount/dislikeCount 까지 집계.
- **레이트 리밋**: 인증 사용자당 10req/10s.
- **접근성**: shadcn/ui + Radix 기반 (ARIA 패턴 내장).
- **반응형**: Tailwind 모바일 우선 → md/lg breakpoint.

## 5. Out of Scope (현재 버전)

- 라이브 스트리밍, 광고/결제, 모더레이션 도구
- 알림(푸시/이메일), 신고/차단, 다국어 i18n
- 협업자 / 공동 채널, 클립 / 쇼츠
- 추천 알고리즘 (현재는 카테고리 + 최신순/조회순만)

## 6. 성공 지표 (학습 프로젝트 기준)

- 로컬에서 `bun run dev` 한 번으로 전체 사용자 여정이 동작한다.
- 빌드/타입체크/린트/테스트가 모두 통과한다.
- 새 도메인 모듈을 추가할 때 다른 모듈에 영향이 없다.

# 10. 운영 / 트러블슈팅 런북

## 1. 자주 발생하는 문제와 1차 조치

### 1.1 "Invalid server environment variables" — 앱 부팅 실패

**원인**: `src/env.ts` 의 zod 검증 실패 (누락된 키 또는 잘못된 형식)
**조치**:
1. 로그에서 `Invalid server environment variables` 다음 줄 fieldErrors 확인
2. `.env.local` 또는 배포 플랫폼 env 에서 해당 키 추가
3. 재배포

### 1.2 "User not found in database" — 401 / UNAUTHORIZED

**원인**: Clerk webhook 이 미도착했거나 실패
**조치**:
1. Clerk Dashboard → Webhooks → 최근 attempt 확인
2. 실패한 이벤트는 Resend
3. 그래도 누락이면 DB 에 수동 INSERT:
   ```sql
   INSERT INTO users (clerk_id, name, image_url)
   VALUES ('user_xxx', 'Name', 'https://...');
   ```
4. 향후 방지: ngrok 도메인 / production URL 이 Clerk webhook 설정과 일치하는지 확인

### 1.3 영상이 "처리 중" 에서 안 넘어감

**원인**: Mux webhook 누락 / 서명 실패 / 우리 endpoint 미수신
**조치**:
1. Mux Dashboard → Webhooks → 최근 deliveries 확인
2. 우리 앱 로그에서 `Mux webhook received` 가 찍혔는지
3. 사용자에게 "revalidate" 버튼 안내 → `videos.revalidate` 가 Mux upload 상태를 polling 으로 동기화
4. 그래도 안 되면 DB 에서 `mux_status` 직접 확인 후 Mux Dashboard 에서 asset 상태 비교

### 1.4 "TOO_MANY_REQUESTS" — 429

**원인**: 사용자가 10초에 10회 초과 호출
**조치**:
- 일시적이면 그냥 대기 (sliding window).
- 빈번하다면 UI 가 같은 mutation 을 반복 호출하는지 확인 (`useMutation` 의 onError 무한 retry 가 흔한 원인).
- 글로벌 차원 폭주는 `src/lib/ratelimit.ts` 의 한도 조정 검토.

### 1.5 OpenAI 워크플로 실패 (제목/설명/썸네일 안 만들어짐)

**원인**:
- Mux 자막이 아직 ready 가 아님 (`mux_track_id` 없음) → transcript fetch 실패
- OpenAI API key 만료 / 한도 초과
- DALL·E 결과 URL 만료 (만료 전 UploadThing 으로 복사하지만 네트워크 실패 가능)

**조치**:
1. Upstash Console → Workflow 의 해당 run 로그 확인 — 어느 step 에서 실패했는지
2. `get-transcript` 단계 실패 → 자막 트랙이 생길 때까지 (보통 ready 후 몇 초) 대기 후 재시도
3. `generate-thumbnail` 실패 → OpenAI status 확인, 사용자에게 다시 prompt 입력 요청
4. Workflow run 은 자동 재시도. 영구 실패 시 사용자가 다시 trigger.

### 1.6 무한 스크롤이 안 됨 / 같은 항목 반복

**원인**: 커서 페이지네이션의 정렬 키와 cursor 가 안 맞음
**조치**:
- 새 procedure 추가 시 `(updatedAt, id)` 정렬과 cursor 가 정확히 같은 키인지 확인.
- `getManyTrending` 처럼 viewCount 정렬이면 cursor 도 `{ id, viewCount }` 여야 함.

### 1.7 N+1 쿼리 발생

**증상**: 영상 목록 응답이 느림, Neon Console 에서 동일 패턴 쿼리 수십 회
**원인**: select 안에 `db.$count(table, ...)` 를 직접 넣음
**조치**: `src/db/aggregates.ts` 의 `videoViewStats`, `videoReactionStats` LEFT JOIN 패턴으로 변경. 기준 코드: `videos.getMany`, `videos.getManyTrending`, `videos.getManySubscribed`.

### 1.8 빌드 통과 / 런타임 missing env

**원인**: 빌드 시 env 없이도 build 가 통과할 수 있음 (서버 측은 첫 요청 시 검증)
**조치**: 배포 플랫폼의 env 가 production stage 에 모두 등록됐는지 확인. dotenv 누락은 즉시 `throw` 라 로그 첫 줄에 나옴.

## 2. 점검 체크리스트 (배포 직후)

- [ ] `https://<도메인>/` 가 200 응답
- [ ] `/sign-in` 페이지 진입 OK (Clerk 로드)
- [ ] 가입 / 로그인 1회 시도 — DB users 행 확인
- [ ] 스튜디오 진입 → "Create" → Mux uploader 표시
- [ ] 작은 영상 1개 업로드 → 1-2 분 내 ready 전이 확인
- [ ] `mux_status='ready'` 인 row 의 `thumbnail_url`, `preview_url` 이 utfs.io 도메인
- [ ] 홈에서 해당 영상 보이는지 (visibility = public 으로 바꾼 뒤)
- [ ] 좋아요 / 댓글 / 구독 각 1회씩 시도

## 3. 로그 / 관측

- 로거: `src/lib/logger.ts`
  - `production` 에서 `info/debug` 무시
  - `warn/error` 항상 출력
- 현재 외부 로깅 통합 없음 — Vercel logs / Neon Console / Mux Dashboard / Upstash Console 분산.
- 추후 통합 시: `logger.ts` 한 곳 교체 (Sentry / Axiom / Datadog 등).

## 4. 자주 쓰는 SQL (psql / Drizzle Studio)

```sql
-- 처리 중인 영상
SELECT id, title, mux_status, created_at
FROM videos
WHERE mux_status != 'ready' OR mux_status IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 가장 많이 본 영상 TOP 10
SELECT v.id, v.title, COUNT(vv.*) AS view_count
FROM videos v
LEFT JOIN video_views vv ON vv.video_id = v.id
WHERE v.visibility = 'public'
GROUP BY v.id
ORDER BY view_count DESC
LIMIT 10;

-- 특정 사용자의 모든 영상 + 통계
SELECT v.id, v.title,
       (SELECT COUNT(*) FROM video_views WHERE video_id = v.id) AS views,
       (SELECT COUNT(*) FROM video_reactions WHERE video_id = v.id AND type='like') AS likes
FROM videos v
WHERE v.user_id = '<uuid>'
ORDER BY v.updated_at DESC;
```

Drizzle Studio: `bunx drizzle-kit studio` (브라우저에서 DB 탐색).

## 5. 롤백 절차

### 코드 롤백
- Vercel: Dashboard → Deployments → 이전 성공 배포 → "Promote to Production"

### DB 마이그레이션 롤백
- Drizzle 은 down 마이그레이션을 자동 생성하지 않음. 손으로 역방향 SQL 작성 후 적용 필요.
- 컬럼 추가는 안전. 컬럼 삭제 / 타입 변경은 사전에 백업 권장.

### 시크릿 노출 시
1. 즉시 해당 서비스 (Clerk / Mux / Upstash / OpenAI / UploadThing) 콘솔에서 키 회전
2. 새 값으로 `.env.local` / 배포 플랫폼 env 갱신
3. webhook signing secret 도 동시에 회전 + endpoint 재등록
4. git 히스토리에 시크릿 흔적 있으면 `git filter-repo` 로 정리 + force push (팀과 사전 공유)

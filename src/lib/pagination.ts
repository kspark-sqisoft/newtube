/**
 * 모든 getMany* 프로시저가 동일하게 사용하는 커서 페이지네이션 마무리 헬퍼.
 *
 * 사용 패턴: limit + 1 만큼 조회한 결과를 받아서
 *   1) 다음 페이지 존재 여부 판정
 *   2) 마지막 한 개 잘라내기
 *   3) 마지막 row 의 지정한 키들로 nextCursor 구성
 *
 * @example
 *   const data = await db.select(...).limit(limit + 1);
 *   return paginate(data, limit, ["id", "updatedAt"]);
 */
export function paginate<T extends object, K extends keyof T>(
  rows: T[],
  limit: number,
  cursorKeys: K[],
): { items: T[]; nextCursor: Pick<T, K> | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, -1) : rows;

  if (!hasMore || items.length === 0) {
    return { items, nextCursor: null };
  }

  const last = items[items.length - 1];
  const nextCursor = Object.fromEntries(
    cursorKeys.map((k) => [k, last[k]]),
  ) as Pick<T, K>;

  return { items, nextCursor };
}

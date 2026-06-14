/** 검색어 trim 후 빈 문자열이면 undefined 반환 */
export function trimSearchQuery(query: string | null | undefined) {
  const trimmed = query?.trim();
  return trimmed ? trimmed : undefined;
}

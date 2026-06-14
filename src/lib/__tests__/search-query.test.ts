import { describe, expect, it } from "vitest";

import { trimSearchQuery } from "@/lib/search-query";

describe("trimSearchQuery", () => {
  it("공백만 있으면 undefined를 반환한다", () => {
    expect(trimSearchQuery("   ")).toBeUndefined();
  });

  it("null/undefined는 undefined를 반환한다", () => {
    expect(trimSearchQuery(null)).toBeUndefined();
    expect(trimSearchQuery(undefined)).toBeUndefined();
  });

  it("유효한 검색어는 trim해서 반환한다", () => {
    expect(trimSearchQuery("  hello  ")).toBe("hello");
  });
});

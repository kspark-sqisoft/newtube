import { describe, expect, it } from "vitest";

import { formatClerkName } from "@/lib/clerk-utils";

describe("formatClerkName", () => {
  it("first/last name을 공백으로 이어 붙인다", () => {
    expect(
      formatClerkName({ first_name: "Jane", last_name: "Doe" }),
    ).toBe("Jane Doe");
  });

  it("null name은 제외한다", () => {
    expect(formatClerkName({ first_name: "Jane", last_name: null })).toBe(
      "Jane",
    );
  });

  it("둘 다 없으면 User를 반환한다", () => {
    expect(formatClerkName({ first_name: null, last_name: null })).toBe(
      "User",
    );
  });
});

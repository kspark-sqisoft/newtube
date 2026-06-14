import { describe, expect, it } from "vitest";

import { canAccessVideo } from "@/lib/video-access";

describe("canAccessVideo", () => {
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const viewerId = "00000000-0000-4000-8000-000000000002";

  it("public 영상은 누구나 접근 가능하다", () => {
    expect(
      canAccessVideo({
        visibility: "public",
        ownerId,
        viewerId: null,
      }),
    ).toBe(true);
  });

  it("private 영상은 업로더만 접근 가능하다", () => {
    expect(
      canAccessVideo({
        visibility: "private",
        ownerId,
        viewerId: ownerId,
      }),
    ).toBe(true);

    expect(
      canAccessVideo({
        visibility: "private",
        ownerId,
        viewerId,
      }),
    ).toBe(false);

    expect(
      canAccessVideo({
        visibility: "private",
        ownerId,
        viewerId: null,
      }),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { cn, formatDuration, snakeCaseToTitleCase } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("filters falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("handles conditional objects", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });
});

describe("formatDuration", () => {
  it("formats 0 to 00: 00", () => {
    expect(formatDuration(0)).toBe("00: 00");
  });

  it("formats sub-minute milliseconds", () => {
    expect(formatDuration(45_000)).toBe("00: 45");
  });

  it("formats exact minute", () => {
    expect(formatDuration(60_000)).toBe("01: 00");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125_500)).toBe("02: 05");
  });

  it("zero-pads minutes and seconds", () => {
    expect(formatDuration(9_000)).toBe("00: 09");
  });
});

describe("snakeCaseToTitleCase", () => {
  it("converts simple snake_case", () => {
    expect(snakeCaseToTitleCase("hello_world")).toBe("Hello World");
  });

  it("uppercases first letter of single word", () => {
    expect(snakeCaseToTitleCase("video")).toBe("Video");
  });

  it("handles multiple underscores", () => {
    expect(snakeCaseToTitleCase("user_profile_settings")).toBe(
      "User Profile Settings",
    );
  });

  it("returns empty string unchanged", () => {
    expect(snakeCaseToTitleCase("")).toBe("");
  });
});

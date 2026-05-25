import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs errors with stack from Error instance", () => {
    const err = new Error("boom");
    logger.error("Operation failed", err, { operation: "test" });

    expect(console.error).toHaveBeenCalledOnce();
    const [label, context] = (console.error as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(label).toContain("Operation failed");
    expect(context).toMatchObject({
      operation: "test",
      error: "boom",
    });
    expect(context.stack).toBeDefined();
  });

  it("warn always outputs", () => {
    logger.warn("careful", { x: 1 });
    expect(console.warn).toHaveBeenCalledOnce();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useIsMobile } from "@/hooks/use-mobile";

// matchMedia 가 변경될 때 콜백을 호출할 수 있도록 모킹
function setupMatchMedia(initialMatches: boolean) {
  let listener: ((ev: MediaQueryListEvent) => void) | null = null;

  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: initialMatches,
      media: query,
      onchange: null,
      addEventListener: (_: string, cb: (ev: MediaQueryListEvent) => void) => {
        listener = cb;
      },
      removeEventListener: () => {
        listener = null;
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );

  return {
    fire: (matches: boolean) => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: matches ? 500 : 1024,
      });
      listener?.({ matches } as MediaQueryListEvent);
    },
    setWidth: (w: number) =>
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: w,
      }),
  };
}

describe("useIsMobile", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false on desktop width", () => {
    const ctl = setupMatchMedia(false);
    ctl.setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true on mobile width", () => {
    const ctl = setupMatchMedia(true);
    ctl.setWidth(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("reacts to media query changes", () => {
    const ctl = setupMatchMedia(false);
    ctl.setWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      ctl.fire(true);
    });
    expect(result.current).toBe(true);
  });
});

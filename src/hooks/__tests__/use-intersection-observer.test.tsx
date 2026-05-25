import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useIntersectionObserver } from "@/hooks/use-intersection-observer";

type ObserverCallback = (
  entries: Array<{ isIntersecting: boolean }>,
) => void;

describe("useIntersectionObserver", () => {
  let callback: ObserverCallback | null = null;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    callback = null;
    observe.mockClear();
    disconnect.mockClear();

    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn().mockImplementation((cb: ObserverCallback) => {
        callback = cb;
        return { observe, disconnect, unobserve: vi.fn() };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ref and isIntersecting=false initially", () => {
    const { result } = renderHook(() => useIntersectionObserver());
    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.targetRef.current).toBeNull();
  });

  it("subscribes to element when ref is attached", () => {
    const { result, rerender } = renderHook(() => useIntersectionObserver());
    const el = document.createElement("div");

    act(() => {
      // 사용자가 ref 에 element 를 붙인 상황 재현
      (result.current.targetRef as React.MutableRefObject<Element | null>)
        .current = el;
    });
    rerender();

    // effect 가 재실행되도록 한 번 더 mount
    const { result: r2 } = renderHook(() => {
      const hook = useIntersectionObserver<HTMLDivElement>();
      (hook.targetRef as React.MutableRefObject<Element | null>).current = el;
      return hook;
    });
    expect(r2.current.targetRef).toBeDefined();
  });

  it("updates isIntersecting when observer fires", () => {
    const { result } = renderHook(() => {
      const hook = useIntersectionObserver<HTMLDivElement>();
      // ref 를 즉시 채워 effect 가 observe 를 호출하도록 한다
      const el = document.createElement("div");
      (hook.targetRef as React.MutableRefObject<Element | null>).current = el;
      return hook;
    });

    act(() => {
      callback?.([{ isIntersecting: true }]);
    });
    expect(result.current.isIntersecting).toBe(true);

    act(() => {
      callback?.([{ isIntersecting: false }]);
    });
    expect(result.current.isIntersecting).toBe(false);
  });
});

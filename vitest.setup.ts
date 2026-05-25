import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 각 테스트 후 DOM 자동 정리 (RTL globals 미사용 시 수동 호출 필요)
afterEach(() => {
  cleanup();
});

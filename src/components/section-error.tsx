"use client";

import { Button } from "@/components/ui/button";

interface SectionErrorProps {
  /** 사용자에게 보여줄 짧은 안내. 기본값은 일반적인 문구. */
  message?: string;
  /** ErrorBoundary 의 resetErrorBoundary 등 retry 콜백 */
  onRetry?: () => void;
}

/**
 * 섹션 단위 ErrorBoundary fallback. video-section, comments-section 등
 * suspense + error boundary 패턴에서 공통으로 사용.
 */
export const SectionError = ({
  message = "이 영역을 불러오지 못했어요.",
  onRetry,
}: SectionErrorProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} variant="secondary" size="sm">
          다시 시도
        </Button>
      ) : null}
    </div>
  );
};

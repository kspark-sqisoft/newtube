"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const Error = ({ error, reset }: ErrorProps) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">문제가 발생했어요</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 새로고침해 보세요.
      </p>
      <Button onClick={reset} variant="default">
        다시 시도
      </Button>
    </div>
  );
};

export default Error;

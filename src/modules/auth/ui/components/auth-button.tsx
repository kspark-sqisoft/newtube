"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton, SignInButton, useUser, useClerk } from "@clerk/nextjs";
import { ClapperboardIcon, UserCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

export const AuthButton = () => {
  const { isLoaded, user } = useUser();
  const clerk = useClerk();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 클라이언트 마운트 및 Clerk 로딩 확인
  if (!mounted || !isLoaded || !clerk.loaded) {
    return <Skeleton className="size-8 rounded-full" />;
  }

  if (user) {
    return (
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Link
            href="/studio"
            label="Studio"
            labelIcon={<ClapperboardIcon className="size-4" />}
          />
        </UserButton.MenuItems>
      </UserButton>
    );
  }

  return (
    <SignInButton mode="modal">
      <Button
        variant="outline"
        className="px-4 py-2 font-medium hover:text-blue-500 border-blue-500/2 rounded-full shadow-none"
      >
        <UserCircleIcon className="size-4" />
        Sign in
      </Button>
    </SignInButton>
  );
};

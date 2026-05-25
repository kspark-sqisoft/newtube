import "server-only"; // <-- ensure this file cannot be imported from the client
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { cache } from "react";
import { createCallerFactory, createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

//서버 컴포넌트에서는 trpc.xxx.prefetch() 등으로 데이터 채운 뒤, HydrateClient로 감싸서 클라이언트에 전달합니다.
//"server-only"로 클라이언트 번들에 포함되지 않도록 함.
export const getQueryClient = cache(makeQueryClient);
const caller = createCallerFactory(appRouter)(createTRPCContext);
export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  caller,
  getQueryClient
);

// generateMetadata 등 서버 측에서 직접 procedure 를 호출할 때 사용.
export const createCaller = async () => caller;

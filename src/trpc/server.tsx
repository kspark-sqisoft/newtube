import "server-only";
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { cache } from "react";
import {
  createCallerFactory,
  createPublicTRPCContext,
  createTRPCContext,
} from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

export const getQueryClient = cache(makeQueryClient);
const caller = createCallerFactory(appRouter)(createTRPCContext);
const publicCaller = createCallerFactory(appRouter)(createPublicTRPCContext);

export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  caller,
  getQueryClient,
);

/** auth 불필요한 공개 페이지 prefetch용 (홈, 트렌딩, 검색) */
export const { trpc: publicTrpc } = createHydrationHelpers<typeof appRouter>(
  publicCaller,
  getQueryClient,
);

export const createCaller = async () => caller;
export const createPublicCaller = async () => publicCaller;

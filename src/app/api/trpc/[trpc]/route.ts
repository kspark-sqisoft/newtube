import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";
//Next App Router의 Route Handler에서 tRPC 요청을 받습니다.
//클라이언트는 /api/trpc로 요청하고, 이 파일이 서버 라우터와 연결합니다.
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });
export { handler as GET, handler as POST };

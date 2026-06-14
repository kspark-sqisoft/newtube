import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { cache } from "react";
import superjson from "superjson";
import { ratelimit } from "@/lib/ratelimit";

//tRPC 서버 초기화

// Clerk userId + DB user를 같이 캐시. cache()는 요청당 한 번만 실행.
export const createTRPCContext = cache(async () => {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return { clerkUserId: null, user: null };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  return { clerkUserId, user: user ?? null };
});

// 공개 데이터 prefetch용 — auth() 호출 없이 static 렌더링 가능
export const createPublicTRPCContext = cache(async () => ({
  clerkUserId: null,
  user: null,
}));

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// tRPC 인스턴스 생성
const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // prod 에서는 INTERNAL_SERVER_ERROR 메시지가 클라이언트로 새지 않게 sanitize.
    // zod 등의 BAD_REQUEST 메시지는 그대로 유지 (UX 위해 필요).
    const isProd = process.env.NODE_ENV === "production";
    if (isProd && error.code === "INTERNAL_SERVER_ERROR") {
      return {
        ...shape,
        message: "Internal server error",
        data: { ...shape.data, stack: undefined },
      };
    }
    return shape;
  },
});

// 라우터/프로시저 헬퍼
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// 인증 필요한 프로시저
export const protectedProcedure = t.procedure.use(
  async function isAuthed(opts) {
    const { ctx } = opts;

    if (!ctx.clerkUserId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You are not authorized to access this resource",
      });
    }

    if (!ctx.user) {
      // Clerk 인증은 되었으나 DB에 user 행 없음 (webhook 누락 등)
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found in database",
      });
    }

    // mutation 만 rate limit. 키에 procedure path 를 포함시켜
    // "댓글 스팸 한 번에 비디오 삭제까지 차단" 같은 오작동을 방지.
    if (opts.type === "mutation") {
      const { success } = await ratelimit.limit(`${ctx.user.id}:${opts.path}`);
      if (!success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
      }
    }

    return opts.next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  },
);

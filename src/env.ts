import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_SIGNING_SECRET: z.string().min(1),

  MUX_TOKEN_ID: z.string().min(1),
  MUX_TOKEN_SECRET: z.string().min(1),
  MUX_WEBHOOK_SECRET: z.string().min(1),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  QSTASH_TOKEN: z.string().min(1),
  UPSTASH_WORKFLOW_URL: z.string().url(),

  OPENAI_API_KEY: z.string().min(1),

  UPLOADTHING_TOKEN: z.string().min(1).optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const isServer = typeof window === "undefined";

const parsedClient = clientEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

if (!parsedClient.success) {
  console.error(
    "Invalid public environment variables:",
    parsedClient.error.flatten().fieldErrors,
  );
  throw new Error("Invalid public environment variables");
}

let parsedServer: z.infer<typeof serverEnvSchema> | undefined;

if (isServer) {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid server environment variables:",
      result.error.flatten().fieldErrors,
    );
    throw new Error("Invalid server environment variables");
  }
  parsedServer = result.data;
}

export const env = new Proxy(
  {
    ...parsedClient.data,
    ...(parsedServer ?? {}),
  } as z.infer<typeof clientEnvSchema> & z.infer<typeof serverEnvSchema>,
  {
    get(target, prop: string) {
      if (
        !isServer &&
        prop in serverEnvSchema.shape &&
        !(prop in clientEnvSchema.shape)
      ) {
        throw new Error(
          `Attempted to access server-only env "${prop}" from the client`,
        );
      }
      return Reflect.get(target, prop);
    },
  },
);

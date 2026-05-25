import { Client } from "@upstash/workflow";

import { env } from "@/env";

export const workflow = new Client({ token: env.QSTASH_TOKEN });
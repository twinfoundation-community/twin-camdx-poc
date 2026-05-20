import { z } from "zod";

const schema = z.object({
  XROAD_PLAYGROUND_BASE_URL: z
    .string()
    .url()
    .default("http://testcomss01.playground.x-road.systems"),
  XROAD_PLAYGROUND_AUTH_USER: z.string().optional(),
  XROAD_PLAYGROUND_AUTH_PASS: z.string().optional(),
  XROAD_CLIENT_IDENTIFIER: z
    .string()
    .default("PLAYGROUND/COM/1234567-8/TestClient"),
  XROAD_SERVICE_IDENTIFIER: z
    .string()
    .default("PLAYGROUND/GOV/8765432-1/TestService/PTV"),

  TWIN_NODE_URL: z.string().url().optional(),
  TWIN_NODE_SERVICE_EMAIL: z.string().optional(),
  TWIN_NODE_SERVICE_PASSWORD: z.string().optional(),
  TWIN_NODE_ADMIN_DID: z.string().optional(),
  TWIN_NODE_ADMIN_ORG_DID: z.string().optional(),
  TWIN_NODE_ADMIN_SCOPE: z.string().optional(),
  TWIN_NODE_ASSERTION_VM_ID: z.string().default("camdx-demo"),
});

let cached: z.infer<typeof schema> | null = null;

export function getEnv(): z.infer<typeof schema> {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      throw new Error(
        `Invalid environment: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    }
    cached = result.data;
  }
  return cached;
}

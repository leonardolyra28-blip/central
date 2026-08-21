import { getOpenAIConfig } from "@/db/runtime";
import { ensureSchema } from "@/db/ensure";
import { authorizeWorkspace } from "@/db/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const authorization = await authorizeWorkspace("ai:read");
  if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
  const { apiKey, model } = getOpenAIConfig();
  return Response.json({
    configured: Boolean(apiKey),
    authenticated: true,
    model,
    endpoint: "/api/ai/chat",
    api: "OpenAI Responses API",
    streaming: true,
    functionCalling: true,
    mode: "Somente leitura",
    keyLocation: "Servidor",
    checkedAt: new Date().toISOString(),
  });
}

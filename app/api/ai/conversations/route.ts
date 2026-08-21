import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { authorizeWorkspace } from "@/db/permissions";
import { aiConversations, aiMessages } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureSchema();
  const authorization = await authorizeWorkspace("ai:read");
  if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
  const user = authorization.user;
  const db = getDb();
  const conversations = await db.select().from(aiConversations).where(and(eq(aiConversations.ownerEmail, user.email), eq(aiConversations.status, "Ativa"))).orderBy(desc(aiConversations.updatedAt));
  const requestedId = Number(new URL(request.url).searchParams.get("id"));
  const current = requestedId ? conversations.find((item) => item.id === requestedId) : conversations[0];
  const messages = current ? await db.select().from(aiMessages).where(eq(aiMessages.conversationId, current.id)).orderBy(aiMessages.createdAt) : [];
  return Response.json({ conversations, currentConversationId: current?.id || null, messages });
}

export async function POST(request: Request) {
  await ensureSchema();
  const authorization = await authorizeWorkspace("ai:read");
  if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
  const user = authorization.user;
  const payload = await request.json().catch(() => ({})) as { title?: string };
  const title = payload.title?.trim().slice(0, 80) || "Nova conversa";
  const [record] = await getDb().insert(aiConversations).values({ title, ownerEmail: user.email }).returning();
  return Response.json({ record }, { status: 201 });
}

export async function PATCH(request: Request) {
  await ensureSchema();
  const authorization = await authorizeWorkspace("ai:read");
  if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
  const user = authorization.user;
  const payload = await request.json() as { id?: number; title?: string };
  const title = payload.title?.trim().slice(0, 80);
  if (!payload.id || !title) return Response.json({ error: "Conversa inválida." }, { status: 400 });
  const [record] = await getDb().update(aiConversations).set({ title, updatedAt: new Date().toISOString() }).where(and(eq(aiConversations.id, payload.id), eq(aiConversations.ownerEmail, user.email))).returning();
  if (!record) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  return Response.json({ record });
}

export async function DELETE(request: Request) {
  await ensureSchema();
  const authorization = await authorizeWorkspace("ai:read");
  if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
  const user = authorization.user;
  const payload = await request.json() as { id?: number; confirmed?: boolean };
  if (!payload.id || payload.confirmed !== true) return Response.json({ error: "Confirme explicitamente o arquivamento da conversa." }, { status: 400 });
  await getDb().update(aiConversations).set({ status: "Arquivada", updatedAt: new Date().toISOString() }).where(and(eq(aiConversations.id, payload.id), eq(aiConversations.ownerEmail, user.email)));
  return Response.json({ ok: true });
}

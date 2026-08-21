import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { getBucket } from "@/db/runtime";
import { authorizeWorkspace } from "@/db/permissions";
import { auditLogs, documents, documentVersions } from "@/db/schema";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const allowedExtensions = new Set(["xlsx", "xls", "csv", "pdf", "docx", "png", "jpg", "jpeg", "webp"]);
const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value.trim() : "";
const ownsDocument = (uploadedBy: string, user: { email: string; displayName: string }) => uploadedBy === user.email || uploadedBy === user.displayName;

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-140) || "arquivo";
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const authorization = await authorizeWorkspace("documents:read");
    if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
    const user = authorization.user;
    const id = Number(new URL(request.url).searchParams.get("id"));
    const db = getDb();
    if (!id) {
      const records = await db.select().from(documents).orderBy(desc(documents.updatedAt));
      return Response.json({ documents: records.filter((record) => record.visibility !== "Privado" || ownsDocument(record.uploadedBy, user)) });
    }
    const record = (await db.select().from(documents).where(eq(documents.id, id)).limit(1))[0];
    if (!record || record.status === "Excluído" || (record.visibility === "Privado" && !ownsDocument(record.uploadedBy, user))) return Response.json({ error: "Documento não encontrado." }, { status: 404 });
    const object = await getBucket().get(record.objectKey);
    if (!object) return Response.json({ error: "Arquivo não encontrado no armazenamento." }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": record.mimeType,
        "Content-Length": String(record.size),
        "Content-Disposition": `inline; filename="${safeFileName(record.fileName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao acessar o documento." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const authorization = await authorizeWorkspace("documents:write");
    if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
    const user = authorization.user;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Selecione um arquivo." }, { status: 400 });
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedExtensions.has(extension)) return Response.json({ error: "Formato não permitido. Use XLSX, XLS, CSV, PDF, DOCX ou imagem." }, { status: 415 });
    if (!file.size || file.size > MAX_FILE_SIZE) return Response.json({ error: "O arquivo deve ter até 15 MB." }, { status: 413 });
    const previewData = text(form.get("previewData"));
    if (previewData.length > 120_000) return Response.json({ error: "A prévia do arquivo ultrapassou o limite permitido." }, { status: 413 });
    const db = getDb();
    const documentId = Number(text(form.get("documentId"))) || 0;
    const existing = documentId ? (await db.select().from(documents).where(eq(documents.id, documentId)).limit(1))[0] : null;
    if (documentId && !existing) return Response.json({ error: "Documento original não encontrado." }, { status: 404 });
    if (existing?.visibility === "Privado" && !ownsDocument(existing.uploadedBy, user)) return Response.json({ error: "Documento original não encontrado." }, { status: 404 });
    const version = existing ? existing.version + 1 : 1;
    const objectKey = `documents/${existing?.id || "new"}/${crypto.randomUUID()}-v${version}-${safeFileName(file.name)}`;
    await getBucket().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    let record;
    if (existing) {
      [record] = await db.update(documents).set({
        objectKey,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        category: text(form.get("category")) || existing.category,
        description: text(form.get("description")),
        visibility: text(form.get("visibility")) || existing.visibility,
        linkedEntity: text(form.get("linkedEntity")),
        linkedRecordId: Number(text(form.get("linkedRecordId"))) || null,
        previewData,
        uploadedBy: user.email,
        version,
        status: "Disponível",
        updatedAt: new Date().toISOString(),
      }).where(eq(documents.id, documentId)).returning();
    } else {
      [record] = await db.insert(documents).values({
        objectKey,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        category: text(form.get("category")) || "Geral",
        description: text(form.get("description")),
        visibility: text(form.get("visibility")) || "Equipe",
        linkedEntity: text(form.get("linkedEntity")),
        linkedRecordId: Number(text(form.get("linkedRecordId"))) || null,
        previewData,
        uploadedBy: user.email,
      }).returning();
    }
    await db.insert(documentVersions).values({ documentId: record.id, objectKey, version, size: file.size, uploadedBy: user.email });
    await db.insert(auditLogs).values({ actor: user.displayName, action: existing ? "versionou" : "enviou", entity: "documento", recordId: record.id, detail: `${file.name} salvo na versão ${version}.` });
    return Response.json({ record }, { status: existing ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao enviar documento." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const authorization = await authorizeWorkspace("documents:write");
    if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
    const user = authorization.user;
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!id) return Response.json({ error: "Documento inválido." }, { status: 400 });
    const db = getDb();
    const current = (await db.select().from(documents).where(eq(documents.id, id)).limit(1))[0];
    if (!current || (current.visibility === "Privado" && !ownsDocument(current.uploadedBy, user))) return Response.json({ error: "Documento não encontrado." }, { status: 404 });
    const [record] = await db.update(documents).set({
      category: typeof payload.category === "string" ? payload.category.trim() : "Geral",
      description: typeof payload.description === "string" ? payload.description.trim() : "",
      visibility: payload.visibility === "Privado" ? "Privado" : "Equipe",
      linkedEntity: typeof payload.linkedEntity === "string" ? payload.linkedEntity.trim() : "",
      linkedRecordId: Number(payload.linkedRecordId) || null,
      updatedAt: new Date().toISOString(),
    }).where(eq(documents.id, id)).returning();
    await db.insert(auditLogs).values({ actor: user.displayName, action: "atualizou", entity: "documento", recordId: id, detail: `Metadados de ${record.fileName} atualizados.` });
    return Response.json({ record });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao editar documento." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const authorization = await authorizeWorkspace("documents:delete");
    if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
    const user = authorization.user;
    const payload = await request.json() as { id?: number; confirmed?: boolean };
    if (!payload.id || payload.confirmed !== true) return Response.json({ error: "Confirme explicitamente a exclusão do documento." }, { status: 400 });
    const db = getDb();
    const record = (await db.select().from(documents).where(eq(documents.id, payload.id)).limit(1))[0];
    if (!record || (record.visibility === "Privado" && !ownsDocument(record.uploadedBy, user))) return Response.json({ error: "Documento não encontrado." }, { status: 404 });
    await getBucket().delete(record.objectKey);
    await db.update(documents).set({ status: "Excluído", updatedAt: new Date().toISOString() }).where(eq(documents.id, record.id));
    await db.insert(auditLogs).values({ actor: user.displayName, action: "excluiu", entity: "documento", recordId: record.id, detail: `${record.fileName} foi removido do armazenamento.` });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao excluir documento." }, { status: 500 });
  }
}

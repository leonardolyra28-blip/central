export type CentralR2Bucket = {
  get(key: string): Promise<{ body: ReadableStream<Uint8Array> } | null>;
  put(key: string, body: ReadableStream<Uint8Array>, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<unknown>;
};

type CentralRuntime = typeof globalThis & {
  __CENTRAL_BUCKET__?: CentralR2Bucket;
  __CENTRAL_OPENAI_API_KEY__?: string;
  __CENTRAL_OPENAI_MODEL__?: string;
  __CENTRAL_BOOTSTRAP_ADMIN_EMAILS__?: string;
  __CENTRAL_MEMBER_EMAILS__?: string;
  __CENTRAL_TEMPORARY_OPEN_ACCESS__?: string;
};

export function getBucket(): CentralR2Bucket {
  const bucket = (globalThis as CentralRuntime).__CENTRAL_BUCKET__;
  if (!bucket) throw new Error("Armazenamento de documentos indisponível para esta solicitação.");
  return bucket;
}

export function getOpenAIConfig() {
  const runtime = globalThis as CentralRuntime;
  return {
    apiKey: runtime.__CENTRAL_OPENAI_API_KEY__ || "",
    model: runtime.__CENTRAL_OPENAI_MODEL__ || "gpt-5-mini",
  };
}

export function getAccessConfig() {
  const runtime = globalThis as CentralRuntime;
  return {
    bootstrapAdminEmails: runtime.__CENTRAL_BOOTSTRAP_ADMIN_EMAILS__ || "",
    memberEmails: runtime.__CENTRAL_MEMBER_EMAILS__ || "",
    temporaryOpenAccess: runtime.__CENTRAL_TEMPORARY_OPEN_ACCESS__ === "true",
  };
}

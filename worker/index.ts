/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import type { CentralR2Bucket } from "../db/runtime";

type AssetFetcher = { fetch(request: Request): Promise<Response> };

interface Env {
  ASSETS: AssetFetcher;
  DB: unknown;
  BUCKET: CentralR2Bucket;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  CENTRAL_BOOTSTRAP_ADMIN_EMAILS?: string;
  CENTRAL_MEMBER_EMAILS?: string;
  CENTRAL_TEMPORARY_OPEN_ACCESS?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const runtime = globalThis as typeof globalThis & {
      __CENTRAL_DB__?: unknown;
      __CENTRAL_BUCKET__?: CentralR2Bucket;
      __CENTRAL_OPENAI_API_KEY__?: string;
      __CENTRAL_OPENAI_MODEL__?: string;
      __CENTRAL_BOOTSTRAP_ADMIN_EMAILS__?: string;
      __CENTRAL_MEMBER_EMAILS__?: string;
      __CENTRAL_TEMPORARY_OPEN_ACCESS__?: string;
    };
    runtime.__CENTRAL_DB__ = env.DB;
    runtime.__CENTRAL_BUCKET__ = env.BUCKET;
    runtime.__CENTRAL_OPENAI_API_KEY__ = env.OPENAI_API_KEY;
    runtime.__CENTRAL_OPENAI_MODEL__ = env.OPENAI_MODEL;
    runtime.__CENTRAL_BOOTSTRAP_ADMIN_EMAILS__ = env.CENTRAL_BOOTSTRAP_ADMIN_EMAILS;
    runtime.__CENTRAL_MEMBER_EMAILS__ = env.CENTRAL_MEMBER_EMAILS;
    runtime.__CENTRAL_TEMPORARY_OPEN_ACCESS__ = env.CENTRAL_TEMPORARY_OPEN_ACCESS;
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

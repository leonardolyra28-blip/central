import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type D1Binding = Parameters<typeof drizzle>[0];

export function getRawDb(): D1Binding {
  const binding = (globalThis as typeof globalThis & { __CENTRAL_DB__?: D1Binding })
    .__CENTRAL_DB__;
  if (!binding) {
    throw new Error("Banco de dados indisponível para esta solicitação.");
  }
  return binding;
}

export function getDb() {
  return drizzle(getRawDb(), { schema });
}

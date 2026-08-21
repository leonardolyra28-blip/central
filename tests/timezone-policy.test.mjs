import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadTimezoneModule() {
  const source = await readFile(new URL("../app/timezone.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

test("calendar wall-clock values remain in Horário de Brasília", async () => {
  const timezone = await loadTimezoneModule();
  const instant = timezone.parseCentralWallDateTime("2026-08-15T09:00");
  assert.equal(instant.toISOString(), "2026-08-15T12:00:00.000Z");
  assert.equal(timezone.toCentralDateTime(instant), "2026-08-15T09:00");
});

test("UTC database timestamps are rendered in São Paulo without a two-hour drift", async () => {
  const timezone = await loadTimezoneModule();
  assert.equal(
    timezone.formatCentralTimestamp("2026-08-15 12:00:00", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    "09:00",
  );
});

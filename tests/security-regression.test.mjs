import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the application and workspace API deny anonymous access", async () => {
  const [page, workspace, permissions] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/workspace/route.ts"),
    read("db/permissions.ts"),
  ]);

  assert.match(page, /requireChatGPTUser\("\/"\)/);
  assert.match(workspace, /authorizeWorkspace\("workspace:read"\)/);
  assert.match(workspace, /authorizeWorkspace\(permissionFor\(entity, "POST"\)\)/);
  assert.match(workspace, /authorizeWorkspace\(permissionFor\(entity, "PATCH"\)\)/);
  assert.match(workspace, /authorizeWorkspace\(permissionFor\(entity, "DELETE"\)\)/);
  assert.doesNotMatch(workspace, /return "Equipe comercial"/);
  assert.match(permissions, /if \(!member\) return \{ allowed: false/);
  assert.match(permissions, /parseEmailList\(bootstrapAdminEmails\)\.has\(email\)/);
  assert.doesNotMatch(permissions, /if \(!configured\) return \{ allowed: true/);
});

test("the authorized team is limited to Lyra and Matheus", async () => {
  const [schemaSetup, teamUi] = await Promise.all([
    read("db/ensure.ts"),
    read("app/expansion-modules.tsx"),
  ]);

  assert.match(schemaSetup, /DELETE FROM team_members WHERE lower\(trim\(name\)\) = 'bianca'/);
  assert.doesNotMatch(schemaSetup, /VALUES \(3, 'Integrante 3'/);
  assert.match(teamUi, /Equipe autorizada/);
  assert.doesNotMatch(teamUi, /Equipe de três integrantes/);
});

test("OpenAI routes are protected and provider errors stay server-side", async () => {
  const [chat, status] = await Promise.all([
    read("app/api/ai/chat/route.ts"),
    read("app/api/ai/status/route.ts"),
  ]);

  assert.match(status, /authorizeWorkspace\("ai:read"\)/);
  assert.match(chat, /tool_choice: "auto"/);
  assert.match(chat, /strict: true/g);
  assert.doesNotMatch(chat, /detail:\s*(?:first|final|provider|openai)/i);
  assert.match(chat, /incidentId/);
});

test("calendar conflicts include every participant", async () => {
  const workspace = await read("app/api/workspace/route.ts");
  assert.match(workspace, /findCalendarConflicts/);
  assert.match(workspace, /eventParticipants\.memberId/);
  assert.match(workspace, /linkedEventIds\.has\(event\.id\)/);
});

import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from ".";
import { teamMembers } from "./schema";
import { getAccessConfig } from "./runtime";

export type WorkspacePermission =
  | "workspace:read"
  | "commercial:write"
  | "commercial:delete"
  | "calendar:read"
  | "calendar:write"
  | "documents:read"
  | "documents:write"
  | "documents:delete"
  | "ai:read"
  | "team:write"
  | "settings:write";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

function parseEmailList(value: string) {
  return new Set(value.split(/[;,\n]/).map(normalizeEmail).filter(Boolean));
}

function parseMemberEmailMap(value: string) {
  const result = new Map<string, string>();
  for (const entry of value.split(/[;\n]/)) {
    const separator = entry.indexOf("=");
    if (separator < 1) continue;
    const name = entry.slice(0, separator).trim().toLowerCase();
    const email = normalizeEmail(entry.slice(separator + 1));
    if (name && email) result.set(email, name);
  }
  return result;
}

function hasPermission(role: string, declared: string, permission: WorkspacePermission) {
  if (role === "Administrador") return true;
  if (permission === "workspace:read") return true;
  if (permission === "commercial:write") return role === "Vendedor";
  if (permission === "commercial:delete" || permission === "team:write" || permission === "settings:write") return false;
  const permissions = new Set(declared.split(",").map((item) => item.trim()).filter(Boolean));
  if (permissions.has(permission)) return true;
  if (permission === "calendar:read" && permissions.has("calendar:write")) return true;
  if (permission === "documents:read" && permissions.has("documents:write")) return true;
  return false;
}

export async function authorizeWorkspace(permission: WorkspacePermission) {
  const user = await getChatGPTUser();
  if (!user) return { allowed: false as const, status: 401, error: "Entre com o ChatGPT para realizar esta ação.", user: null, member: null };
  const members = await getDb().select().from(teamMembers);
  const active = members.filter((member) => member.status === "Ativo");
  const { bootstrapAdminEmails, memberEmails, temporaryOpenAccess } = getAccessConfig();
  const email = normalizeEmail(user.email);
  const mappedName = parseMemberEmailMap(memberEmails).get(email);
  const member = active.find((item) =>
    (item.email && normalizeEmail(item.email) === email) ||
    (mappedName && item.name.trim().toLowerCase() === mappedName),
  ) || null;
  const configured = active.filter((item) => item.email).length > 0 || Boolean(memberEmails.trim());
  if (!configured && parseEmailList(bootstrapAdminEmails).has(email)) {
    const bootstrapMember = active.find((item) => item.role === "Administrador") || active[0] || null;
    return { allowed: true as const, status: 200, error: "", user, member: bootstrapMember };
  }
  if (!member && temporaryOpenAccess) {
    const temporaryPermissions = new Set<WorkspacePermission>([
      "workspace:read", "commercial:write", "calendar:read", "calendar:write",
      "documents:read", "documents:write", "ai:read",
    ]);
    if (!temporaryPermissions.has(permission)) return { allowed: false as const, status: 403, error: "Esta ação administrativa exige um integrante identificado.", user, member: null };
    return { allowed: true as const, status: 200, error: "", user, member: null };
  }
  if (!member) return { allowed: false as const, status: 403, error: "Seu e-mail ainda não está vinculado a um integrante ativo da equipe.", user, member: null };
  if (!hasPermission(member.role, member.permissions, permission)) return { allowed: false as const, status: 403, error: "Seu perfil não possui permissão para esta ação.", user, member };
  return { allowed: true as const, status: 200, error: "", user, member };
}

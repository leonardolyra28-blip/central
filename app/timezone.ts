export const CENTRAL_TIME_ZONE = "America/Sao_Paulo";

const hasExplicitTimeZone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

function partsInCentral(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTRAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function toCentralDateTime(date = new Date()) {
  const parts = partsInCentral(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function toCentralDate(date = new Date()) {
  return toCentralDateTime(date).slice(0, 10);
}

/** Parses a calendar wall-clock value that was entered in Horário de Brasília. */
export function parseCentralWallDateTime(value: string) {
  if (!value) return new Date(Number.NaN);
  if (hasExplicitTimeZone(value)) return new Date(value);
  const normalized = value.trim().replace(" ", "T");
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  return new Date(`${withSeconds}-03:00`);
}

/** Parses database timestamps. SQLite CURRENT_TIMESTAMP values are UTC but have no suffix. */
export function parseStoredTimestamp(value: string) {
  if (!value) return new Date(Number.NaN);
  if (hasExplicitTimeZone(value)) return new Date(value);
  return new Date(`${value.trim().replace(" ", "T")}Z`);
}

export function formatCentralTimestamp(
  value: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
) {
  if (!value) return "—";
  const date = parseStoredTimestamp(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: CENTRAL_TIME_ZONE }).format(date);
}

export function formatCentralWallDateTime(
  value: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
) {
  if (!value) return "—";
  const date = parseCentralWallDateTime(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: CENTRAL_TIME_ZONE }).format(date);
}

export function centralDateFromTimestamp(value: string) {
  const date = parseStoredTimestamp(value);
  return Number.isNaN(date.getTime()) ? "" : toCentralDate(date);
}

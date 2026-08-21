import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { authorizeWorkspace, type WorkspacePermission } from "@/db/permissions";
import { getAccessConfig } from "@/db/runtime";
import {
  calendarEvents,
  documents,
  eventAuditLogs,
  eventParticipants,
  auditLogs,
  goals,
  importErrors,
  importedLeads,
  leadContactHistory,
  leadImportBatches,
  leadPipelineLinks,
  leads,
  niches,
  products,
  sales,
  settings,
  tasks,
  teamMembers,
} from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { toCentralDate } from "@/app/timezone";

export const dynamic = "force-dynamic";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const cleanPhone = (value: unknown) => text(value).replace(/\D/g, "");
const cleanEmail = (value: unknown) => text(value).toLowerCase();
const cleanKey = (value: unknown) => text(value).toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
const validContactStatus = (value: unknown) => {
  const status = text(value);
  return status.length > 0 && status.length <= 60;
};
const cleanCustomFields = (value: unknown) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "{}";
    return JSON.stringify(Object.fromEntries(Object.entries(parsed as Record<string, unknown>).slice(0, 50).map(([key, field]) => [key.slice(0, 80), String(field ?? "").slice(0, 2000)])));
  } catch {
    return "{}";
  }
};

async function actorName() {
  const user = await getChatGPTUser();
  if (!user) throw new Error("Uma ação autenticada tentou registrar um ator ausente.");
  return user.displayName || user.email;
}

function permissionFor(entity: string, method: "POST" | "PATCH" | "DELETE"): WorkspacePermission {
  if (entity === "teamMember") return "team:write";
  if (entity === "calendarEvent") return "calendar:write";
  if (entity === "setting") return "settings:write";
  return method === "DELETE" || entity === "bulkDeleteImportedLead" ? "commercial:delete" : "commercial:write";
}

function denied(authorization: Awaited<ReturnType<typeof authorizeWorkspace>>) {
  return Response.json({ error: authorization.error }, { status: authorization.status });
}

async function logAction(
  action: string,
  entity: string,
  recordId: number | null,
  detail: string,
) {
  const db = getDb();
  await db.insert(auditLogs).values({
    actor: await actorName(),
    action,
    entity,
    recordId,
    detail,
  });
}

function errorResponse(error: unknown) {
  const incidentId = crypto.randomUUID();
  console.error("Central workspace failure", { incidentId, error });
  return Response.json({ error: "Não foi possível concluir a operação.", incidentId }, { status: 500 });
}

async function findCalendarConflicts(
  startAt: string,
  endAt: string,
  participantIds: number[],
  excludeEventId?: number,
) {
  const db = getDb();
  const uniqueParticipants = Array.from(new Set(participantIds.filter(Boolean)));
  if (!uniqueParticipants.length) return [];
  const linked = await db
    .select({ eventId: eventParticipants.eventId })
    .from(eventParticipants)
    .where(inArray(eventParticipants.memberId, uniqueParticipants));
  const linkedEventIds = new Set(linked.map((item) => item.eventId));
  const candidates = await db.select().from(calendarEvents);
  return candidates.filter((event) =>
    event.id !== excludeEventId &&
    event.status !== "Cancelado" &&
    (uniqueParticipants.includes(event.ownerId) || linkedEventIds.has(event.id)) &&
    startAt < event.endAt &&
    endAt > event.startAt
  );
}

export async function GET() {
  try {
    await ensureSchema();
    const authorization = await authorizeWorkspace("workspace:read");
    if (!authorization.allowed) return denied(authorization);
    const db = getDb();
    const [productRows, leadRows, saleRows, taskRows, goalRows, settingRows, logRows, nicheRows, importedLeadRows, batchRows, importErrorRows, historyRows, memberRows, eventRows, participantRows, eventHistoryRows, documentRows] =
      await Promise.all([
        db.select().from(products).orderBy(desc(products.updatedAt)),
        db.select().from(leads).orderBy(desc(leads.updatedAt)),
        db.select().from(sales).orderBy(desc(sales.date), desc(sales.id)),
        db.select().from(tasks).orderBy(desc(tasks.updatedAt)),
        db.select().from(goals).orderBy(desc(goals.updatedAt)),
        db.select().from(settings),
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40),
        db.select().from(niches).orderBy(desc(niches.updatedAt)),
        db.select().from(importedLeads).orderBy(desc(importedLeads.updatedAt)),
        db.select().from(leadImportBatches).orderBy(desc(leadImportBatches.createdAt)).limit(30),
        db.select().from(importErrors).orderBy(desc(importErrors.createdAt)).limit(500),
        db.select().from(leadContactHistory).orderBy(desc(leadContactHistory.createdAt)).limit(200),
        db.select().from(teamMembers).orderBy(teamMembers.id),
        db.select().from(calendarEvents).orderBy(calendarEvents.startAt),
        db.select().from(eventParticipants),
        db.select().from(eventAuditLogs).orderBy(desc(eventAuditLogs.createdAt)).limit(100),
        db.select().from(documents).orderBy(desc(documents.updatedAt)),
      ]);

    const signedInUser = authorization.user;
    const { temporaryOpenAccess } = getAccessConfig();
    const currentMember = authorization.member;
    const canViewTeamAccess = currentMember?.role === "Administrador" || currentMember?.permissions.split(",").map((item) => item.trim()).includes("team:write");
    const visibleMembers = canViewTeamAccess
      ? memberRows
      : memberRows.map((member) => ({ ...member, email: "", permissions: "calendar:read,documents:read" }));
    const visibleEvents = eventRows.filter((event) =>
      event.visibility !== "Privado" || (currentMember && event.ownerId === currentMember.id),
    );
    const visibleDocuments = documentRows.filter((document) =>
      document.visibility !== "Privado" || document.uploadedBy === signedInUser.email || document.uploadedBy === signedInUser.displayName,
    );
    const visibleEventIds = new Set(visibleEvents.map((event) => event.id));

    return Response.json({
      products: productRows,
      leads: leadRows,
      sales: saleRows,
      tasks: taskRows,
      goals: goalRows,
      settings: Object.fromEntries(settingRows.map((item) => [item.key, item.value])),
      auditLogs: logRows,
      niches: nicheRows,
      importedLeads: importedLeadRows,
      importBatches: batchRows,
      importErrors: importErrorRows,
      contactHistory: historyRows,
      teamMembers: visibleMembers,
      calendarEvents: visibleEvents,
      eventParticipants: participantRows.filter((item) => visibleEventIds.has(item.eventId)),
      eventHistory: eventHistoryRows.filter((item) => visibleEventIds.has(item.eventId)),
      documents: visibleDocuments,
      currentMemberId: currentMember?.id || null,
      temporaryOpenAccess,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const entity = text(payload.entity);
    const authorization = await authorizeWorkspace(permissionFor(entity, "POST"));
    if (!authorization.allowed) return denied(authorization);
    const db = getDb();

    if (entity === "product") {
      const name = text(payload.name);
      if (!name) return Response.json({ error: "Informe o nome do produto." }, { status: 400 });
      const [record] = await db.insert(products).values({
        name,
        category: text(payload.category) || "Sem categoria",
        description: text(payload.description),
        price: number(payload.price),
        promotionalPrice: payload.promotionalPrice ? number(payload.promotionalPrice) : null,
        minimumPrice: number(payload.minimumPrice),
        cost: number(payload.cost),
        status: text(payload.status) || "Ativo",
        deliveryDays: number(payload.deliveryDays),
        targetAudience: text(payload.targetAudience),
        problemSolved: text(payload.problemSolved),
        salesArguments: text(payload.salesArguments),
        objections: text(payload.objections),
        notes: text(payload.notes),
      }).returning();
      await logAction("criou", "produto", record.id, `Produto ${record.name} criado.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "lead") {
      const name = text(payload.name);
      if (!name) return Response.json({ error: "Informe o nome do lead." }, { status: 400 });
      const [record] = await db.insert(leads).values({
        name,
        company: text(payload.company),
        phone: text(payload.phone),
        whatsapp: text(payload.whatsapp),
        email: text(payload.email),
        instagram: text(payload.instagram),
        site: text(payload.site),
        city: text(payload.city),
        segment: text(payload.segment),
        source: text(payload.source) || "Indicação",
        productInterest: text(payload.productInterest),
        responsible: text(payload.responsible),
        status: text(payload.status) || "Novo",
        potentialValue: number(payload.potentialValue),
        firstContact: text(payload.firstContact),
        lastContact: text(payload.lastContact),
        nextFollowup: text(payload.nextFollowup),
        notes: text(payload.notes),
      }).returning();
      await logAction("criou", "lead", record.id, `Lead ${record.name} adicionado.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "sale") {
      const client = text(payload.client);
      const productName = text(payload.productName);
      if (!client || !productName) {
        return Response.json({ error: "Informe cliente e produto." }, { status: 400 });
      }
      const grossValue = number(payload.grossValue);
      const discount = number(payload.discount);
      const [record] = await db.insert(sales).values({
        client,
        productId: payload.productId ? number(payload.productId) : null,
        productName,
        seller: text(payload.seller),
        grossValue,
        discount,
        finalValue: Math.max(0, grossValue - discount),
        cost: number(payload.cost),
        paymentMethod: text(payload.paymentMethod) || "Pix",
        date: text(payload.date) || toCentralDate(),
        status: text(payload.status) || "Pendente",
        notes: text(payload.notes),
      }).returning();
      await logAction("registrou", "venda", record.id, `Venda de ${record.productName} para ${record.client}.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "task") {
      const title = text(payload.title);
      if (!title) return Response.json({ error: "Informe o título da tarefa." }, { status: 400 });
      const startAt = text(payload.startAt);
      const endAt = text(payload.endAt);
      if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) return Response.json({ error: "O término da tarefa deve ser posterior ao início." }, { status: 400 });
      const actor = await actorName();
      const [record] = await db.insert(tasks).values({
        title,
        description: text(payload.description),
        responsible: text(payload.responsible),
        dueDate: text(payload.dueDate) || startAt.slice(0, 10),
        startAt,
        endAt,
        allDay: payload.allDay === true || payload.allDay === "true" || payload.allDay === "on",
        calendarColor: text(payload.calendarColor) || "#db8a19",
        reminderMinutes: "reminderMinutes" in payload ? number(payload.reminderMinutes) : 15,
        priority: text(payload.priority) || "Média",
        status: text(payload.status) || "A fazer",
        leadId: payload.leadId ? number(payload.leadId) : null,
        updatedBy: actor,
      }).returning();
      await logAction("criou", "tarefa", record.id, `Tarefa ${record.title} criada.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "goal") {
      const name = text(payload.name);
      if (!name) return Response.json({ error: "Informe um nome para a meta." }, { status: 400 });
      const [record] = await db.insert(goals).values({
        name,
        scope: text(payload.scope) || "Empresa",
        ownerName: text(payload.ownerName) || "Empresa",
        periodType: text(payload.periodType) || "Mensal",
        revenueTarget: number(payload.revenueTarget),
        salesTarget: number(payload.salesTarget),
        leadsTarget: number(payload.leadsTarget),
        meetingsTarget: number(payload.meetingsTarget),
        proposalsTarget: number(payload.proposalsTarget),
        startDate: text(payload.startDate),
        endDate: text(payload.endDate),
      }).returning();
      await logAction("criou", "meta", record.id, `Meta ${record.name} criada.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "setting") {
      const key = text(payload.key);
      const value = text(payload.value);
      if (!key) return Response.json({ error: "Configuração inválida." }, { status: 400 });
      await db.insert(settings).values({ key, value }).onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date().toISOString() },
      });
      await logAction("alterou", "configuração", null, `Configuração ${key} atualizada.`);
      return Response.json({ record: { key, value } });
    }

    if (entity === "teamMember") {
      const authorization = await authorizeWorkspace("team:write");
      if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
      const name = text(payload.name);
      if (!name) return Response.json({ error: "Informe o nome do integrante." }, { status: 400 });
      const [record] = await db.insert(teamMembers).values({
        name,
        email: cleanEmail(payload.email),
        color: text(payload.color) || "#6d5dfc",
        role: text(payload.role) || "Vendedor",
        permissions: text(payload.permissions) || "calendar:write,documents:read,ai:read",
        status: text(payload.status) || "Ativo",
      }).returning();
      await logAction("criou", "integrante", record.id, `Perfil de ${record.name} criado.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "calendarEvent") {
      const authorization = await authorizeWorkspace("calendar:write");
      if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
      const title = text(payload.title);
      const startAt = text(payload.startAt);
      const endAt = text(payload.endAt);
      const ownerId = number(payload.ownerId);
      if (!title || !startAt || !endAt || !ownerId) return Response.json({ error: "Informe título, início, fim e responsável." }, { status: 400 });
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) return Response.json({ error: "O horário de término deve ser posterior ao início." }, { status: 400 });
      const owner = (await db.select().from(teamMembers).where(eq(teamMembers.id, ownerId)).limit(1))[0];
      if (!owner) return Response.json({ error: "Responsável inválido." }, { status: 400 });
      const participants = Array.from(new Set([
        ownerId,
        ...(Array.isArray(payload.participantIds) ? payload.participantIds.map(number).filter(Boolean) : []),
      ]));
      const validParticipants = await db.select({ id: teamMembers.id }).from(teamMembers).where(inArray(teamMembers.id, participants));
      if (validParticipants.length !== participants.length) return Response.json({ error: "Há um participante inválido neste evento." }, { status: 400 });
      const conflicts = await findCalendarConflicts(startAt, endAt, participants);
      if (conflicts.length && payload.allowConflict !== true) return Response.json({
        error: `Conflito com ${conflicts[0].title}. Deseja salvar mesmo assim?`,
        code: "CALENDAR_CONFLICT",
        conflicts: conflicts.map((event) => ({ id: event.id, title: event.title, startAt: event.startAt, endAt: event.endAt })),
      }, { status: 409 });
      const actor = await actorName();
      const [record] = await db.insert(calendarEvents).values({
        title,
        description: text(payload.description),
        startAt,
        endAt,
        allDay: payload.allDay === true || payload.allDay === "true" || payload.allDay === "on",
        ownerId,
        visibility: text(payload.visibility) === "Privado" ? "Privado" : "Equipe",
        category: text(payload.category) || "Reunião",
        color: text(payload.color) || owner.color,
        location: text(payload.location),
        meetingLink: text(payload.meetingLink),
        leadId: number(payload.leadId) || null,
        taskId: number(payload.taskId) || null,
        followupLeadId: number(payload.followupLeadId) || null,
        recurrence: text(payload.recurrence) || "Nenhuma",
        reminderMinutes: number(payload.reminderMinutes),
        status: text(payload.status) || "Agendado",
        createdBy: actor,
        updatedBy: actor,
      }).returning();
      if (participants.length) await db.insert(eventParticipants).values(participants.map((memberId) => ({ eventId: record.id, memberId })));
      await db.insert(eventAuditLogs).values({ eventId: record.id, actor, action: "criou", detail: `Evento ${record.title} criado.` });
      await logAction("criou", "evento", record.id, `Evento ${record.title} criado para ${owner.name}.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "niche") {
      const name = text(payload.name);
      if (!name) return Response.json({ error: "Informe o nome do nicho." }, { status: 400 });
      const existing = await db.select({ id: niches.id }).from(niches).where(eq(niches.name, name)).limit(1);
      if (existing.length) return Response.json({ error: "Já existe um nicho com esse nome." }, { status: 409 });
      const [record] = await db.insert(niches).values({
        name,
        description: text(payload.description),
        color: text(payload.color) || "#6d5dfc",
        status: text(payload.status) || "Ativo",
        defaultResponsible: text(payload.defaultResponsible),
        recommendedProduct: text(payload.recommendedProduct),
      }).returning();
      await logAction("criou", "nicho", record.id, `Nicho ${record.name} criado.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "importedLead") {
      const name = text(payload.name);
      const company = text(payload.company);
      if (!name && !company) return Response.json({ error: "Informe o nome ou a empresa." }, { status: 400 });
      const nicheId = number(payload.nicheId) || null;
      const niche = nicheId ? (await db.select().from(niches).where(eq(niches.id, nicheId)).limit(1))[0] : null;
      const [record] = await db.insert(importedLeads).values({
        name, company, nicheId, nicheName: niche?.name || text(payload.nicheName) || "Sem nicho",
        phone: text(payload.phone), whatsapp: text(payload.whatsapp), email: cleanEmail(payload.email),
        instagram: text(payload.instagram), site: text(payload.site), city: text(payload.city), state: text(payload.state),
        source: text(payload.source) || "Cadastro manual", responsible: text(payload.responsible) || niche?.defaultResponsible || "",
        contactStatus: validContactStatus(payload.contactStatus) ? text(payload.contactStatus) : "Não contatado",
        productInterest: text(payload.productInterest) || niche?.recommendedProduct || "",
        potentialValue: number(payload.potentialValue), lastContact: text(payload.lastContact), nextFollowup: text(payload.nextFollowup),
        notes: text(payload.notes), customFields: cleanCustomFields(payload.customFields),
      }).returning();
      await logAction("criou", "lead da base", record.id, `${record.company || record.name} adicionado à Base de Leads.`);
      return Response.json({ record }, { status: 201 });
    }

    if (entity === "leadImport") {
      const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 2000) as Record<string, unknown>[] : [];
      if (!rows.length) return Response.json({ error: "Nenhuma linha válida para importar." }, { status: 400 });
      if ((payload.rows as unknown[]).length > 2000) return Response.json({ error: "O limite é de 2.000 leads por importação." }, { status: 400 });
      const duplicateStrategy = ["skip", "fill", "keep"].includes(text(payload.duplicateStrategy)) ? text(payload.duplicateStrategy) : "skip";
      const actor = await actorName();
      const [batch] = await db.insert(leadImportBatches).values({
        fileName: text(payload.fileName) || "Colagem manual",
        source: text(payload.source) || "Colagem",
        importedBy: actor,
        totalRows: rows.length,
      }).returning();
      const current = await db.select().from(importedLeads);
      const currentNiches = await db.select().from(niches);
      const nicheMap = new Map(currentNiches.map(item => [item.name.toLowerCase(), item]));
      const working = [...current];
      let imported = 0, duplicates = 0, skipped = 0, errors = 0;
      const foundNiches = new Set<string>();

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowStrategy = ["skip", "fill", "keep"].includes(text(row.duplicateAction)) ? text(row.duplicateAction) : duplicateStrategy;
        const name = text(row.name), company = text(row.company);
        if (!name && !company) {
          errors += 1;
          await db.insert(importErrors).values({ batchId: batch.id, rowNumber: index + 2, error: "Nome ou empresa ausente", rawData: JSON.stringify(row).slice(0, 4000) });
          continue;
        }
        let nicheName = text(row.nicheName) || "Sem nicho";
        let niche = nicheMap.get(nicheName.toLowerCase());
        if (!niche && nicheName !== "Sem nicho") {
          const [created] = await db.insert(niches).values({ name: nicheName }).returning();
          niche = created;
          nicheMap.set(nicheName.toLowerCase(), created);
        }
        if (niche) { nicheName = niche.name; foundNiches.add(niche.name); }
        const email = cleanEmail(row.email), phone = cleanPhone(row.phone), whatsapp = cleanPhone(row.whatsapp);
        const site = cleanKey(row.site), instagram = cleanKey(row.instagram), companyKey = cleanKey(company), nameKey = cleanKey(name);
        const duplicate = working.find(item =>
          (email && cleanEmail(item.email) === email) ||
          (whatsapp && cleanPhone(item.whatsapp) === whatsapp) ||
          (phone && cleanPhone(item.phone) === phone) ||
          (site && cleanKey(item.site) === site) ||
          (instagram && cleanKey(item.instagram) === instagram) ||
          (companyKey && nameKey && cleanKey(item.company) === companyKey && cleanKey(item.name) === nameKey)
        );
        if (duplicate) {
          duplicates += 1;
          if (rowStrategy === "skip") { skipped += 1; continue; }
          if (rowStrategy === "fill") {
            const fill: Partial<typeof importedLeads.$inferInsert> = { updatedAt: new Date().toISOString() };
            const values: Record<string, string | number> = {
              name, company, phone: text(row.phone), whatsapp: text(row.whatsapp), email,
              instagram: text(row.instagram), site: text(row.site), city: text(row.city), state: text(row.state),
              source: text(row.source), responsible: text(row.responsible), productInterest: text(row.productInterest),
              lastContact: text(row.lastContact), nextFollowup: text(row.nextFollowup), notes: text(row.notes),
              customFields: cleanCustomFields(row.customFields),
            };
            Object.entries(values).forEach(([key, value]) => {
              const field = key as keyof typeof duplicate;
              if (!duplicate[field] && value) (fill as Record<string, unknown>)[key] = value;
            });
            const incomingCustom = cleanCustomFields(row.customFields);
            if (incomingCustom !== "{}") fill.customFields = JSON.stringify({ ...JSON.parse(cleanCustomFields(duplicate.customFields)), ...JSON.parse(incomingCustom) });
            if (!duplicate.nicheId && niche) { fill.nicheId = niche.id; fill.nicheName = niche.name; }
            if (!duplicate.potentialValue && number(row.potentialValue)) fill.potentialValue = number(row.potentialValue);
            const [updated] = await db.update(importedLeads).set(fill).where(eq(importedLeads.id, duplicate.id)).returning();
            Object.assign(duplicate, updated);
            imported += 1;
            continue;
          }
        }
        const [created] = await db.insert(importedLeads).values({
          batchId: batch.id, name, company, nicheId: niche?.id || null, nicheName,
          phone: text(row.phone), whatsapp: text(row.whatsapp), email,
          instagram: text(row.instagram), site: text(row.site), city: text(row.city), state: text(row.state),
          source: text(row.source) || text(payload.source) || "Importação",
          responsible: text(row.responsible) || niche?.defaultResponsible || "",
          contactStatus: validContactStatus(row.contactStatus) ? text(row.contactStatus) : "Não contatado",
          productInterest: text(row.productInterest) || niche?.recommendedProduct || "",
          potentialValue: number(row.potentialValue), lastContact: text(row.lastContact), nextFollowup: text(row.nextFollowup),
          notes: text(row.notes), customFields: cleanCustomFields(row.customFields),
        }).returning();
        working.push(created);
        imported += 1;
      }
      await db.update(leadImportBatches).set({ importedRows: imported, duplicateRows: duplicates, skippedRows: skipped, errorRows: errors, nichesFound: foundNiches.size }).where(eq(leadImportBatches.id, batch.id));
      await logAction("importou", "base de leads", batch.id, `${imported} leads processados; ${duplicates} duplicados; ${errors} erros.`);
      return Response.json({ record: { ...batch, importedRows: imported, duplicateRows: duplicates, skippedRows: skipped, errorRows: errors }, imported, duplicates, skipped, errors }, { status: 201 });
    }

    if (entity === "pipelineFromBase") {
      const sourceId = number(payload.id);
      const source = (await db.select().from(importedLeads).where(eq(importedLeads.id, sourceId)).limit(1))[0];
      if (!source) return Response.json({ error: "Lead da base não encontrado." }, { status: 404 });
      if (source.pipelineLeadId) return Response.json({ error: "Este lead já está na pipeline." }, { status: 409 });
      const [pipelineLead] = await db.insert(leads).values({
        name: source.name || source.company, company: source.company, phone: source.phone, whatsapp: source.whatsapp,
        email: source.email, instagram: source.instagram, site: source.site, city: source.city,
        segment: source.nicheName, source: source.source, productInterest: text(payload.productInterest) || source.productInterest,
        responsible: text(payload.responsible) || source.responsible, status: text(payload.status) || "Novo",
        potentialValue: "potentialValue" in payload ? number(payload.potentialValue) : source.potentialValue,
        nextFollowup: text(payload.nextFollowup) || source.nextFollowup,
        notes: [source.notes, text(payload.notes)].filter(Boolean).join("\n"),
      }).returning();
      await db.insert(leadPipelineLinks).values({ importedLeadId: source.id, pipelineLeadId: pipelineLead.id });
      await db.update(importedLeads).set({ pipelineLeadId: pipelineLead.id, updatedAt: new Date().toISOString() }).where(eq(importedLeads.id, source.id));
      await logAction("enviou", "pipeline", pipelineLead.id, `${source.company || source.name} enviado da Base de Leads para a pipeline.`);
      return Response.json({ record: pipelineLead }, { status: 201 });
    }

    if (entity === "bulkImportedLead") {
      const ids = Array.isArray(payload.ids) ? payload.ids.map(number).filter(Boolean).slice(0, 2000) : [];
      if (!ids.length) return Response.json({ error: "Selecione ao menos um lead." }, { status: 400 });
      const updates: Partial<typeof importedLeads.$inferInsert> = { updatedAt: new Date().toISOString() };
      if ("contactStatus" in payload) {
        const status = text(payload.contactStatus);
        if (!validContactStatus(status)) return Response.json({ error: "Status inválido." }, { status: 400 });
        updates.contactStatus = status;
        if (status !== "Não contatado") updates.lastContact = toCentralDate();
      }
      if ("responsible" in payload) updates.responsible = text(payload.responsible);
      if ("nicheId" in payload) {
        const nicheId = number(payload.nicheId);
        const niche = (await db.select().from(niches).where(eq(niches.id, nicheId)).limit(1))[0];
        if (!niche) return Response.json({ error: "Nicho inválido." }, { status: 400 });
        updates.nicheId = niche.id; updates.nicheName = niche.name;
      }
      if (Object.keys(updates).length === 1) return Response.json({ error: "Escolha uma alteração em massa." }, { status: 400 });
      const before = updates.contactStatus ? await db.select({ id: importedLeads.id, contactStatus: importedLeads.contactStatus }).from(importedLeads).where(inArray(importedLeads.id, ids)) : [];
      await db.update(importedLeads).set(updates).where(inArray(importedLeads.id, ids));
      if (updates.contactStatus) {
        const actor = await actorName();
        for (const item of before) await db.insert(leadContactHistory).values({ importedLeadId: item.id, actor, oldStatus: item.contactStatus, newStatus: updates.contactStatus, note: "Alteração em massa" });
      }
      await logAction("atualizou", "base de leads", null, `${ids.length} leads atualizados em massa.`);
      return Response.json({ ok: true, count: ids.length });
    }

    if (entity === "bulkPipelineFromBase") {
      const ids = Array.isArray(payload.ids) ? payload.ids.map(number).filter(Boolean).slice(0, 200) : [];
      if (!ids.length) return Response.json({ error: "Selecione ao menos um lead." }, { status: 400 });
      const sources = await db.select().from(importedLeads).where(inArray(importedLeads.id, ids));
      let createdCount = 0;
      for (const source of sources) {
        if (source.pipelineLeadId) continue;
        const [pipelineLead] = await db.insert(leads).values({
          name: source.name || source.company, company: source.company, phone: source.phone, whatsapp: source.whatsapp,
          email: source.email, instagram: source.instagram, site: source.site, city: source.city,
          segment: source.nicheName, source: source.source, productInterest: source.productInterest,
          responsible: text(payload.responsible) || source.responsible, status: text(payload.status) || "Novo",
          potentialValue: source.potentialValue, nextFollowup: source.nextFollowup, notes: source.notes,
        }).returning();
        await db.insert(leadPipelineLinks).values({ importedLeadId: source.id, pipelineLeadId: pipelineLead.id });
        await db.update(importedLeads).set({ pipelineLeadId: pipelineLead.id, updatedAt: new Date().toISOString() }).where(eq(importedLeads.id, source.id));
        createdCount += 1;
      }
      await logAction("enviou", "pipeline", null, `${createdCount} leads enviados em massa da Base de Leads.`);
      return Response.json({ ok: true, count: createdCount }, { status: 201 });
    }

    if (entity === "bulkDeleteImportedLead") {
      const ids = Array.isArray(payload.ids) ? payload.ids.map(number).filter(Boolean).slice(0, 2000) : [];
      if (payload.confirmed !== true || !ids.length) return Response.json({ error: "Confirme a exclusão dos leads selecionados." }, { status: 400 });
      await db.delete(leadContactHistory).where(inArray(leadContactHistory.importedLeadId, ids));
      await db.delete(leadPipelineLinks).where(inArray(leadPipelineLinks.importedLeadId, ids));
      await db.delete(importedLeads).where(inArray(importedLeads.id, ids));
      await logAction("excluiu", "base de leads", null, `${ids.length} leads excluídos em massa após confirmação.`);
      return Response.json({ ok: true, count: ids.length });
    }

    return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const entity = text(payload.entity);
    const authorization = await authorizeWorkspace(permissionFor(entity, "PATCH"));
    if (!authorization.allowed) return denied(authorization);
    const id = number(payload.id);
    if (!id) return Response.json({ error: "Registro inválido." }, { status: 400 });
    const db = getDb();

    if (entity === "lead") {
      const updates: Partial<typeof leads.$inferInsert> = { updatedAt: new Date().toISOString() };
      const fields = ["name", "company", "phone", "whatsapp", "email", "instagram", "site", "city", "segment", "source", "productInterest", "responsible", "status", "firstContact", "lastContact", "nextFollowup", "notes"] as const;
      fields.forEach((field) => { if (field in payload) updates[field] = text(payload[field]); });
      if ("potentialValue" in payload) updates.potentialValue = number(payload.potentialValue);
      const [record] = await db.update(leads).set(updates).where(eq(leads.id, id)).returning();
      await logAction("atualizou", "lead", id, `Lead ${record?.name || id} atualizado.`);
      return Response.json({ record });
    }

    if (entity === "teamMember") {
      const authorization = await authorizeWorkspace("team:write");
      if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
      const updates: Partial<typeof teamMembers.$inferInsert> = { updatedAt: new Date().toISOString() };
      const fields = ["name", "email", "color", "role", "permissions", "status"] as const;
      fields.forEach((field) => { if (field in payload) updates[field] = field === "email" ? cleanEmail(payload[field]) : text(payload[field]); });
      const [record] = await db.update(teamMembers).set(updates).where(eq(teamMembers.id, id)).returning();
      if (!record) return Response.json({ error: "Integrante não encontrado." }, { status: 404 });
      await logAction("atualizou", "integrante", id, `Perfil de ${record.name} atualizado.`);
      return Response.json({ record });
    }

    if (entity === "calendarEvent") {
      const authorization = await authorizeWorkspace("calendar:write");
      if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
      const current = (await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1))[0];
      if (!current) return Response.json({ error: "Evento não encontrado." }, { status: 404 });
      if (payload.version && number(payload.version) !== current.version) return Response.json({ error: "Este evento foi alterado por outra pessoa. Atualize a agenda antes de salvar.", code: "VERSION_CONFLICT" }, { status: 409 });
      const startAt = "startAt" in payload ? text(payload.startAt) : current.startAt;
      const endAt = "endAt" in payload ? text(payload.endAt) : current.endAt;
      const ownerId = "ownerId" in payload ? number(payload.ownerId) : current.ownerId;
      if (!startAt || !endAt || new Date(endAt).getTime() <= new Date(startAt).getTime()) return Response.json({ error: "O horário de término deve ser posterior ao início." }, { status: 400 });
      const currentParticipants = await db.select({ memberId: eventParticipants.memberId }).from(eventParticipants).where(eq(eventParticipants.eventId, id));
      const requestedParticipants = Array.isArray(payload.participantIds)
        ? payload.participantIds.map(number).filter(Boolean)
        : currentParticipants.map((item) => item.memberId);
      const participants = Array.from(new Set([ownerId, ...requestedParticipants]));
      const validParticipants = await db.select({ id: teamMembers.id }).from(teamMembers).where(inArray(teamMembers.id, participants));
      if (validParticipants.length !== participants.length) return Response.json({ error: "Há um participante inválido neste evento." }, { status: 400 });
      const conflicts = await findCalendarConflicts(startAt, endAt, participants, id);
      if (conflicts.length && payload.allowConflict !== true) return Response.json({ error: `Conflito com ${conflicts[0].title}. Deseja salvar mesmo assim?`, code: "CALENDAR_CONFLICT", conflicts }, { status: 409 });
      const actor = await actorName();
      const updates: Partial<typeof calendarEvents.$inferInsert> = { updatedAt: new Date().toISOString(), updatedBy: actor, version: current.version + 1 };
      const fields = ["title", "description", "startAt", "endAt", "visibility", "category", "color", "location", "meetingLink", "recurrence", "status"] as const;
      fields.forEach((field) => { if (field in payload) updates[field] = text(payload[field]); });
      if ("allDay" in payload) updates.allDay = payload.allDay === true || payload.allDay === "true" || payload.allDay === "on";
      if ("ownerId" in payload) updates.ownerId = ownerId;
      if ("reminderMinutes" in payload) updates.reminderMinutes = number(payload.reminderMinutes);
      if ("leadId" in payload) updates.leadId = number(payload.leadId) || null;
      if ("taskId" in payload) updates.taskId = number(payload.taskId) || null;
      if ("followupLeadId" in payload) updates.followupLeadId = number(payload.followupLeadId) || null;
      const [record] = await db.update(calendarEvents).set(updates).where(eq(calendarEvents.id, id)).returning();
      if (Array.isArray(payload.participantIds)) {
        await db.delete(eventParticipants).where(eq(eventParticipants.eventId, id));
        if (participants.length) await db.insert(eventParticipants).values(participants.map((memberId) => ({ eventId: id, memberId })));
      }
      await db.insert(eventAuditLogs).values({ eventId: id, actor, action: "atualizou", detail: `Evento ${record.title} atualizado (versão ${record.version}).` });
      await logAction("atualizou", "evento", id, `Evento ${record.title} atualizado.`);
      return Response.json({ record });
    }

    if (entity === "niche") {
      const updates: Partial<typeof niches.$inferInsert> = { updatedAt: new Date().toISOString() };
      const fields = ["name", "description", "color", "status", "defaultResponsible", "recommendedProduct"] as const;
      fields.forEach((field) => { if (field in payload) updates[field] = text(payload[field]); });
      if (updates.name) {
        const same = await db.select({ id: niches.id }).from(niches).where(eq(niches.name, updates.name)).limit(1);
        if (same.length && same[0].id !== id) return Response.json({ error: "Já existe um nicho com esse nome." }, { status: 409 });
      }
      const [record] = await db.update(niches).set(updates).where(eq(niches.id, id)).returning();
      if (!record) return Response.json({ error: "Nicho não encontrado." }, { status: 404 });
      if (updates.name) await db.update(importedLeads).set({ nicheName: updates.name, updatedAt: new Date().toISOString() }).where(eq(importedLeads.nicheId, id));
      await logAction("atualizou", "nicho", id, `Nicho ${record.name} atualizado.`);
      return Response.json({ record });
    }

    if (entity === "importedLead") {
      const current = (await db.select().from(importedLeads).where(eq(importedLeads.id, id)).limit(1))[0];
      if (!current) return Response.json({ error: "Lead da base não encontrado." }, { status: 404 });
      const updates: Partial<typeof importedLeads.$inferInsert> = { updatedAt: new Date().toISOString() };
      const fields = ["name", "company", "phone", "whatsapp", "email", "instagram", "site", "city", "state", "source", "responsible", "contactStatus", "productInterest", "lastContact", "nextFollowup", "notes"] as const;
      fields.forEach((field) => { if (field in payload) updates[field] = text(payload[field]); });
      if (updates.contactStatus && !validContactStatus(updates.contactStatus)) return Response.json({ error: "Status inválido." }, { status: 400 });
      if ("customFields" in payload) updates.customFields = cleanCustomFields(payload.customFields);
      if (updates.contactStatus && updates.contactStatus !== "Não contatado" && !("lastContact" in payload)) updates.lastContact = toCentralDate();
      if ("potentialValue" in payload) updates.potentialValue = number(payload.potentialValue);
      if ("nicheId" in payload) {
        const nicheId = number(payload.nicheId);
        if (nicheId) {
          const niche = (await db.select().from(niches).where(eq(niches.id, nicheId)).limit(1))[0];
          if (!niche) return Response.json({ error: "Nicho inválido." }, { status: 400 });
          updates.nicheId = niche.id; updates.nicheName = niche.name;
        } else { updates.nicheId = null; updates.nicheName = "Sem nicho"; }
      }
      const [record] = await db.update(importedLeads).set(updates).where(eq(importedLeads.id, id)).returning();
      if (updates.contactStatus && updates.contactStatus !== current.contactStatus) {
        await db.insert(leadContactHistory).values({ importedLeadId: id, actor: await actorName(), oldStatus: current.contactStatus, newStatus: updates.contactStatus, note: text(payload.statusNote) });
      }
      await logAction("atualizou", "lead da base", id, `${record.company || record.name} atualizado.`);
      return Response.json({ record });
    }

    if (entity === "product") {
      const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date().toISOString() };
      const textFields = ["name", "category", "description", "status", "targetAudience", "problemSolved", "salesArguments", "objections", "notes"] as const;
      textFields.forEach((field) => { if (field in payload) updates[field] = text(payload[field]); });
      const numericFields = ["price", "promotionalPrice", "minimumPrice", "cost", "deliveryDays"] as const;
      numericFields.forEach((field) => { if (field in payload) updates[field] = number(payload[field]); });
      const [record] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
      await logAction("atualizou", "produto", id, `Produto ${record?.name || id} atualizado.`);
      return Response.json({ record });
    }

    if (entity === "goal") {
      const updates: Partial<typeof goals.$inferInsert> = { updatedAt: new Date().toISOString() };
      const textFields = ["name", "scope", "ownerName", "periodType", "startDate", "endDate"] as const;
      const numericFields = ["revenueTarget", "salesTarget", "leadsTarget", "meetingsTarget", "proposalsTarget"] as const;
      textFields.forEach((field) => { if (field in payload) updates[field] = text(payload[field]); });
      numericFields.forEach((field) => { if (field in payload) updates[field] = number(payload[field]); });
      if ("name" in payload && !updates.name) return Response.json({ error: "Informe um nome para a meta." }, { status: 400 });
      const [record] = await db.update(goals).set(updates).where(eq(goals.id, id)).returning();
      if (!record) return Response.json({ error: "Meta não encontrada." }, { status: 404 });
      await logAction("atualizou", "meta", id, `Meta ${record.name} atualizada.`);
      return Response.json({ record });
    }

    if (entity === "sale") {
      const updates: Partial<typeof sales.$inferInsert> = { updatedAt: new Date().toISOString() };
      const textFields = ["client", "productName", "seller", "paymentMethod", "date", "status", "notes"] as const;
      textFields.forEach((field) => { if (field in payload) updates[field] = text(payload[field]); });
      const numericFields = ["grossValue", "discount", "cost"] as const;
      numericFields.forEach((field) => { if (field in payload) updates[field] = number(payload[field]); });
      const current = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
      const gross = updates.grossValue ?? current[0]?.grossValue ?? 0;
      const discount = updates.discount ?? current[0]?.discount ?? 0;
      updates.finalValue = Math.max(0, gross - discount);
      const [record] = await db.update(sales).set(updates).where(eq(sales.id, id)).returning();
      await logAction("atualizou", "venda", id, `Venda ${id} atualizada para ${record?.status || "novo status"}.`);
      return Response.json({ record });
    }

    if (entity === "task") {
      const current = (await db.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0];
      if (!current) return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
      const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date().toISOString(), updatedBy: await actorName() };
      const fields = ["title", "description", "responsible", "dueDate", "startAt", "endAt", "calendarColor", "priority", "status"] as const;
      fields.forEach((field) => { if (field in payload) updates[field] = text(payload[field]); });
      if ("allDay" in payload) updates.allDay = payload.allDay === true || payload.allDay === "true" || payload.allDay === "on";
      if ("reminderMinutes" in payload) updates.reminderMinutes = number(payload.reminderMinutes);
      if ("leadId" in payload) updates.leadId = number(payload.leadId) || null;
      const nextStart = updates.startAt ?? current.startAt;
      const nextEnd = updates.endAt ?? current.endAt;
      if (nextStart && nextEnd && new Date(nextEnd).getTime() <= new Date(nextStart).getTime()) return Response.json({ error: "O término da tarefa deve ser posterior ao início." }, { status: 400 });
      if (updates.startAt && !("dueDate" in payload)) updates.dueDate = updates.startAt.slice(0, 10);
      const [record] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
      await logAction("atualizou", "tarefa", id, `Tarefa ${record?.title || id} atualizada.`);
      return Response.json({ record });
    }

    return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const entity = text(payload.entity);
    const authorization = await authorizeWorkspace(permissionFor(entity, "DELETE"));
    if (!authorization.allowed) return denied(authorization);
    const id = number(payload.id);
    if (!id) return Response.json({ error: "Registro inválido." }, { status: 400 });
    const db = getDb();

    if (entity === "product") await db.delete(products).where(eq(products.id, id));
    else if (entity === "lead") {
      const linked = await db.select().from(leadPipelineLinks).where(eq(leadPipelineLinks.pipelineLeadId, id));
      if (linked.length) {
        const sourceIds = linked.map((item) => item.importedLeadId);
        await db.update(importedLeads).set({ pipelineLeadId: null, updatedAt: new Date().toISOString() }).where(inArray(importedLeads.id, sourceIds));
        await db.delete(leadPipelineLinks).where(eq(leadPipelineLinks.pipelineLeadId, id));
      }
      await db.delete(leads).where(eq(leads.id, id));
    }
    else if (entity === "sale") await db.delete(sales).where(eq(sales.id, id));
    else if (entity === "task") await db.delete(tasks).where(eq(tasks.id, id));
    else if (entity === "goal") await db.delete(goals).where(eq(goals.id, id));
    else if (entity === "importedLead") {
      await db.delete(leadContactHistory).where(eq(leadContactHistory.importedLeadId, id));
      await db.delete(leadPipelineLinks).where(eq(leadPipelineLinks.importedLeadId, id));
      await db.delete(importedLeads).where(eq(importedLeads.id, id));
    }
    else if (entity === "calendarEvent") {
      const authorization = await authorizeWorkspace("calendar:write");
      if (!authorization.allowed) return Response.json({ error: authorization.error }, { status: authorization.status });
      const current = (await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1))[0];
      if (!current) return Response.json({ error: "Evento não encontrado." }, { status: 404 });
      const actor = await actorName();
      await db.insert(eventAuditLogs).values({ eventId: id, actor, action: "excluiu", detail: `Evento ${current.title} excluído.` });
      await db.delete(eventParticipants).where(eq(eventParticipants.eventId, id));
      await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
    }
    else if (entity === "niche") {
      const used = await db.select({ id: importedLeads.id }).from(importedLeads).where(eq(importedLeads.nicheId, id)).limit(1);
      if (used.length) {
        const replacementId = number(payload.replacementNicheId);
        if (!replacementId || replacementId === id) return Response.json({ error: "Este nicho possui leads. Escolha um nicho de destino antes de excluir." }, { status: 409 });
        const replacement = (await db.select().from(niches).where(eq(niches.id, replacementId)).limit(1))[0];
        if (!replacement) return Response.json({ error: "Nicho de destino inválido." }, { status: 400 });
        await db.update(importedLeads).set({ nicheId: replacement.id, nicheName: replacement.name, updatedAt: new Date().toISOString() }).where(eq(importedLeads.nicheId, id));
      }
      await db.delete(niches).where(eq(niches.id, id));
    }
    else return Response.json({ error: "Tipo de registro inválido." }, { status: 400 });

    await logAction("excluiu", entity, id, `Registro ${id} excluído.`);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull().default("Sem categoria"),
  description: text("description").notNull().default(""),
  price: real("price").notNull().default(0),
  promotionalPrice: real("promotional_price"),
  minimumPrice: real("minimum_price").notNull().default(0),
  cost: real("cost").notNull().default(0),
  status: text("status").notNull().default("Ativo"),
  deliveryDays: integer("delivery_days").notNull().default(0),
  targetAudience: text("target_audience").notNull().default(""),
  problemSolved: text("problem_solved").notNull().default(""),
  salesArguments: text("sales_arguments").notNull().default(""),
  objections: text("objections").notNull().default(""),
  notes: text("notes").notNull().default(""),
  ...timestamps,
});

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  phone: text("phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  email: text("email").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  site: text("site").notNull().default(""),
  city: text("city").notNull().default(""),
  segment: text("segment").notNull().default(""),
  source: text("source").notNull().default("Indicação"),
  productInterest: text("product_interest").notNull().default(""),
  responsible: text("responsible").notNull().default(""),
  status: text("status").notNull().default("Novo"),
  potentialValue: real("potential_value").notNull().default(0),
  firstContact: text("first_contact").notNull().default(""),
  lastContact: text("last_contact").notNull().default(""),
  nextFollowup: text("next_followup").notNull().default(""),
  notes: text("notes").notNull().default(""),
  ...timestamps,
});

export const sales = sqliteTable("sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  client: text("client").notNull(),
  productId: integer("product_id"),
  productName: text("product_name").notNull(),
  seller: text("seller").notNull().default(""),
  grossValue: real("gross_value").notNull().default(0),
  discount: real("discount").notNull().default(0),
  finalValue: real("final_value").notNull().default(0),
  cost: real("cost").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("Pix"),
  date: text("date").notNull(),
  status: text("status").notNull().default("Pendente"),
  notes: text("notes").notNull().default(""),
  ...timestamps,
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  responsible: text("responsible").notNull().default(""),
  dueDate: text("due_date").notNull().default(""),
  startAt: text("start_at").notNull().default(""),
  endAt: text("end_at").notNull().default(""),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  calendarColor: text("calendar_color").notNull().default("#db8a19"),
  reminderMinutes: integer("reminder_minutes").notNull().default(15),
  priority: text("priority").notNull().default("Média"),
  status: text("status").notNull().default("A fazer"),
  leadId: integer("lead_id"),
  updatedBy: text("updated_by").notNull().default("Equipe comercial"),
  ...timestamps,
});

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  scope: text("scope").notNull().default("Empresa"),
  ownerName: text("owner_name").notNull().default("Empresa"),
  periodType: text("period_type").notNull().default("Mensal"),
  revenueTarget: real("revenue_target").notNull().default(0),
  salesTarget: integer("sales_target").notNull().default(0),
  leadsTarget: integer("leads_target").notNull().default(0),
  meetingsTarget: integer("meetings_target").notNull().default(0),
  proposalsTarget: integer("proposals_target").notNull().default(0),
  startDate: text("start_date").notNull().default(""),
  endDate: text("end_date").notNull().default(""),
  ...timestamps,
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull().default("Usuário"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  recordId: integer("record_id"),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const niches = sqliteTable("niches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#6d5dfc"),
  status: text("status").notNull().default("Ativo"),
  defaultResponsible: text("default_responsible").notNull().default(""),
  recommendedProduct: text("recommended_product").notNull().default(""),
  ...timestamps,
});

export const leadImportBatches = sqliteTable("lead_import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull().default("Colagem manual"),
  source: text("source").notNull().default("Colagem"),
  importedBy: text("imported_by").notNull().default("Equipe comercial"),
  totalRows: integer("total_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  nichesFound: integer("niches_found").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const importedLeads = sqliteTable("imported_leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id"),
  name: text("name").notNull().default(""),
  company: text("company").notNull().default(""),
  nicheId: integer("niche_id"),
  nicheName: text("niche_name").notNull().default("Sem nicho"),
  phone: text("phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  email: text("email").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  site: text("site").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  source: text("source").notNull().default("Importação"),
  responsible: text("responsible").notNull().default(""),
  contactStatus: text("contact_status").notNull().default("Não contatado"),
  productInterest: text("product_interest").notNull().default(""),
  potentialValue: real("potential_value").notNull().default(0),
  lastContact: text("last_contact").notNull().default(""),
  nextFollowup: text("next_followup").notNull().default(""),
  notes: text("notes").notNull().default(""),
  customFields: text("custom_fields").notNull().default("{}"),
  pipelineLeadId: integer("pipeline_lead_id"),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
});

export const leadContactHistory = sqliteTable("lead_contact_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importedLeadId: integer("imported_lead_id").notNull(),
  actor: text("actor").notNull().default("Equipe comercial"),
  oldStatus: text("old_status").notNull().default(""),
  newStatus: text("new_status").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const leadPipelineLinks = sqliteTable("lead_pipeline_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importedLeadId: integer("imported_lead_id").notNull().unique(),
  pipelineLeadId: integer("pipeline_lead_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const importErrors = sqliteTable("import_errors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull(),
  rowNumber: integer("row_number").notNull(),
  error: text("error").notNull(),
  rawData: text("raw_data").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  color: text("color").notNull().default("#6d5dfc"),
  role: text("role").notNull().default("Vendedor"),
  permissions: text("permissions").notNull().default("calendar:write,documents:read,ai:read"),
  status: text("status").notNull().default("Ativo"),
  ...timestamps,
});

export const calendarEvents = sqliteTable("calendar_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  startAt: text("start_at").notNull(),
  endAt: text("end_at").notNull(),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  ownerId: integer("owner_id").notNull(),
  visibility: text("visibility").notNull().default("Equipe"),
  category: text("category").notNull().default("Reunião"),
  color: text("color").notNull().default("#6d5dfc"),
  location: text("location").notNull().default(""),
  meetingLink: text("meeting_link").notNull().default(""),
  leadId: integer("lead_id"),
  taskId: integer("task_id"),
  followupLeadId: integer("followup_lead_id"),
  recurrence: text("recurrence").notNull().default("Nenhuma"),
  reminderMinutes: integer("reminder_minutes").notNull().default(15),
  status: text("status").notNull().default("Agendado"),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").notNull().default("Equipe comercial"),
  updatedBy: text("updated_by").notNull().default("Equipe comercial"),
  ...timestamps,
});

export const eventParticipants = sqliteTable("event_participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull(),
  memberId: integer("member_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const eventAuditLogs = sqliteTable("event_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  category: text("category").notNull().default("Geral"),
  description: text("description").notNull().default(""),
  visibility: text("visibility").notNull().default("Equipe"),
  uploadedBy: text("uploaded_by").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("Disponível"),
  linkedEntity: text("linked_entity").notNull().default(""),
  linkedRecordId: integer("linked_record_id"),
  previewData: text("preview_data").notNull().default(""),
  ...timestamps,
});

export const documentVersions = sqliteTable("document_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id").notNull(),
  objectKey: text("object_key").notNull(),
  version: integer("version").notNull(),
  size: integer("size").notNull().default(0),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiConversations = sqliteTable("ai_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default("Nova conversa"),
  ownerEmail: text("owner_email").notNull(),
  status: text("status").notNull().default("Ativa"),
  ...timestamps,
});

export const aiMessages = sqliteTable("ai_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiUsageLogs = sqliteTable("ai_usage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id"),
  actorEmail: text("actor_email").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  status: text("status").notNull().default("Concluído"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiToolCalls = sqliteTable("ai_tool_calls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  toolName: text("tool_name").notNull(),
  arguments: text("arguments").notNull().default("{}"),
  resultSummary: text("result_summary").notNull().default(""),
  mutation: integer("mutation", { mode: "boolean" }).notNull().default(false),
  confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

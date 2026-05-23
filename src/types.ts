export type NavView = "blueprint" | "ideation" | "script" | "video" | "funnel" | "plan";
export type ScriptPart = "hook" | "foreshadow" | "body" | "cta";
export type FunnelStage = "tofu" | "mofu" | "bofu";
export type ChatRole = "assistant" | "user";

export interface NavItem {
  id: NavView;
  label: string;
  icon: string;
}

export interface BrandContext {
  brandName: string;
  mainOffer: string;
  audience: string;
  painPoint: string;
  brandTone: string;
  contentGoal: string;
  brandDna?: string;
}

export interface PlanItem {
  title: string;
  script: string;
}

export interface BlueprintProfile {
  id: string;
  title: string;
  context: Partial<BrandContext>;
  result: string;
  updatedAt: string;
}

export interface WorkspaceState {
  plans: Record<string, PlanItem>;
  blueprints: BlueprintProfile[];
  activeBlueprintId: string | null;
  history?: GenerationHistoryItem[];
  usage?: Record<string, UsageBucket>;
  updatedAt?: string | null;
}

export interface SaveWorkspacePayload extends WorkspaceState {
  workspaceId: string;
}

export interface GeneratePayload {
  context?: Partial<BrandContext>;
  instruction: string;
  topic?: string;
  format?: string;
}

export interface TranscribePayload {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  context?: Partial<BrandContext>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  html: string;
}

export interface FunnelMeta {
  name: string;
  job: string;
  intent: string;
  cta: string;
}

export interface CalendarDay {
  day: number;
  key: string;
  isToday: boolean;
}

export interface PlanRow {
  date: string;
  title: string;
  script: string;
}

export interface ScriptChoice {
  part: ScriptPart;
  text: string;
}

export interface AskAIPayload {
  topic?: string;
  instruction: string;
  format: string;
}

export interface ScriptSettings {
  type: string;
  duration: string;
  platform: string;
}

export interface UsageBucket {
  total: number;
  generate: number;
  transcribe: number;
}

export interface UsagePayload {
  day?: string;
  bucket?: UsageBucket;
}

export interface AiResult {
  text: string;
  provider?: string;
  model?: string;
  usage?: UsagePayload;
}

export interface GenerationHistoryItem {
  id: string;
  type: string;
  input: string;
  output: string;
  provider: string;
  model: string;
  brand: string;
  createdAt: string;
}

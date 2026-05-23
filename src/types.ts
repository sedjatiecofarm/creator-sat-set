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

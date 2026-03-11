export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface SessionConfig {
  subject?: string;
  gradeLevel?: number;
  concepts?: string[];
}

export type SessionState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

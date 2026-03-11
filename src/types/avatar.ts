export type AvatarExpression = "idle" | "listening" | "thinking" | "talking";

export interface AvatarInputs {
  mouthOpen: number;
  isTalking: boolean;
  isListening: boolean;
  isThinking: boolean;
  isIdle: boolean;
}

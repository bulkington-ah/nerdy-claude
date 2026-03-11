import { Message } from "@/types/conversation";

export class ConversationStore {
  private messages: Message[] = [];
  private currentAssistantText: string = "";
  private isStreaming: boolean = false;

  public addUserMessage(content: string): void {
    this.messages.push({
      role: "user",
      content,
      timestamp: Date.now(),
    });
  }

  public startAssistantMessage(): void {
    this.currentAssistantText = "";
    this.isStreaming = true;
  }

  public appendAssistantDelta(delta: string): void {
    if (!this.isStreaming) return;
    this.currentAssistantText += delta;
  }

  public finalizeAssistantMessage(): void {
    if (!this.isStreaming) return;
    this.messages.push({
      role: "assistant",
      content: this.currentAssistantText,
      timestamp: Date.now(),
    });
    this.currentAssistantText = "";
    this.isStreaming = false;
  }

  public cancelAssistantMessage(): void {
    this.currentAssistantText = "";
    this.isStreaming = false;
  }

  public getCurrentAssistantText(): string {
    return this.currentAssistantText;
  }

  public getMessages(): Message[] {
    return [...this.messages];
  }

  public clear(): void {
    this.messages = [];
    this.currentAssistantText = "";
    this.isStreaming = false;
  }
}

import { Message } from "@/types/conversation";

export class ConversationStore {
  private messages: Message[] = [];
  private currentAssistantText: string = "";
  private isStreaming: boolean = false;

  public addUserMessage(content: string, id?: string): void {
    const timestamp = Date.now();

    if (id) {
      const existingIndex = this.messages.findIndex(
        (message) => message.role === "user" && message.id === id,
      );

      if (existingIndex >= 0) {
        this.messages[existingIndex] = {
          ...this.messages[existingIndex],
          content,
          timestamp,
        };
        return;
      }
    }

    this.messages.push({
      id,
      role: "user",
      content,
      timestamp,
    });
  }

  public appendUserTranscriptDelta(id: string, delta: string): void {
    const existingMessage = this.messages.find(
      (message) => message.role === "user" && message.id === id,
    );
    const nextContent =
      existingMessage && delta.startsWith(existingMessage.content)
        ? delta
        : `${existingMessage?.content ?? ""}${delta}`;

    this.addUserMessage(nextContent, id);
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

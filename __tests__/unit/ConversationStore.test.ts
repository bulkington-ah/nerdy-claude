import { ConversationStore } from "@/lib/ConversationStore";

describe("ConversationStore", () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore();
  });

  it("should start with an empty transcript", () => {
    expect(store.getMessages()).toEqual([]);
  });

  it("should add a complete user message", () => {
    store.addUserMessage("What is photosynthesis?");
    const messages = store.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("What is photosynthesis?");
    expect(messages[0].timestamp).toBeGreaterThan(0);
  });

  it("should update an existing transcribed user message by id", () => {
    store.addUserMessage("What is photo", "item_1");
    store.addUserMessage("What is photosynthesis?", "item_1");

    const messages = store.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("item_1");
    expect(messages[0].content).toBe("What is photosynthesis?");
  });

  it("should merge transcript deltas without duplicating cumulative text", () => {
    store.appendUserTranscriptDelta("item_1", "What is");
    store.appendUserTranscriptDelta("item_1", "What is photosynthesis?");

    const messages = store.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("What is photosynthesis?");
  });

  it("should accumulate assistant transcript deltas into a single message", () => {
    store.startAssistantMessage();
    store.appendAssistantDelta("Great ");
    store.appendAssistantDelta("question! ");
    store.appendAssistantDelta("What do you already know?");
    store.finalizeAssistantMessage();

    const messages = store.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].content).toBe("Great question! What do you already know?");
  });

  it("should maintain conversation order across multiple turns", () => {
    store.addUserMessage("Hi");
    store.startAssistantMessage();
    store.appendAssistantDelta("Hello! What would you like to explore?");
    store.finalizeAssistantMessage();
    store.addUserMessage("Math");

    const messages = store.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[2].role).toBe("user");
  });

  it("should return the current in-progress assistant text", () => {
    store.startAssistantMessage();
    store.appendAssistantDelta("Thinking about ");
    expect(store.getCurrentAssistantText()).toBe("Thinking about ");
    store.appendAssistantDelta("your question...");
    expect(store.getCurrentAssistantText()).toBe("Thinking about your question...");
  });

  it("should return empty string for current assistant text when not streaming", () => {
    expect(store.getCurrentAssistantText()).toBe("");
  });

  it("should clear all messages", () => {
    store.addUserMessage("Hello");
    store.startAssistantMessage();
    store.appendAssistantDelta("Hi!");
    store.finalizeAssistantMessage();
    store.clear();
    expect(store.getMessages()).toEqual([]);
  });

  it("should discard incomplete assistant message on clear", () => {
    store.startAssistantMessage();
    store.appendAssistantDelta("partial...");
    store.clear();
    expect(store.getMessages()).toEqual([]);
    expect(store.getCurrentAssistantText()).toBe("");
  });

  it("should handle cancellation by discarding in-progress assistant message", () => {
    store.startAssistantMessage();
    store.appendAssistantDelta("I was saying—");
    store.cancelAssistantMessage();
    expect(store.getCurrentAssistantText()).toBe("");
    // No message should be added
    expect(store.getMessages()).toEqual([]);
  });

  it("should return a defensive copy of messages", () => {
    store.addUserMessage("test");
    const messages1 = store.getMessages();
    const messages2 = store.getMessages();
    expect(messages1).not.toBe(messages2);
    expect(messages1).toEqual(messages2);
  });
});

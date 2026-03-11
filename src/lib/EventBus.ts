type EventHandler = (payload: unknown) => void;

export class EventBus {
  private listeners: Map<string, EventHandler[]> = new Map();

  public on(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }

  public off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    this.listeners.set(
      event,
      handlers.filter((h) => h !== handler),
    );
  }

  public emit(event: string, payload?: unknown): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch {
        // Isolate listener errors so one bad listener doesn't break others
      }
    }
  }

  public removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }
}

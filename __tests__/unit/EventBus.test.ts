import { EventBus } from "@/lib/EventBus";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("should emit and receive events", () => {
    const handler = jest.fn();
    bus.on("test:event", handler);
    bus.emit("test:event", { data: "hello" });
    expect(handler).toHaveBeenCalledWith({ data: "hello" });
  });

  it("should support multiple listeners for the same event", () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    bus.on("test:event", handler1);
    bus.on("test:event", handler2);
    bus.emit("test:event", "payload");
    expect(handler1).toHaveBeenCalledWith("payload");
    expect(handler2).toHaveBeenCalledWith("payload");
  });

  it("should unsubscribe a specific listener", () => {
    const handler = jest.fn();
    bus.on("test:event", handler);
    bus.off("test:event", handler);
    bus.emit("test:event", "payload");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should not affect other listeners when one is removed", () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    bus.on("test:event", handler1);
    bus.on("test:event", handler2);
    bus.off("test:event", handler1);
    bus.emit("test:event", "payload");
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledWith("payload");
  });

  it("should not throw when emitting an event with no listeners", () => {
    expect(() => bus.emit("nonexistent", "data")).not.toThrow();
  });

  it("should isolate errors in listeners from other listeners", () => {
    const errorHandler = jest.fn(() => {
      throw new Error("listener error");
    });
    const goodHandler = jest.fn();
    bus.on("test:event", errorHandler);
    bus.on("test:event", goodHandler);
    bus.emit("test:event", "payload");
    expect(goodHandler).toHaveBeenCalledWith("payload");
  });

  it("should remove all listeners for an event", () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    bus.on("test:event", handler1);
    bus.on("test:event", handler2);
    bus.removeAllListeners("test:event");
    bus.emit("test:event", "payload");
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
});

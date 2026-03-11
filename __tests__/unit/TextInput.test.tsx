import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TextInput from "@/components/TextInput";

describe("TextInput", () => {
  it("renders input and submit button", () => {
    render(<TextInput onSendMessage={jest.fn()} disabled={false} />);

    expect(screen.getByPlaceholderText("Type a message…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("calls onSendMessage with trimmed text on submit", () => {
    const onSend = jest.fn();
    render(<TextInput onSendMessage={onSend} disabled={false} />);

    const input = screen.getByPlaceholderText("Type a message…");
    fireEvent.change(input, { target: { value: "  Hello world  " } });
    fireEvent.submit(input.closest("form")!);

    expect(onSend).toHaveBeenCalledWith("Hello world");
  });

  it("clears input after submission", () => {
    render(<TextInput onSendMessage={jest.fn()} disabled={false} />);

    const input = screen.getByPlaceholderText("Type a message…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(input.closest("form")!);

    expect(input.value).toBe("");
  });

  it("ignores empty input", () => {
    const onSend = jest.fn();
    render(<TextInput onSendMessage={onSend} disabled={false} />);

    const input = screen.getByPlaceholderText("Type a message…");
    fireEvent.submit(input.closest("form")!);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("ignores whitespace-only input", () => {
    const onSend = jest.fn();
    render(<TextInput onSendMessage={onSend} disabled={false} />);

    const input = screen.getByPlaceholderText("Type a message…");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("respects disabled prop", () => {
    render(<TextInput onSendMessage={jest.fn()} disabled={true} />);

    const input = screen.getByPlaceholderText("Type a message…") as HTMLInputElement;
    const button = screen.getByRole("button", { name: /send/i }) as HTMLButtonElement;

    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
  });

  it("submits on Enter key", () => {
    const onSend = jest.fn();
    render(<TextInput onSendMessage={onSend} disabled={false} />);

    const input = screen.getByPlaceholderText("Type a message…");
    fireEvent.change(input, { target: { value: "Enter test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.submit(input.closest("form")!);

    expect(onSend).toHaveBeenCalledWith("Enter test");
  });
});

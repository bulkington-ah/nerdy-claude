"use client";

import { useState, FormEvent } from "react";

interface TextInputProps {
  onSendMessage: (text: string) => void;
  disabled: boolean;
}

export default function TextInput({ onSendMessage, disabled }: TextInputProps): React.JSX.Element {
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a message…"
        disabled={disabled}
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
      >
        Send
      </button>
    </form>
  );
}

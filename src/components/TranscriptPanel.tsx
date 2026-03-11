"use client";

import { useRef, useEffect } from "react";
import { Message } from "@/types/conversation";

interface TranscriptPanelProps {
  messages: Message[];
  currentAssistantText: string;
}

/**
 * Scrolling conversation transcript display.
 * Shows completed messages and in-progress assistant text.
 */
export default function TranscriptPanel({
  messages,
  currentAssistantText,
}: TranscriptPanelProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentAssistantText]);

  return (
    <div
      ref={scrollRef}
      className="flex h-64 flex-col gap-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {messages.length === 0 && !currentAssistantText && (
        <p className="text-center text-sm text-zinc-400">
          Start speaking to begin a conversation...
        </p>
      )}

      {messages.map((msg, i) => (
        <div
          key={`${msg.timestamp}-${i}`}
          className={`flex flex-col gap-1 ${
            msg.role === "user" ? "items-end" : "items-start"
          }`}
        >
          <span className="text-xs font-medium uppercase text-zinc-400">
            {msg.role === "user" ? "You" : "Tutor"}
          </span>
          <div
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.role === "user"
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {currentAssistantText && (
        <div className="flex flex-col gap-1 items-start">
          <span className="text-xs font-medium uppercase text-zinc-400">
            Tutor
          </span>
          <div className="max-w-[80%] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            {currentAssistantText}
            <span className="ml-1 inline-block animate-pulse">|</span>
          </div>
        </div>
      )}
    </div>
  );
}

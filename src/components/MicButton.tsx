"use client";

import { SessionState } from "@/types/conversation";

interface MicButtonProps {
  sessionState: SessionState;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Mic toggle button with visual states for idle/connecting/listening/thinking/speaking.
 */
export default function MicButton({
  sessionState,
  onStart,
  onStop,
}: MicButtonProps): React.JSX.Element {
  const isActive = sessionState !== "idle";

  const stateStyles: Record<SessionState, string> = {
    idle: "bg-zinc-800 hover:bg-zinc-700 text-white",
    connecting: "bg-yellow-600 text-white animate-pulse",
    listening: "bg-red-600 hover:bg-red-700 text-white animate-pulse",
    thinking: "bg-amber-500 text-white",
    speaking: "bg-green-600 text-white",
  };

  const stateLabels: Record<SessionState, string> = {
    idle: "Start Session",
    connecting: "Connecting...",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
  };

  const handleClick = (): void => {
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={sessionState === "connecting"}
      className={`
        flex items-center justify-center gap-2 rounded-full px-6 py-3
        text-sm font-medium transition-all duration-200
        disabled:cursor-not-allowed disabled:opacity-50
        ${stateStyles[sessionState]}
      `}
    >
      <span className="relative flex h-3 w-3">
        {isActive && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        )}
        <span
          className={`relative inline-flex h-3 w-3 rounded-full ${
            isActive ? "bg-white" : "bg-red-500"
          }`}
        />
      </span>
      {stateLabels[sessionState]}
    </button>
  );
}

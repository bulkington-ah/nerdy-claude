"use client";

interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
  disabled: boolean;
}

/**
 * Toggle button to mute/unmute the microphone during an active session.
 */
export default function MuteButton({
  muted,
  onToggle,
  disabled,
}: MuteButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2 rounded-full px-5 py-2
        text-sm font-medium transition-all duration-200
        disabled:cursor-not-allowed disabled:opacity-50
        ${muted
          ? "bg-red-600 hover:bg-red-700 text-white"
          : "bg-zinc-700 hover:bg-zinc-600 text-white"
        }
      `}
      aria-label={muted ? "Unmute microphone" : "Mute microphone"}
    >
      {muted ? "Unmute" : "Mute"}
    </button>
  );
}

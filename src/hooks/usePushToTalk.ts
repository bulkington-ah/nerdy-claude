import { useState, useEffect, useCallback, useRef } from "react";

interface UsePushToTalkOptions {
  /** Whether PTT is enabled (session is active and not connecting). */
  enabled: boolean;
  /** Ref to the text input element — Space is ignored when this is focused. */
  textInputRef: React.RefObject<HTMLInputElement | null>;
  /** Called with false on keydown (unmute), true on keyup (mute). */
  onMuteChange: (muted: boolean) => void;
  /** Called on keyup to trigger immediate response. */
  onRelease: () => void;
}

interface UsePushToTalkReturn {
  /** Whether the user is currently holding Space. */
  isHolding: boolean;
}

/**
 * Push-to-talk hook: hold Space bar to unmute mic, release to mute and trigger response.
 * Ignores Space when the text input is focused (so the user can type spaces).
 * Treats window blur as a key release to prevent stuck mute state.
 */
export function usePushToTalk({
  enabled,
  textInputRef,
  onMuteChange,
  onRelease,
}: UsePushToTalkOptions): UsePushToTalkReturn {
  const [isHolding, setIsHolding] = useState(false);
  const holdingRef = useRef(false);

  const release = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setIsHolding(false);
    onMuteChange(true);
    onRelease();
  }, [onMuteChange, onRelease]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== " ") return;
      if (e.repeat) return;
      if (document.activeElement === textInputRef.current) return;

      e.preventDefault();
      holdingRef.current = true;
      setIsHolding(true);
      onMuteChange(false);
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.key !== " ") return;
      release();
    };

    const handleBlur = (): void => {
      release();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, textInputRef, onMuteChange, onRelease, release]);

  return { isHolding };
}

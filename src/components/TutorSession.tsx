"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EventBus } from "@/lib/EventBus";
import { SessionManager } from "@/services/SessionManager";
import { AudioAnalyser } from "@/lib/AudioAnalyser";
import { Message, SessionState } from "@/types/conversation";
import { LatencyMetrics } from "@/types/pipeline";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import AvatarCanvas from "@/components/AvatarCanvas";
import TranscriptPanel from "@/components/TranscriptPanel";
import LatencyOverlay from "@/components/LatencyOverlay";
import MicButton from "@/components/MicButton";
import TextInput from "@/components/TextInput";

/**
 * Top-level orchestrator component for the tutoring session.
 * Manages SessionManager lifecycle and wires up all child components.
 */
export default function TutorSession(): React.JSX.Element {
  const [eventBus] = useState(() => new EventBus());
  const [manager] = useState(() => new SessionManager(eventBus));

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAssistantText, setCurrentAssistantText] = useState("");
  const [currentMetrics, setCurrentMetrics] = useState<LatencyMetrics | null>(null);
  const [averageMetrics, setAverageMetrics] = useState<LatencyMetrics | null>(null);
  const [audioAnalyser] = useState<AudioAnalyser>(() => manager.getAudioAnalyser());
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      manager.dispose();
    };
  }, [manager]);

  // Subscribe to EventBus events for UI updates
  useEffect(() => {
    const bus = eventBus;

    const onStateChanged = (payload: unknown): void => {
      setSessionState(payload as SessionState);
    };

    const onTranscriptDelta = (): void => {
      const store = manager as unknown as { conversationStore: { getCurrentAssistantText: () => string } };
      // Access current assistant text through the manager's public transcript
      setCurrentAssistantText(store.conversationStore?.getCurrentAssistantText?.() ?? "");
    };

    const onResponseDone = (): void => {
      setMessages(manager.getTranscript());
      setCurrentAssistantText("");
      setCurrentMetrics(manager.getCurrentMetrics());
      setAverageMetrics(manager.getAverageMetrics());
    };

    const onSpeechStarted = (): void => {
      setSessionState("listening");
    };

    const onSpeechStopped = (): void => {
      setSessionState("thinking");
    };

    const onAudioStarted = (): void => {
      setSessionState("speaking");
    };

    const onUserMessage = (): void => {
      setMessages(manager.getTranscript());
    };

    bus.on("session:state_changed", onStateChanged);
    bus.on("realtime:transcript_delta", onTranscriptDelta);
    bus.on("realtime:transcript_done", onTranscriptDelta);
    bus.on("realtime:audio_transcript_delta", onTranscriptDelta);
    bus.on("realtime:response_done", onResponseDone);
    bus.on("realtime:speech_started", onSpeechStarted);
    bus.on("realtime:speech_stopped", onSpeechStopped);
    bus.on("realtime:audio_started", onAudioStarted);
    bus.on("session:user_message", onUserMessage);

    return () => {
      bus.off("session:state_changed", onStateChanged);
      bus.off("realtime:transcript_delta", onTranscriptDelta);
      bus.off("realtime:transcript_done", onTranscriptDelta);
      bus.off("realtime:audio_transcript_delta", onTranscriptDelta);
      bus.off("realtime:response_done", onResponseDone);
      bus.off("realtime:speech_started", onSpeechStarted);
      bus.off("realtime:speech_stopped", onSpeechStopped);
      bus.off("realtime:audio_started", onAudioStarted);
      bus.off("session:user_message", onUserMessage);
    };
  }, [eventBus, manager]);

  const handleStart = useCallback(() => {
    manager.startSession();
  }, [manager]);

  const handleStop = useCallback(() => {
    manager.endSession();
    setSessionState("idle");
    setCurrentAssistantText("");
  }, [manager]);

  const handleSetMuted = useCallback((muted: boolean) => {
    manager.setMuted(muted);
  }, [manager]);

  const handlePttRelease = useCallback(() => {
    manager.triggerResponse();
  }, [manager]);

  const isSessionActive = sessionState !== "idle" && sessionState !== "connecting";

  const { isHolding } = usePushToTalk({
    enabled: isSessionActive,
    textInputRef,
    onMuteChange: handleSetMuted,
    onRelease: handlePttRelease,
  });

  const handleSendMessage = useCallback((text: string) => {
    manager.sendTextMessage(text);
  }, [manager]);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-50 px-4 py-8 dark:bg-black">
      {/* Avatar */}
      <AvatarCanvas
        eventBus={eventBus}
        audioAnalyser={audioAnalyser}
        width={300}
        height={300}
      />

      {/* Controls */}
      <div className="flex items-center gap-3">
        <MicButton
          sessionState={sessionState}
          onStart={handleStart}
          onStop={handleStop}
        />
        {isSessionActive && (
          <div
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              isHolding
                ? "bg-red-600 text-white animate-pulse"
                : "bg-zinc-700 text-zinc-300"
            }`}
          >
            {isHolding ? "Listening..." : "Hold Space to talk"}
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="w-full max-w-lg">
        <TranscriptPanel
          messages={messages}
          currentAssistantText={currentAssistantText}
        />
        <div className="mt-3">
          <TextInput
            ref={textInputRef}
            onSendMessage={handleSendMessage}
            disabled={sessionState === "idle" || sessionState === "connecting"}
          />
        </div>
      </div>

      {/* Latency HUD */}
      <div className="w-full max-w-lg">
        <LatencyOverlay
          currentMetrics={currentMetrics}
          averageMetrics={averageMetrics}
        />
      </div>
    </div>
  );
}

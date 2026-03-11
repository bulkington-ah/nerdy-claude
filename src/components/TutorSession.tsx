"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { EventBus } from "@/lib/EventBus";
import { SessionManager } from "@/services/SessionManager";
import { Message, SessionState } from "@/types/conversation";
import { LatencyMetrics } from "@/types/pipeline";
import AvatarCanvas from "@/components/AvatarCanvas";
import TranscriptPanel from "@/components/TranscriptPanel";
import LatencyOverlay from "@/components/LatencyOverlay";
import MicButton from "@/components/MicButton";

/**
 * Top-level orchestrator component for the tutoring session.
 * Manages SessionManager lifecycle and wires up all child components.
 */
export default function TutorSession(): React.JSX.Element {
  const eventBusRef = useRef<EventBus>(new EventBus());
  const managerRef = useRef<SessionManager | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAssistantText, setCurrentAssistantText] = useState("");
  const [currentMetrics, setCurrentMetrics] = useState<LatencyMetrics | null>(null);
  const [averageMetrics, setAverageMetrics] = useState<LatencyMetrics | null>(null);

  // Initialize SessionManager once
  useEffect(() => {
    const manager = new SessionManager(eventBusRef.current);
    managerRef.current = manager;

    return () => {
      manager.dispose();
      managerRef.current = null;
    };
  }, []);

  // Subscribe to EventBus events for UI updates
  useEffect(() => {
    const bus = eventBusRef.current;

    const onStateChanged = (payload: unknown): void => {
      setSessionState(payload as SessionState);
    };

    const onTranscriptDelta = (): void => {
      if (!managerRef.current) return;
      const store = managerRef.current as unknown as { conversationStore: { getCurrentAssistantText: () => string } };
      // Access current assistant text through the manager's public transcript
      setCurrentAssistantText(store.conversationStore?.getCurrentAssistantText?.() ?? "");
    };

    const onResponseDone = (): void => {
      if (!managerRef.current) return;
      setMessages(managerRef.current.getTranscript());
      setCurrentAssistantText("");
      setCurrentMetrics(managerRef.current.getCurrentMetrics());
      setAverageMetrics(managerRef.current.getAverageMetrics());
    };

    const onSpeechStarted = (): void => {
      setSessionState("listening");
    };

    const onSpeechStopped = (): void => {
      setSessionState("thinking");
    };

    const onAudioDelta = (): void => {
      setSessionState("speaking");
      // Update in-progress text
      if (managerRef.current) {
        setMessages(managerRef.current.getTranscript());
      }
    };

    bus.on("session:state_changed", onStateChanged);
    bus.on("realtime:transcript_delta", onTranscriptDelta);
    bus.on("realtime:response_done", onResponseDone);
    bus.on("realtime:speech_started", onSpeechStarted);
    bus.on("realtime:speech_stopped", onSpeechStopped);
    bus.on("realtime:audio_delta", onAudioDelta);

    return () => {
      bus.off("session:state_changed", onStateChanged);
      bus.off("realtime:transcript_delta", onTranscriptDelta);
      bus.off("realtime:response_done", onResponseDone);
      bus.off("realtime:speech_started", onSpeechStarted);
      bus.off("realtime:speech_stopped", onSpeechStopped);
      bus.off("realtime:audio_delta", onAudioDelta);
    };
  }, []);

  const handleStart = useCallback(() => {
    managerRef.current?.startSession();
  }, []);

  const handleStop = useCallback(() => {
    managerRef.current?.endSession();
    setSessionState("idle");
    setCurrentAssistantText("");
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-50 px-4 py-8 dark:bg-black">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        AI Tutor
      </h1>

      {/* Avatar */}
      <div className="relative">
        <AvatarCanvas
          eventBus={eventBusRef.current}
          width={300}
          height={300}
        />
        {/* State indicator badge */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium capitalize text-white">
            {sessionState}
          </span>
        </div>
      </div>

      {/* Controls */}
      <MicButton
        sessionState={sessionState}
        onStart={handleStart}
        onStop={handleStop}
      />

      {/* Transcript */}
      <div className="w-full max-w-lg">
        <TranscriptPanel
          messages={messages}
          currentAssistantText={currentAssistantText}
        />
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

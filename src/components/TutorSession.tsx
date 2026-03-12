"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { EventBus } from "@/lib/EventBus";
import { SessionManager } from "@/services/SessionManager";
import { AudioAnalyser } from "@/lib/AudioAnalyser";
import { Message, SessionState } from "@/types/conversation";
import { LatencyMetrics } from "@/types/pipeline";
import AvatarCanvas from "@/components/AvatarCanvas";
import TranscriptPanel from "@/components/TranscriptPanel";
import LatencyOverlay from "@/components/LatencyOverlay";
import MicButton from "@/components/MicButton";
import MuteButton from "@/components/MuteButton";
import TextInput from "@/components/TextInput";

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
  const [audioAnalyser, setAudioAnalyser] = useState<AudioAnalyser | null>(null);
  const [muted, setMuted] = useState(false);

  // Initialize SessionManager once
  useEffect(() => {
    const manager = new SessionManager(eventBusRef.current);
    managerRef.current = manager;
    setAudioAnalyser(manager.getAudioAnalyser());

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

    const onAudioStarted = (): void => {
      setSessionState("speaking");
    };

    const onUserMessage = (): void => {
      if (!managerRef.current) return;
      setMessages(managerRef.current.getTranscript());
    };

    bus.on("session:state_changed", onStateChanged);
    bus.on("realtime:transcript_delta", onTranscriptDelta);
    bus.on("realtime:response_done", onResponseDone);
    bus.on("realtime:speech_started", onSpeechStarted);
    bus.on("realtime:speech_stopped", onSpeechStopped);
    bus.on("realtime:audio_started", onAudioStarted);
    bus.on("session:user_message", onUserMessage);

    return () => {
      bus.off("session:state_changed", onStateChanged);
      bus.off("realtime:transcript_delta", onTranscriptDelta);
      bus.off("realtime:response_done", onResponseDone);
      bus.off("realtime:speech_started", onSpeechStarted);
      bus.off("realtime:speech_stopped", onSpeechStopped);
      bus.off("realtime:audio_started", onAudioStarted);
      bus.off("session:user_message", onUserMessage);
    };
  }, []);

  const handleStart = useCallback(() => {
    managerRef.current?.startSession();
  }, []);

  const handleStop = useCallback(() => {
    managerRef.current?.endSession();
    setSessionState("idle");
    setCurrentAssistantText("");
    setMuted(false);
  }, []);

  const handleToggleMute = useCallback(() => {
    managerRef.current?.toggleMute();
    setMuted(managerRef.current?.isMuted() ?? false);
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    managerRef.current?.sendTextMessage(text);
  }, []);

  return (
    <div className="relative min-h-screen bg-zinc-50 px-4 py-8 dark:bg-black">
      {/* Left column — Chat & Transcript */}
      <div className="absolute left-4 top-8 w-full max-w-md">
        <TranscriptPanel
          messages={messages}
          currentAssistantText={currentAssistantText}
        />
        <div className="mt-3">
          <TextInput
            onSendMessage={handleSendMessage}
            disabled={sessionState === "idle" || sessionState === "connecting"}
          />
        </div>
      </div>

      {/* Center column — Avatar & Controls */}
      <div className="flex flex-col items-center gap-6">
        {/* Avatar */}
        <AvatarCanvas
          eventBus={eventBusRef.current}
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
          <MuteButton
            muted={muted}
            onToggle={handleToggleMute}
            disabled={sessionState === "idle" || sessionState === "connecting"}
          />
        </div>
      </div>

      {/* Top-right — Latency HUD */}
      <div className="absolute right-4 top-8 w-full max-w-sm">
        <LatencyOverlay
          currentMetrics={currentMetrics}
          averageMetrics={averageMetrics}
        />
      </div>
    </div>
  );
}

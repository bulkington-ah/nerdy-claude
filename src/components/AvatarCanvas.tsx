"use client";

import { useRef, useEffect } from "react";
import { AvatarService } from "@/services/AvatarService";
import { EventBus } from "@/lib/EventBus";
import { AudioAnalyser } from "@/lib/AudioAnalyser";

interface AvatarCanvasProps {
  eventBus: EventBus;
  audioAnalyser?: AudioAnalyser | null;
  width?: number;
  height?: number;
}

/**
 * React wrapper for the procedural canvas avatar.
 * Initializes AvatarService with the canvas ref and cleans up on unmount.
 */
export default function AvatarCanvas({
  eventBus,
  audioAnalyser,
  width = 300,
  height = 300,
}: AvatarCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serviceRef = useRef<AvatarService | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const service = new AvatarService(eventBus);
    serviceRef.current = service;

    // Wire up AudioAnalyser immediately if already available
    if (audioAnalyser) {
      service.setAudioAnalyser(audioAnalyser);
    }

    service.initCanvas(canvas);

    return () => {
      service.dispose();
      serviceRef.current = null;
    };
  }, [eventBus, audioAnalyser]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block" }}
    />
  );
}

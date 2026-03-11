"use client";

import { useRef, useEffect } from "react";
import { AvatarService } from "@/services/AvatarService";
import { EventBus } from "@/lib/EventBus";

interface AvatarCanvasProps {
  eventBus: EventBus;
  riveSrc?: string;
  width?: number;
  height?: number;
  onServiceReady?: (service: AvatarService) => void;
}

/**
 * React wrapper for the Rive canvas avatar.
 * Initializes AvatarService with the canvas ref and cleans up on unmount.
 */
export default function AvatarCanvas({
  eventBus,
  riveSrc = "/tutor-avatar.riv",
  width = 400,
  height = 400,
  onServiceReady,
}: AvatarCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serviceRef = useRef<AvatarService | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const service = new AvatarService(eventBus);
    serviceRef.current = service;

    service
      .loadRive(canvas, riveSrc)
      .then(() => {
        onServiceReady?.(service);
      })
      .catch(() => {
        // Rive load failed — avatar will show static canvas
      });

    return () => {
      service.dispose();
      serviceRef.current = null;
    };
  }, [eventBus, riveSrc, onServiceReady]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block" }}
    />
  );
}

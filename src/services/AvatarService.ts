import { EventBus } from "@/lib/EventBus";
import { AudioAnalyser } from "@/lib/AudioAnalyser";
import { AvatarExpression, AvatarInputs } from "@/types/avatar";

// Ring/glow colors for each expression state
const STATE_COLORS: Record<AvatarExpression, string> = {
  idle: "#6B7280",
  listening: "#10B981",
  thinking: "#F59E0B",
  talking: "#3B82F6",
};

const FACE_COLOR = "#FCD34D";
const FACE_SHADOW = "#F59E0B";
const EYE_COLOR = "#1F2937";
const MOUTH_COLOR = "#DC2626";
const MOUTH_INTERIOR = "#7F1D1D";

/**
 * Manages a procedural canvas avatar that changes glow color based on state.
 * Listens for expression change events via EventBus and reads audio amplitude
 * from AudioAnalyser each frame to drive mouth movement.
 */
export class AvatarService {
  private eventBus: EventBus;
  private expression: AvatarExpression = "idle";
  private mouthOpen: number = 0;
  private smoothedMouth: number = 0;
  private audioAnalyser: AudioAnalyser | null = null;
  private animationFrameId: number | null = null;
  private disposed: boolean = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Animation state
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;
  private frameCount: number = 0;

  // Deferred idle: hold "talking" until audio actually stops
  private pendingIdle: boolean = false;
  private silenceFrames: number = 0;
  private static readonly SILENCE_THRESHOLD = 0.01;
  private static readonly SILENCE_FRAMES_REQUIRED = 20; // ~333ms at 60fps

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
  }

  /** Set the audio analyser for lip-sync amplitude readings. */
  public setAudioAnalyser(analyser: AudioAnalyser): void {
    this.audioAnalyser = analyser;
  }

  /** Get the current avatar expression. */
  public getExpression(): AvatarExpression {
    return this.expression;
  }

  /** Set the avatar expression directly. */
  public setExpression(expression: AvatarExpression): void {
    // When switching from talking to idle, defer until audio actually stops
    if (expression === "idle" && this.expression === "talking") {
      this.pendingIdle = true;
      this.silenceFrames = 0;
      return;
    }
    // Any other transition cancels pending idle
    this.pendingIdle = false;
    this.silenceFrames = 0;
    this.expression = expression;
  }

  /** Get the current avatar inputs (expression booleans + mouth open). */
  public getAvatarInputs(): AvatarInputs {
    return {
      mouthOpen: this.mouthOpen,
      isTalking: this.expression === "talking",
      isListening: this.expression === "listening",
      isThinking: this.expression === "thinking",
      isIdle: this.expression === "idle",
    };
  }

  /** Read amplitude from the audio analyser and update mouthOpen. */
  public updateMouthOpen(): void {
    if (this.audioAnalyser) {
      this.mouthOpen = this.audioAnalyser.getAmplitude();
    } else {
      this.mouthOpen = 0;
    }
    // Smooth the mouth value to avoid jitter
    this.smoothedMouth += (this.mouthOpen - this.smoothedMouth) * 0.3;
  }

  /**
   * Initialize the canvas for procedural avatar rendering.
   * Starts the animation loop.
   */
  public initCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.startAnimationLoop();
  }

  /** Start the requestAnimationFrame loop. */
  private startAnimationLoop(): void {
    const tick = (): void => {
      if (this.disposed) return;
      this.updateMouthOpen();
      this.updatePendingIdle();
      this.updateBlink();
      this.drawFrame();
      this.frameCount++;
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  /** Check if deferred idle should now fire (audio has gone silent). */
  private updatePendingIdle(): void {
    if (!this.pendingIdle) return;

    if (this.mouthOpen < AvatarService.SILENCE_THRESHOLD) {
      this.silenceFrames++;
    } else {
      this.silenceFrames = 0;
    }

    if (this.silenceFrames >= AvatarService.SILENCE_FRAMES_REQUIRED) {
      this.pendingIdle = false;
      this.silenceFrames = 0;
      this.expression = "idle";
    }
  }

  /** Periodic blink logic. */
  private updateBlink(): void {
    this.blinkTimer++;
    if (!this.isBlinking && this.blinkTimer > 180 + Math.random() * 120) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }
    if (this.isBlinking && this.blinkTimer > 6) {
      this.isBlinking = false;
      this.blinkTimer = 0;
    }
  }

  /** Draw the full avatar frame. */
  private drawFrame(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.35;
    const color = STATE_COLORS[this.expression];

    ctx.clearRect(0, 0, w, h);

    // Pulsing glow ring (color changes with state)
    const pulse = 0.6 + 0.4 * Math.sin(this.frameCount * 0.03);
    const glowRadius = radius + 12;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.restore();

    // Face circle with gradient
    const gradient = ctx.createRadialGradient(
      cx - radius * 0.2, cy - radius * 0.2, radius * 0.1,
      cx, cy, radius,
    );
    gradient.addColorStop(0, FACE_COLOR);
    gradient.addColorStop(1, FACE_SHADOW);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "#D97706";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    this.drawEyes(ctx, cx, cy, radius);

    // Mouth
    this.drawMouth(ctx, cx, cy, radius);
  }

  private drawEyes(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
  ): void {
    const eyeOffsetX = radius * 0.3;
    const eyeY = cy - radius * 0.15;

    let eyeWidth = radius * 0.12;
    let eyeHeight = radius * 0.15;

    if (this.expression === "listening") {
      eyeHeight = radius * 0.18;
    } else if (this.expression === "thinking") {
      eyeHeight = radius * 0.08;
    }

    if (this.isBlinking) {
      eyeHeight = radius * 0.02;
    }

    this.drawEye(ctx, cx - eyeOffsetX, eyeY, eyeWidth, eyeHeight);
    this.drawEye(ctx, cx + eyeOffsetX, eyeY, eyeWidth, eyeHeight);
  }

  private drawEye(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
  ): void {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fillStyle = EYE_COLOR;
    ctx.fill();

    if (h > w * 0.3) {
      ctx.beginPath();
      ctx.ellipse(x + w * 0.25, y - h * 0.25, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
    }
  }

  private drawMouth(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
  ): void {
    const mouthY = cy + radius * 0.3;
    const mouthWidth = radius * 0.35;

    if (this.expression === "talking") {
      const openAmount = Math.max(0.05, this.smoothedMouth);
      const mouthHeight = radius * 0.4 * openAmount;

      ctx.beginPath();
      ctx.ellipse(cx, mouthY, mouthWidth * (0.6 + openAmount * 0.4), mouthHeight, 0, 0, Math.PI * 2);
      ctx.fillStyle = MOUTH_INTERIOR;
      ctx.fill();
      ctx.strokeStyle = MOUTH_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.expression === "thinking") {
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, radius * 0.08, radius * 0.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = MOUTH_INTERIOR;
      ctx.fill();
      ctx.strokeStyle = MOUTH_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.expression === "listening") {
      ctx.beginPath();
      ctx.arc(cx, mouthY - radius * 0.05, mouthWidth * 0.6, 0.1 * Math.PI, 0.9 * Math.PI, false);
      ctx.strokeStyle = MOUTH_COLOR;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, mouthY, mouthWidth * 0.5, 0.05 * Math.PI, 0.95 * Math.PI, false);
      ctx.strokeStyle = MOUTH_COLOR;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  /** Clean up resources. */
  public dispose(): void {
    this.disposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.expression = "idle";
    this.mouthOpen = 0;
    this.smoothedMouth = 0;
  }

  private setupEventListeners(): void {
    this.eventBus.on("avatar:set_expression", (payload: unknown) => {
      if (typeof payload === "string") {
        this.setExpression(payload as AvatarExpression);
      }
    });
  }
}

import { EventBus } from "@/lib/EventBus";
import { AudioAnalyser } from "@/lib/AudioAnalyser";
import { AvatarExpression, AvatarInputs } from "@/types/avatar";

/**
 * Manages the Rive avatar state machine and lip-sync.
 * Listens for expression change events via EventBus and reads audio amplitude
 * from AudioAnalyser each frame to drive mouth movement.
 */
export class AvatarService {
  private eventBus: EventBus;
  private expression: AvatarExpression = "idle";
  private mouthOpen: number = 0;
  private audioAnalyser: AudioAnalyser | null = null;
  private animationFrameId: number | null = null;
  private disposed: boolean = false;

  // Rive instance — initialized when loadRive() is called with a canvas
  private riveInstance: unknown = null;

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
  }

  /**
   * Load the Rive animation into a canvas element.
   * Starts the animation loop for lip-sync.
   */
  public async loadRive(canvas: HTMLCanvasElement, riveSrc: string): Promise<void> {
    const { Rive } = await import("@rive-app/canvas");

    return new Promise<void>((resolve) => {
      this.riveInstance = new Rive({
        src: riveSrc,
        canvas,
        autoplay: true,
        stateMachines: "TutorStateMachine",
        onLoad: () => {
          this.startAnimationLoop();
          resolve();
        },
      });
    });
  }

  /** Start the requestAnimationFrame loop for lip-sync updates. */
  private startAnimationLoop(): void {
    const tick = (): void => {
      if (this.disposed) return;
      this.updateMouthOpen();
      // In production, we'd set the Rive state machine inputs here
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  /** Clean up resources. */
  public dispose(): void {
    this.disposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.riveInstance && typeof (this.riveInstance as { cleanup: () => void }).cleanup === "function") {
      (this.riveInstance as { cleanup: () => void }).cleanup();
    }
    this.riveInstance = null;
    this.expression = "idle";
    this.mouthOpen = 0;
  }

  private setupEventListeners(): void {
    this.eventBus.on("avatar:set_expression", (payload: unknown) => {
      if (typeof payload === "string") {
        this.setExpression(payload as AvatarExpression);
      }
    });
  }
}

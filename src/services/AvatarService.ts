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

  // Rive instance and state machine inputs
  private riveInstance: unknown = null;
  private riveInputs: Map<string, { value: number | boolean }> = new Map();

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

    const stateMachineName = "State Machine 1";

    return new Promise<void>((resolve) => {
      const rive = new Rive({
        src: riveSrc,
        canvas,
        autoplay: true,
        stateMachines: stateMachineName,
        onLoad: () => {
          // Grab state machine inputs by name
          const inputs = rive.stateMachineInputs(stateMachineName) ?? [];
          for (const input of inputs) {
            this.riveInputs.set(input.name, input as { value: number | boolean });
          }
          this.startAnimationLoop();
          resolve();
        },
      });
      this.riveInstance = rive;
    });
  }

  /** Start the requestAnimationFrame loop for lip-sync updates. */
  private startAnimationLoop(): void {
    const tick = (): void => {
      if (this.disposed) return;
      this.updateMouthOpen();
      this.applyRiveInputs();
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  /** Push current state to Rive state machine inputs. */
  private applyRiveInputs(): void {
    // Mouth amplitude → "Mouth" input (Number 0-1)
    const mouthInput = this.riveInputs.get("Mouth");
    if (mouthInput) {
      mouthInput.value = this.mouthOpen;
    }

    // Expression → "talk" (Boolean) and "idle" (Boolean)
    // Map: talking → talk=true, idle=false
    //       listening/thinking/idle → talk=false, idle=true
    const talkInput = this.riveInputs.get("talk");
    const idleInput = this.riveInputs.get("idle");
    if (talkInput) {
      talkInput.value = this.expression === "talking";
    }
    if (idleInput) {
      idleInput.value = this.expression !== "talking";
    }
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

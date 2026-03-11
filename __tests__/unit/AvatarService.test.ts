import { AvatarService } from "@/services/AvatarService";
import { EventBus } from "@/lib/EventBus";
import { AudioAnalyser } from "@/lib/AudioAnalyser";

// Mock AudioAnalyser
jest.mock("@/lib/AudioAnalyser");

describe("AvatarService", () => {
  let service: AvatarService;
  let eventBus: EventBus;
  let mockAnalyser: jest.Mocked<AudioAnalyser>;

  beforeEach(() => {
    eventBus = new EventBus();
    mockAnalyser = new AudioAnalyser(null as unknown as AnalyserNode) as jest.Mocked<AudioAnalyser>;
    mockAnalyser.getAmplitude = jest.fn().mockReturnValue(0);
    service = new AvatarService(eventBus);
  });

  afterEach(() => {
    service.dispose();
  });

  it("should start in idle state", () => {
    expect(service.getExpression()).toBe("idle");
  });

  it("should transition to listening state", () => {
    service.setExpression("listening");
    expect(service.getExpression()).toBe("listening");
  });

  it("should transition to thinking state", () => {
    service.setExpression("thinking");
    expect(service.getExpression()).toBe("thinking");
  });

  it("should transition to talking state", () => {
    service.setExpression("talking");
    expect(service.getExpression()).toBe("talking");
  });

  it("should respond to EventBus avatar state events", () => {
    eventBus.emit("avatar:set_expression", "listening");
    expect(service.getExpression()).toBe("listening");
  });

  it("should compute avatar inputs from current state", () => {
    service.setExpression("talking");
    const inputs = service.getAvatarInputs();
    expect(inputs.isTalking).toBe(true);
    expect(inputs.isListening).toBe(false);
    expect(inputs.isThinking).toBe(false);
    expect(inputs.isIdle).toBe(false);
  });

  it("should set mouth open from audio analyser", () => {
    mockAnalyser.getAmplitude.mockReturnValue(0.75);
    service.setAudioAnalyser(mockAnalyser);
    service.updateMouthOpen();

    const inputs = service.getAvatarInputs();
    expect(inputs.mouthOpen).toBeCloseTo(0.75);
  });

  it("should return 0 mouth open when no analyser is set", () => {
    service.updateMouthOpen();
    const inputs = service.getAvatarInputs();
    expect(inputs.mouthOpen).toBe(0);
  });

  it("should clean up on dispose", () => {
    service.dispose();
    expect(service.getExpression()).toBe("idle");
  });

  it("should initialize canvas and start animation loop", () => {
    const canvas = {
      getContext: jest.fn().mockReturnValue({
        clearRect: jest.fn(),
        beginPath: jest.fn(),
        arc: jest.fn(),
        ellipse: jest.fn(),
        fill: jest.fn(),
        stroke: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        createRadialGradient: jest.fn().mockReturnValue({
          addColorStop: jest.fn(),
        }),
        fillText: jest.fn(),
      }),
      width: 300,
      height: 300,
    } as unknown as HTMLCanvasElement;

    service.initCanvas(canvas);
    expect(canvas.getContext).toHaveBeenCalledWith("2d");
  });
});

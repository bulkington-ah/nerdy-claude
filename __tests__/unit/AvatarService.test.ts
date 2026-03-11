import { AvatarService } from "@/services/AvatarService";
import { EventBus } from "@/lib/EventBus";
import { AudioAnalyser } from "@/lib/AudioAnalyser";

// Mock AudioAnalyser
jest.mock("@/lib/AudioAnalyser");

// Mock Rive — we can't import the actual package in tests
const mockStateMachineInput = {
  value: 0 as number | boolean,
};

const mockRiveInstance = {
  cleanup: jest.fn(),
};

jest.mock("@rive-app/canvas", () => ({
  Rive: jest.fn().mockImplementation((config: { onLoad?: () => void }) => {
    if (config.onLoad) {
      setTimeout(() => config.onLoad!(), 0);
    }
    return mockRiveInstance;
  }),
  StateMachineInput: jest.fn(),
}));

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
    // Should not throw
    expect(service.getExpression()).toBe("idle");
  });
});

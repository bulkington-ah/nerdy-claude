import { LatencyTracker } from "@/lib/LatencyTracker";
import { PipelineStage, LATENCY_BUDGETS } from "@/types/pipeline";

describe("End-to-End Latency", () => {
  let tracker: LatencyTracker;

  beforeEach(() => {
    tracker = new LatencyTracker();
  });

  it("should measure full e2e pipeline under 1000ms budget", () => {
    // Simulate the full event sequence timing
    tracker.markStart(PipelineStage.END_TO_END);
    tracker.markStart(PipelineStage.INPUT_PROCESSING);

    // Simulate input processing delay
    const t1 = performance.now();
    while (performance.now() - t1 < 2) {
      /* busy wait */
    }

    tracker.markEnd(PipelineStage.INPUT_PROCESSING);
    tracker.markStart(PipelineStage.TIME_TO_FIRST_AUDIO);

    // Simulate time to first audio
    const t2 = performance.now();
    while (performance.now() - t2 < 2) {
      /* busy wait */
    }

    tracker.markEnd(PipelineStage.TIME_TO_FIRST_AUDIO);
    tracker.markEnd(PipelineStage.END_TO_END);
    tracker.markStart(PipelineStage.FULL_RESPONSE);

    // Simulate response streaming
    const t3 = performance.now();
    while (performance.now() - t3 < 2) {
      /* busy wait */
    }

    tracker.markEnd(PipelineStage.FULL_RESPONSE);

    const metrics = tracker.computeCurrentMetrics();

    // All stages should be measured
    expect(metrics.inputProcessingMs).toBeGreaterThan(0);
    expect(metrics.timeToFirstAudioMs).toBeGreaterThan(0);
    expect(metrics.fullResponseMs).toBeGreaterThan(0);
    expect(metrics.endToEndMs).toBeGreaterThan(0);

    // E2E should be within the max acceptable budget
    expect(metrics.endToEndMs).toBeLessThan(
      LATENCY_BUDGETS[PipelineStage.END_TO_END].maxAcceptableMs,
    );
  });

  it("should track that input processing + TTFA ≈ e2e", () => {
    tracker.markStart(PipelineStage.END_TO_END);
    tracker.markStart(PipelineStage.INPUT_PROCESSING);

    const t1 = performance.now();
    while (performance.now() - t1 < 3) {
      /* busy wait */
    }

    tracker.markEnd(PipelineStage.INPUT_PROCESSING);
    tracker.markStart(PipelineStage.TIME_TO_FIRST_AUDIO);

    const t2 = performance.now();
    while (performance.now() - t2 < 3) {
      /* busy wait */
    }

    tracker.markEnd(PipelineStage.TIME_TO_FIRST_AUDIO);
    tracker.markEnd(PipelineStage.END_TO_END);

    const metrics = tracker.computeCurrentMetrics();

    // E2E should be roughly input_processing + time_to_first_audio
    const sum = metrics.inputProcessingMs + metrics.timeToFirstAudioMs;
    // Allow 5ms tolerance for measurement overhead
    expect(Math.abs(metrics.endToEndMs - sum)).toBeLessThan(5);
  });

  it("should return zero for unmeasured stages", () => {
    // Only measure one stage
    tracker.markStart(PipelineStage.INPUT_PROCESSING);
    tracker.markEnd(PipelineStage.INPUT_PROCESSING);

    const metrics = tracker.computeCurrentMetrics();
    expect(metrics.inputProcessingMs).toBeGreaterThan(0);
    expect(metrics.timeToFirstAudioMs).toBe(0);
    expect(metrics.fullResponseMs).toBe(0);
    expect(metrics.endToEndMs).toBe(0);
  });
});

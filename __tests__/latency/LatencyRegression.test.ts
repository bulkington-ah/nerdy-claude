import { LatencyTracker } from "@/lib/LatencyTracker";
import { PipelineStage, LATENCY_BUDGETS } from "@/types/pipeline";

describe("Latency Regression", () => {
  let tracker: LatencyTracker;

  beforeEach(() => {
    tracker = new LatencyTracker();
  });

  it("should measure input processing within budget", () => {
    tracker.markStart(PipelineStage.INPUT_PROCESSING);
    // Simulate ~100ms processing
    const start = performance.now();
    while (performance.now() - start < 5) {
      // busy wait a tiny bit to ensure measurable duration
    }
    tracker.markEnd(PipelineStage.INPUT_PROCESSING);

    const metrics = tracker.computeCurrentMetrics();
    expect(metrics.inputProcessingMs).toBeGreaterThan(0);
    expect(metrics.inputProcessingMs).toBeLessThan(
      LATENCY_BUDGETS[PipelineStage.INPUT_PROCESSING].maxAcceptableMs,
    );
  });

  it("should measure time to first audio within budget", () => {
    tracker.markStart(PipelineStage.TIME_TO_FIRST_AUDIO);
    const start = performance.now();
    while (performance.now() - start < 5) {
      // busy wait
    }
    tracker.markEnd(PipelineStage.TIME_TO_FIRST_AUDIO);

    const metrics = tracker.computeCurrentMetrics();
    expect(metrics.timeToFirstAudioMs).toBeGreaterThan(0);
    expect(metrics.timeToFirstAudioMs).toBeLessThan(
      LATENCY_BUDGETS[PipelineStage.TIME_TO_FIRST_AUDIO].maxAcceptableMs,
    );
  });

  it("should compute accurate averages across multiple turns", () => {
    // Turn 1
    tracker.markStart(PipelineStage.END_TO_END);
    tracker.markEnd(PipelineStage.END_TO_END);
    tracker.finalizeTurn();

    // Turn 2
    tracker.markStart(PipelineStage.END_TO_END);
    tracker.markEnd(PipelineStage.END_TO_END);
    tracker.finalizeTurn();

    const averages = tracker.getAverages();
    expect(averages.endToEndMs).toBeGreaterThanOrEqual(0);
    expect(tracker.getHistory()).toHaveLength(2);
  });
});

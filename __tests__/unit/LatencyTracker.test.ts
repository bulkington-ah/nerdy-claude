import { LatencyTracker } from "@/lib/LatencyTracker";
import { PipelineStage } from "@/types/pipeline";

describe("LatencyTracker", () => {
  let tracker: LatencyTracker;

  beforeEach(() => {
    tracker = new LatencyTracker();
  });

  it("should record start and end marks for a stage", () => {
    tracker.markStart(PipelineStage.INPUT_PROCESSING);
    tracker.markEnd(PipelineStage.INPUT_PROCESSING);
    const metrics = tracker.computeCurrentMetrics();
    expect(metrics.inputProcessingMs).toBeGreaterThanOrEqual(0);
  });

  it("should compute end-to-end as speech_stopped to first audio play", () => {
    tracker.markStart(PipelineStage.END_TO_END);
    tracker.markEnd(PipelineStage.INPUT_PROCESSING);
    tracker.markEnd(PipelineStage.TIME_TO_FIRST_AUDIO);
    tracker.markEnd(PipelineStage.END_TO_END);
    const metrics = tracker.computeCurrentMetrics();
    expect(metrics.endToEndMs).toBeGreaterThanOrEqual(0);
  });

  it("should finalize a turn and add to history", () => {
    tracker.markStart(PipelineStage.END_TO_END);
    tracker.markEnd(PipelineStage.END_TO_END);
    const metrics = tracker.finalizeTurn();
    expect(metrics.timestamp).toBeGreaterThan(0);
    expect(tracker.getHistory()).toHaveLength(1);
  });

  it("should compute averages from history", () => {
    // Turn 1
    tracker.markStart(PipelineStage.END_TO_END);
    tracker.markStart(PipelineStage.INPUT_PROCESSING);
    tracker.markEnd(PipelineStage.INPUT_PROCESSING);
    tracker.markEnd(PipelineStage.END_TO_END);
    tracker.finalizeTurn();

    // Turn 2
    tracker.markStart(PipelineStage.END_TO_END);
    tracker.markStart(PipelineStage.INPUT_PROCESSING);
    tracker.markEnd(PipelineStage.INPUT_PROCESSING);
    tracker.markEnd(PipelineStage.END_TO_END);
    tracker.finalizeTurn();

    const averages = tracker.getAverages();
    expect(averages.endToEndMs).toBeGreaterThanOrEqual(0);
    expect(averages.inputProcessingMs).toBeGreaterThanOrEqual(0);
  });

  it("should reset current turn marks", () => {
    tracker.markStart(PipelineStage.INPUT_PROCESSING);
    tracker.reset();
    const metrics = tracker.computeCurrentMetrics();
    expect(metrics.inputProcessingMs).toBe(0);
  });

  it("should return zero for stages not yet marked", () => {
    const metrics = tracker.computeCurrentMetrics();
    expect(metrics.inputProcessingMs).toBe(0);
    expect(metrics.timeToFirstAudioMs).toBe(0);
    expect(metrics.fullResponseMs).toBe(0);
    expect(metrics.endToEndMs).toBe(0);
  });
});

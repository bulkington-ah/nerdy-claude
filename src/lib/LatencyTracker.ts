import { PipelineStage, LatencyMetrics } from "@/types/pipeline";

interface StageMark {
  start?: number;
  end?: number;
}

export class LatencyTracker {
  private currentTurn: Map<PipelineStage, StageMark> = new Map();
  private history: LatencyMetrics[] = [];

  public markStart(stage: PipelineStage): void {
    const mark = this.currentTurn.get(stage) ?? {};
    mark.start = performance.now();
    this.currentTurn.set(stage, mark);
  }

  public markEnd(stage: PipelineStage): void {
    const mark = this.currentTurn.get(stage) ?? {};
    mark.end = performance.now();
    this.currentTurn.set(stage, mark);
  }

  public computeCurrentMetrics(): LatencyMetrics {
    return {
      inputProcessingMs: this.getStageDuration(PipelineStage.INPUT_PROCESSING),
      timeToFirstAudioMs: this.getStageDuration(PipelineStage.TIME_TO_FIRST_AUDIO),
      fullResponseMs: this.getStageDuration(PipelineStage.FULL_RESPONSE),
      endToEndMs: this.getStageDuration(PipelineStage.END_TO_END),
      timestamp: Date.now(),
    };
  }

  public finalizeTurn(): LatencyMetrics {
    const metrics = this.computeCurrentMetrics();
    this.history.push(metrics);
    this.currentTurn.clear();
    return metrics;
  }

  public getHistory(): LatencyMetrics[] {
    return [...this.history];
  }

  public getAverages(): LatencyMetrics {
    if (this.history.length === 0) {
      return {
        inputProcessingMs: 0,
        timeToFirstAudioMs: 0,
        fullResponseMs: 0,
        endToEndMs: 0,
        timestamp: Date.now(),
      };
    }

    const sum = this.history.reduce(
      (acc, m) => ({
        inputProcessingMs: acc.inputProcessingMs + m.inputProcessingMs,
        timeToFirstAudioMs: acc.timeToFirstAudioMs + m.timeToFirstAudioMs,
        fullResponseMs: acc.fullResponseMs + m.fullResponseMs,
        endToEndMs: acc.endToEndMs + m.endToEndMs,
        timestamp: 0,
      }),
      { inputProcessingMs: 0, timeToFirstAudioMs: 0, fullResponseMs: 0, endToEndMs: 0, timestamp: 0 },
    );

    const count = this.history.length;
    return {
      inputProcessingMs: sum.inputProcessingMs / count,
      timeToFirstAudioMs: sum.timeToFirstAudioMs / count,
      fullResponseMs: sum.fullResponseMs / count,
      endToEndMs: sum.endToEndMs / count,
      timestamp: Date.now(),
    };
  }

  public reset(): void {
    this.currentTurn.clear();
  }

  private getStageDuration(stage: PipelineStage): number {
    const mark = this.currentTurn.get(stage);
    if (!mark?.start || !mark?.end) return 0;
    return mark.end - mark.start;
  }
}

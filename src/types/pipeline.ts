export enum PipelineStage {
  INPUT_PROCESSING = "input_processing",
  TIME_TO_FIRST_AUDIO = "time_to_first_audio",
  FULL_RESPONSE = "full_response",
  END_TO_END = "end_to_end",
}

export interface LatencyMetrics {
  inputProcessingMs: number;
  timeToFirstAudioMs: number;
  fullResponseMs: number;
  endToEndMs: number;
  timestamp: number;
}

export interface LatencyBudget {
  stage: PipelineStage;
  targetMs: number;
  maxAcceptableMs: number;
}

export const LATENCY_BUDGETS: Record<PipelineStage, LatencyBudget> = {
  [PipelineStage.INPUT_PROCESSING]: {
    stage: PipelineStage.INPUT_PROCESSING,
    targetMs: 200,
    maxAcceptableMs: 400,
  },
  [PipelineStage.TIME_TO_FIRST_AUDIO]: {
    stage: PipelineStage.TIME_TO_FIRST_AUDIO,
    targetMs: 300,
    maxAcceptableMs: 500,
  },
  [PipelineStage.FULL_RESPONSE]: {
    stage: PipelineStage.FULL_RESPONSE,
    targetMs: 2000,
    maxAcceptableMs: 3000,
  },
  [PipelineStage.END_TO_END]: {
    stage: PipelineStage.END_TO_END,
    targetMs: 500,
    maxAcceptableMs: 1000,
  },
};

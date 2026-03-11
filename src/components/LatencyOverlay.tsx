"use client";

import { LatencyMetrics, LATENCY_BUDGETS, PipelineStage } from "@/types/pipeline";

interface LatencyOverlayProps {
  currentMetrics: LatencyMetrics | null;
  averageMetrics: LatencyMetrics | null;
}

/** Color-code a latency value based on its pipeline stage budget. */
function getLatencyColor(stage: PipelineStage, ms: number): string {
  const budget = LATENCY_BUDGETS[stage];
  if (ms === 0) return "text-zinc-400";
  if (ms <= budget.targetMs) return "text-green-500";
  if (ms <= budget.maxAcceptableMs) return "text-yellow-500";
  return "text-red-500";
}

function formatMs(ms: number): string {
  if (ms === 0) return "--";
  return `${Math.round(ms)}ms`;
}

/**
 * HUD overlay showing real-time latency metrics, color-coded against budgets.
 */
export default function LatencyOverlay({
  currentMetrics,
  averageMetrics,
}: LatencyOverlayProps): React.JSX.Element {
  const rows: { label: string; stage: PipelineStage; currentMs: number; avgMs: number }[] = [
    {
      label: "Input Processing",
      stage: PipelineStage.INPUT_PROCESSING,
      currentMs: currentMetrics?.inputProcessingMs ?? 0,
      avgMs: averageMetrics?.inputProcessingMs ?? 0,
    },
    {
      label: "Time to First Audio",
      stage: PipelineStage.TIME_TO_FIRST_AUDIO,
      currentMs: currentMetrics?.timeToFirstAudioMs ?? 0,
      avgMs: averageMetrics?.timeToFirstAudioMs ?? 0,
    },
    {
      label: "Full Response",
      stage: PipelineStage.FULL_RESPONSE,
      currentMs: currentMetrics?.fullResponseMs ?? 0,
      avgMs: averageMetrics?.fullResponseMs ?? 0,
    },
    {
      label: "End-to-End",
      stage: PipelineStage.END_TO_END,
      currentMs: currentMetrics?.endToEndMs ?? 0,
      avgMs: averageMetrics?.endToEndMs ?? 0,
    },
  ];

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Latency
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-zinc-400">
            <th className="text-left font-normal">Stage</th>
            <th className="text-right font-normal">Current</th>
            <th className="text-right font-normal">Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stage}>
              <td className="py-0.5 text-zinc-600 dark:text-zinc-300">{row.label}</td>
              <td className={`py-0.5 text-right ${getLatencyColor(row.stage, row.currentMs)}`}>
                {formatMs(row.currentMs)}
              </td>
              <td className={`py-0.5 text-right ${getLatencyColor(row.stage, row.avgMs)}`}>
                {formatMs(row.avgMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

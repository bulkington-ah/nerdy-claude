"use client";

import React from "react";
import katex from "katex";
import { parseMathSegments, MathSegment } from "@/lib/mathParser";

interface MathTextProps {
  content: string;
}

/**
 * Renders a string containing LaTeX math notation.
 * Inline math ($...$) and block math ($$...$$) are rendered via KaTeX.
 * Plain text passes through unchanged.
 */
export default function MathText({ content }: MathTextProps): React.JSX.Element {
  const segments = parseMathSegments(content);

  return (
    <>
      {segments.map((seg, i) => (
        <MathSegmentView key={i} segment={seg} />
      ))}
    </>
  );
}

function MathSegmentView({ segment }: { segment: MathSegment }): React.JSX.Element {
  if (segment.type === "text") {
    return <span>{segment.content}</span>;
  }

  const displayMode = segment.type === "block-math";

  try {
    const html = katex.renderToString(segment.content, {
      displayMode,
      throwOnError: true,
    });

    if (displayMode) {
      return (
        <div
          className="my-2 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return (
      <span dangerouslySetInnerHTML={{ __html: html }} />
    );
  } catch {
    // Fallback: show raw LaTeX if parsing fails
    const delim = displayMode ? "$$" : "$";
    return <span className="text-red-500">{delim}{segment.content}{delim}</span>;
  }
}

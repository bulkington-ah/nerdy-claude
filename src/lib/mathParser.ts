export interface MathSegment {
  type: "text" | "inline-math" | "block-math";
  content: string;
}

/**
 * Parses a string into segments of plain text, inline math ($...$),
 * and block math ($$...$$).
 *
 * Block delimiters ($$) are matched first to avoid treating them
 * as two empty inline delimiters.
 */
export function parseMathSegments(input: string): MathSegment[] {
  if (!input) return [];

  // Match $$...$$ (block) or $...$ (inline), non-greedy
  const mathPattern = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g;
  const segments: MathSegment[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = mathPattern.exec(input)) !== null) {
    // Add preceding plain text if any
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: input.slice(lastIndex, match.index),
      });
    }

    const raw = match[0];
    if (raw.startsWith("$$")) {
      segments.push({
        type: "block-math",
        content: raw.slice(2, -2),
      });
    } else {
      segments.push({
        type: "inline-math",
        content: raw.slice(1, -1),
      });
    }

    lastIndex = match.index + raw.length;
  }

  // Add trailing plain text if any
  if (lastIndex < input.length) {
    segments.push({
      type: "text",
      content: input.slice(lastIndex),
    });
  }

  return segments;
}

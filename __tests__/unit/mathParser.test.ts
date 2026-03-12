import { parseMathSegments } from "@/lib/mathParser";

describe("parseMathSegments", () => {
  it("returns plain text as a single text segment", () => {
    expect(parseMathSegments("Hello world")).toEqual([
      { type: "text", content: "Hello world" },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(parseMathSegments("")).toEqual([]);
  });

  it("parses inline math delimited by single $", () => {
    expect(parseMathSegments("The formula $x^2$ is quadratic")).toEqual([
      { type: "text", content: "The formula " },
      { type: "inline-math", content: "x^2" },
      { type: "text", content: " is quadratic" },
    ]);
  });

  it("parses inline math delimited by \\( ... \\)", () => {
    expect(parseMathSegments("The formula \\(x^2\\) is quadratic")).toEqual([
      { type: "text", content: "The formula " },
      { type: "inline-math", content: "x^2" },
      { type: "text", content: " is quadratic" },
    ]);
  });

  it("parses block math delimited by $$", () => {
    expect(parseMathSegments("Here: $$\\frac{a}{b}$$ done")).toEqual([
      { type: "text", content: "Here: " },
      { type: "block-math", content: "\\frac{a}{b}" },
      { type: "text", content: " done" },
    ]);
  });

  it("parses block math delimited by \\[ ... \\]", () => {
    expect(parseMathSegments("Here: \\[\\frac{a}{b}\\] done")).toEqual([
      { type: "text", content: "Here: " },
      { type: "block-math", content: "\\frac{a}{b}" },
      { type: "text", content: " done" },
    ]);
  });

  it("handles multiple inline math expressions", () => {
    expect(parseMathSegments("$a$ and $b$")).toEqual([
      { type: "inline-math", content: "a" },
      { type: "text", content: " and " },
      { type: "inline-math", content: "b" },
    ]);
  });

  it("handles mixed inline and block math", () => {
    expect(
      parseMathSegments("Inline $x$ then block $$y^2$$ end")
    ).toEqual([
      { type: "text", content: "Inline " },
      { type: "inline-math", content: "x" },
      { type: "text", content: " then block " },
      { type: "block-math", content: "y^2" },
      { type: "text", content: " end" },
    ]);
  });

  it("handles mixed dollar and slash-delimited math", () => {
    expect(
      parseMathSegments("Inline \\(x\\) then block \\[y^2\\] end")
    ).toEqual([
      { type: "text", content: "Inline " },
      { type: "inline-math", content: "x" },
      { type: "text", content: " then block " },
      { type: "block-math", content: "y^2" },
      { type: "text", content: " end" },
    ]);
  });

  it("does not treat $$ as two empty inline segments", () => {
    const result = parseMathSegments("$$x$$");
    expect(result).toEqual([{ type: "block-math", content: "x" }]);
  });

  it("handles math at the start and end of string", () => {
    expect(parseMathSegments("$a$ text $b$")).toEqual([
      { type: "inline-math", content: "a" },
      { type: "text", content: " text " },
      { type: "inline-math", content: "b" },
    ]);
  });

  it("preserves whitespace in plain text segments", () => {
    expect(parseMathSegments("  spaces  $x$  here  ")).toEqual([
      { type: "text", content: "  spaces  " },
      { type: "inline-math", content: "x" },
      { type: "text", content: "  here  " },
    ]);
  });
});

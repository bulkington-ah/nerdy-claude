import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MathText from "@/components/MathText";

// Mock KaTeX to avoid rendering complexity in tests
jest.mock("katex", () => ({
  renderToString: jest.fn((tex: string, opts?: { displayMode?: boolean }) => {
    const mode = opts?.displayMode ? "block" : "inline";
    return `<span class="katex-mock" data-mode="${mode}">${tex}</span>`;
  }),
}));

describe("MathText", () => {
  it("renders plain text unchanged", () => {
    render(<MathText content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders inline math via KaTeX", () => {
    const { container } = render(<MathText content="The value $x^2$ here" />);
    expect(screen.getByText("The value")).toBeInTheDocument();
    expect(screen.getByText("here")).toBeInTheDocument();

    const mathSpan = container.querySelector('[data-mode="inline"]');
    expect(mathSpan).toBeInTheDocument();
    expect(mathSpan?.textContent).toBe("x^2");
  });

  it("renders block math via KaTeX in display mode", () => {
    const { container } = render(
      <MathText content="Result: $$\frac{a}{b}$$ done" />
    );

    const mathSpan = container.querySelector('[data-mode="block"]');
    expect(mathSpan).toBeInTheDocument();
    expect(mathSpan?.textContent).toContain("frac{a}{b}");
  });

  it("renders mixed text and math correctly", () => {
    const { container } = render(
      <MathText content="If $a=1$ and $b=2$ then $$a+b=3$$" />
    );

    const inlineMath = container.querySelectorAll('[data-mode="inline"]');
    const blockMath = container.querySelectorAll('[data-mode="block"]');
    expect(inlineMath).toHaveLength(2);
    expect(blockMath).toHaveLength(1);
  });

  it("renders empty content without crashing", () => {
    const { container } = render(<MathText content="" />);
    expect(container.textContent).toBe("");
  });

  it("handles invalid LaTeX gracefully", () => {
    // KaTeX mock doesn't throw, but test the fallback path
    const katex = require("katex");
    katex.renderToString.mockImplementationOnce(() => {
      throw new Error("KaTeX parse error");
    });

    const { container } = render(<MathText content="Bad math $\invalid$" />);
    // Should render the raw LaTeX as fallback
    expect(container.textContent).toContain("\\invalid");
  });
});

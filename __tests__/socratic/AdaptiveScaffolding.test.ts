import { SocraticPrompt } from "@/lib/SocraticPrompt";

describe("Adaptive Scaffolding", () => {
  it("should include instructions for when students are stuck", () => {
    const prompt = SocraticPrompt.build();

    // Should have bridging question guidance
    expect(prompt).toMatch(/stuck|step back|simpler/i);
    expect(prompt).toMatch(/bridging|what do we already know/i);
  });

  it("should include encouragement instructions", () => {
    const prompt = SocraticPrompt.build();

    expect(prompt).toMatch(/encouraging|warm/i);
    expect(prompt).toMatch(/good thinking|right track/i);
  });

  it("should focus on one concept at a time", () => {
    const prompt = SocraticPrompt.build();

    expect(prompt).toMatch(/one concept/i);
  });

  it("should adapt to subject when provided", () => {
    const mathPrompt = SocraticPrompt.build({ subject: "algebra" });
    const sciencePrompt = SocraticPrompt.build({ subject: "biology" });

    expect(mathPrompt).toContain("algebra");
    expect(sciencePrompt).toContain("biology");
  });

  it("should default to open subject when none provided", () => {
    const prompt = SocraticPrompt.build();

    expect(prompt).toMatch(/any subject/i);
  });

  it("should never instruct the model to lecture", () => {
    const prompt = SocraticPrompt.build();

    // Should explicitly forbid lecturing
    expect(prompt).toMatch(/never.*lecture|never.*explain.*full/i);
  });
});

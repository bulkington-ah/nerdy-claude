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

  it("should instruct to track student knowledge across the conversation", () => {
    const prompt = SocraticPrompt.build();

    // Should tell the model to notice/track what the student knows
    expect(prompt).toMatch(/track|notice|pay attention|remember/i);
    expect(prompt).toMatch(/understand|struggle|know/i);
  });

  it("should instruct to confirm when the student arrives at the answer", () => {
    const prompt = SocraticPrompt.build();

    // Should have a release valve — confirm and summarize when student gets it
    expect(prompt).toMatch(/confirm|celebrate|arrived|figured out/i);
  });

  it("should handle greetings and off-topic naturally", () => {
    const prompt = SocraticPrompt.build();

    // Should not force Socratic questions on greetings/off-topic
    expect(prompt).toMatch(/greeting|off-topic|introduction/i);
    expect(prompt).toMatch(/naturally|warmly/i);
  });

  it("should instruct to start from what the student knows", () => {
    const prompt = SocraticPrompt.build();

    // Core Socratic instinct — always find out where they are
    expect(prompt).toMatch(/start.*from.*what.*student.*know|where they are/i);
  });
});

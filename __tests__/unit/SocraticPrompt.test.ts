import { SocraticPrompt } from "@/lib/SocraticPrompt";

describe("SocraticPrompt", () => {
  it("should build a prompt that includes Socratic method rules", () => {
    const prompt = SocraticPrompt.build();
    expect(prompt).toContain("question");
    expect(prompt.toLowerCase()).toContain("never");
    expect(prompt.toLowerCase()).toContain("direct answer");
  });

  it("should include grade-level guidance", () => {
    const prompt = SocraticPrompt.build({ gradeLevel: 7 });
    expect(prompt).toContain("7th");
  });

  it("should include subject when provided", () => {
    const prompt = SocraticPrompt.build({ subject: "biology" });
    expect(prompt).toContain("biology");
  });

  it("should instruct short responses for low latency", () => {
    const prompt = SocraticPrompt.build();
    expect(prompt).toMatch(/short|concise|brief|1-3 sentences/i);
  });

  it("should instruct to always end with a question", () => {
    const prompt = SocraticPrompt.build();
    expect(prompt).toMatch(/end.*question|always.*question/i);
  });

  it("should instruct not to lecture", () => {
    const prompt = SocraticPrompt.build();
    expect(prompt).toMatch(/never.*lecture|don't.*lecture|not.*lecture/i);
  });

  it("should instruct to use LaTeX notation for math", () => {
    const prompt = SocraticPrompt.build();
    expect(prompt).toMatch(/\$.*\$/); // contains LaTeX delimiter examples
    expect(prompt).toMatch(/latex|LaTeX/i);
  });

  it("should adapt language guidance for younger students", () => {
    const promptYoung = SocraticPrompt.build({ gradeLevel: 6 });
    const promptOld = SocraticPrompt.build({ gradeLevel: 12 });
    expect(promptYoung).toContain("simple");
    expect(promptOld).toMatch(/technical|complex|advanced/i);
  });
});

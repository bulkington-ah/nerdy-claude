import { SocraticPrompt } from "@/lib/SocraticPrompt";

describe("Socratic Behavior", () => {
  it("should produce a prompt that ends every response with a question", () => {
    const prompt = SocraticPrompt.build();

    // The prompt must instruct the model to always end with a question
    expect(prompt).toMatch(/always.*end.*question/i);
  });

  it("should instruct the model to never give direct answers", () => {
    const prompt = SocraticPrompt.build();

    expect(prompt).toMatch(/never.*give.*direct.*answer/i);
  });

  it("should instruct the model to keep responses short", () => {
    const prompt = SocraticPrompt.build();

    // Should mention short responses or word count limits
    expect(prompt).toMatch(/15-40 words|keep.*short|1-3 sentences/i);
  });

  it("should instruct the model to redirect wrong answers with questions", () => {
    const prompt = SocraticPrompt.build();

    // Should not say "wrong" — should ask a revealing question
    expect(prompt).toMatch(/wrong|incorrect/i);
    expect(prompt).toMatch(/question.*reveals|ask.*question/i);
  });

  it("should instruct the model to ask 'why' on correct answers", () => {
    const prompt = SocraticPrompt.build();

    expect(prompt).toMatch(/why/i);
    expect(prompt).toMatch(/right|correct/i);
  });

  it("should adapt language to grade level", () => {
    const middleSchool = SocraticPrompt.build({ gradeLevel: 6 });
    const highSchool = SocraticPrompt.build({ gradeLevel: 10 });

    // Middle school should use simpler language
    expect(middleSchool).toMatch(/simple|concrete|analogies/i);
    // High school can use technical vocabulary
    expect(highSchool).toMatch(/technical|advanced/i);
  });
});

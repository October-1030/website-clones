import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoStudyProvider, OpenAIResponsesStudyProvider } from "../src/lib/study/provider";

const sampleSolution = {
  subject: "Calculus",
  problemRestatement: "Evaluate the definite integral and verify the antiderivative.",
  knowns: ["Integral from 0 to 1 of x·e^(x²) dx"],
  method: "Use u-substitution with u=x².",
  steps: [
    { title: "Substitute", explanation: "Let u=x², so du=2x dx.", expression: "x dx = 1/2 du" },
    { title: "Evaluate", explanation: "Transform the limits and integrate e^u.", expression: "1/2 [e^u]₀¹ = (e-1)/2" },
  ],
  finalAnswer: "(e - 1) / 2",
  verification: "Differentiate (1/2)e^(x²) to obtain x·e^(x²).",
  assumptions: [],
};

describe("Homework provider", () => {
  it("returns an explicitly marked demo structure without inventing an answer", async () => {
    const solution = await demoStudyProvider.solveHomework("Solve x + 2 = 5");
    assert.equal(solution.subject, "演示模式");
    assert.ok(solution.steps.length >= 2);
    assert.match(solution.finalAnswer, /不会伪造具体答案/);
  });

  it("requests and validates a structured MiniMax-compatible solution", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({ output_text: JSON.stringify(sampleSolution) }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const provider = new OpenAIResponsesStudyProvider({
      apiKey: "test-secret",
      model: "MiniMax-M3",
      baseUrl: "https://api.minimaxi.com/v1",
      fetchImpl,
      providerIdPrefix: "minimax-responses",
      providerLabel: "MiniMax",
      structuredOutputMode: "prompt_json",
    });

    const solution = await provider.solveHomework("Evaluate ∫₀¹ x·e^(x²) dx.");
    assert.equal(solution.finalAnswer, "(e - 1) / 2");
    assert.equal(solution.steps.length, 2);
    const body = JSON.parse(String(requests[0]?.init?.body)) as {
      store: boolean;
      instructions: string;
      text: { format: { type: string } };
      reasoning: { effort: string };
    };
    assert.equal(requests[0]?.url, "https://api.minimaxi.com/v1/responses");
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, "text");
    assert.equal(body.reasoning.effort, "none");
    assert.match(body.instructions, /independently verify/i);
    assert.doesNotMatch(String(requests[0]?.init?.body), /test-secret/);
  });

  it("retries one malformed MiniMax JSON response and then succeeds", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      const outputText = calls === 1 ? "not-json" : JSON.stringify(sampleSolution);
      return new Response(JSON.stringify({ output_text: outputText }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const provider = new OpenAIResponsesStudyProvider({
      apiKey: "test-secret",
      model: "MiniMax-M3",
      baseUrl: "https://api.minimaxi.com/v1",
      fetchImpl,
      structuredOutputMode: "prompt_json",
    });
    assert.equal((await provider.solveHomework("Evaluate an integral")).finalAnswer, "(e - 1) / 2");
    assert.equal(calls, 2);
  });

  it("rejects incomplete model output", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ output_text: JSON.stringify({ finalAnswer: "5" }) }), { status: 200, headers: { "Content-Type": "application/json" } });
    const provider = new OpenAIResponsesStudyProvider({ apiKey: "test-secret", model: "test-model", baseUrl: "https://example.test/v1", fetchImpl });
    await assert.rejects(() => provider.solveHomework("Solve x + 2 = 5"), /结构不完整/);
  });
});

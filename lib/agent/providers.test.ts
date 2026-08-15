import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getProvider, PROVIDERS } from "./providers";

describe("model provider selection", () => {
  const orig = { ...process.env };
  beforeEach(() => { delete process.env.GROQ_API_KEY; delete process.env.GEMINI_API_KEY; });
  afterEach(() => { process.env = { ...orig }; });

  it("returns the explicitly requested provider", () => {
    expect(getProvider("groq").id).toBe("groq");
    expect(getProvider("gemini").id).toBe("gemini");
  });

  it("ignores an invalid provider id and falls back", () => {
    process.env.GEMINI_API_KEY = "x";
    expect(getProvider("nonsense").id).toBe("gemini");
  });

  it("prefers Groq when its key is set and no id is given", () => {
    process.env.GROQ_API_KEY = "x";
    process.env.GEMINI_API_KEY = "y";
    expect(getProvider(undefined).id).toBe("groq");
  });

  it("uses Gemini when only its key is set", () => {
    process.env.GEMINI_API_KEY = "y";
    expect(getProvider(undefined).id).toBe("gemini");
  });

  it("both providers have a label, base url, model, and key env", () => {
    for (const p of Object.values(PROVIDERS)) {
      expect(p.label).toBeTruthy();
      expect(p.baseUrl).toMatch(/^https:\/\//);
      expect(p.model).toBeTruthy();
      expect(p.apiKeyEnv).toMatch(/API_KEY$/);
    }
  });
});
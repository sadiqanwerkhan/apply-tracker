import {
    AiResult,
    SYSTEM_INSTRUCTIONS,
    buildUserMessage,
    parseClassifyResponse,
  } from "./classifyShared";
  
  // Free classifier using Groq (Llama). Mirrors aiClassifyBatch's interface and
  // uses the SHARED rules + parser, so its output is identical in shape and
  // meaning to Claude's — only the model differs. Used when the app is configured
  // to classify for free (no Anthropic credit needed).
  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  
  export async function groqClassifyBatch(
    emails: { subject: string; body: string }[]
  ): Promise<(AiResult | null)[]> {
    if (emails.length === 0) return [];
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return emails.map(() => null);
  
    const userMessage = buildUserMessage(emails);
  
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTIONS },
            { role: "user", content: userMessage },
          ],
          temperature: 0,
          max_tokens: 2500,
          response_format: { type: "json_object" },
        }),
      });
  
      if (!res.ok) {
        console.error("Groq classify error:", res.status, (await res.text().catch(() => "")).slice(0, 200));
        return emails.map(() => null);
      }
  
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
  
      // Groq's json_object mode may wrap the array in an object (e.g. {"emails":[...]}).
      // Try direct parse first, then unwrap a single array-valued property.
      const direct = parseClassifyResponse(content, emails.length);
      if (direct.some((r) => r !== null)) return direct;
  
      try {
        const obj = JSON.parse(content.replace(/```json/gi, "").replace(/```/g, "").trim());
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          const arrProp = Object.values(obj).find((v) => Array.isArray(v));
          if (arrProp) return parseClassifyResponse(JSON.stringify(arrProp), emails.length);
        }
      } catch {
        // fall through
      }
      return emails.map(() => null);
    } catch (err) {
      console.error("Groq classify exception:", err);
      return emails.map(() => null);
    }
  }
import { createChatHandler } from "./handler.ts";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(createChatHandler({
  async authenticate(token: string) {
    const response = await fetch(`${projectUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: publicKey }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user?.id || null;
  },
  async consume(token: string) {
    const response = await fetch(`${projectUrl}/rest/v1/rpc/consume_chat_request`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: publicKey, "Content-Type": "application/json" },
      body: "{}", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Chat limits unavailable");
    return (await response.json()) === true;
  },
  async generate(contents: unknown[], country: string) {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("Provider unavailable");
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
    if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new Error("Invalid model");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: `You are Beacon, a supportive AI gambling-recovery companion, not a clinician or emergency service. Help with harm reduction, grounding and reaching trusted people. Never provide betting tips, odds, or gambling strategies. Do not invent contact details or promise that an urge ends in a fixed time. If the user may be in immediate danger, encourage urgent human help and direct them to the app's Support tab for locally selected resources. The selected country code is ${country}; do not assume another country. Keep replies concise and explain that AI can make mistakes when relevant.` }] },
        contents, generationConfig: { maxOutputTokens: 512 },
      }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.filter((p: { text?: unknown }) => typeof p?.text === "string").map((p: { text: string }) => p.text).join("").trim();
    if (!reply) throw new Error("Empty provider response");
    return reply;
  },
}));

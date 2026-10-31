type Dependencies = {
  authenticate: (token: string) => Promise<string | null>;
  consume: (token: string) => Promise<boolean>;
  generate: (contents: unknown[], country: string) => Promise<string>;
};
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export function createChatHandler(deps: Dependencies) {
  return async (request: Request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Use POST" }, 405);
    try {
      const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!token || !(await deps.authenticate(token))) return json({ error: "Sign in required" }, 401);
      const body = await request.text();
      if (body.length > 30000) return json({ error: "Message is too large" }, 413);
      let input;
      try { input = JSON.parse(body); } catch { return json({ error: "Invalid JSON" }, 400); }
      if (!input || typeof input.message !== "string" || !input.message.trim() || input.message.length > 4000) return json({ error: "Enter a message up to 4000 characters" }, 400);
      if (!(await deps.consume(token))) return json({ error: "Chat limit reached" }, 429);
      const turns = Array.isArray(input.history) ? input.history.slice(-10).filter((h: { text?: unknown }) => typeof h?.text === "string" && h.text.trim()).map((h: { role?: string; text: string }) => ({ role: h.role === "model" ? "model" : "user", parts: [{ text: h.text.slice(0, 2000) }] })) : [];
      turns.push({ role: "user", parts: [{ text: input.message.trim() }] });
      const country = typeof input.country === "string" && /^[A-Z]{2}$/.test(input.country) ? input.country : "XX";
      const reply = await deps.generate(turns, country);
      return json({ reply, via: "gemini" });
    } catch {
      // A failed provider never sends the conversation to another service.
      return json({ error: "Beacon is unavailable. Activities and local support are still available." }, 503);
    }
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_INSTRUCTION = `You are "Beacon," an empathetic, grounded, and non-judgmental AI companion for gambling recovery.
Your primary goal is harm reduction, urge surfing (encouraging a 15-minute delay), cognitive reframing, and crisis intervention.
Never calculate odds, predict games, or suggest gambling fixes debt.
Emergency lines: US/Canada: 1-800-GAMBLER or text 988. UK: 0808 8020 133.
When asked unrelated questions, answer accurately and politely without forcing gambling advice.
Keep replies under ~120 words unless asked for more. This chat is on a phone — be scannable.`;

const SAFETY_FALLBACK_REPLY = `I'm right here with you. Urges feel intense, but they are like ocean waves—they peak and begin to break within 15 minutes.

Let's pause together:
1. **Step away from screens** or triggers right now.
2. **Drink a glass of cold water** or take a slow walk around the room.
3. **Breathe slowly**: Inhale for 4 seconds, hold for 4, and exhale for 6.

You don't have to fight this alone. If you need immediate support, call 1-800-GAMBLER or text 988. What was happening right before this urge started?`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "GEMINI_API_KEY secret is not set in Supabase." }, 500);
    }

    const { message, history } = await req.json().catch(() => ({ message: "Hello" }));
    const text = typeof message === "string" && message.trim() ? message : "Hello";

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        if (!h || typeof h.text !== "string" || !h.text.trim()) continue;
        contents.push({
          role: h.role === "model" ? "model" : "user",
          parts: [{ text: h.text.slice(0, 2000) }],
        });
      }
    }
    contents.push({ role: "user", parts: [{ text: text.slice(0, 4000) }] });

    // Stable generateContent endpoint (the Interactions API shape was
    // returning unparseable responses, which collapsed every reply
    // into the identical fallback below).
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const delays = [1200, 2500];
    let reply = "";

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents,
            generationConfig: { maxOutputTokens: 512 },
          }),
        });

        const data = await res.json().catch(() => ({}));
        const parts = data?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          reply = parts.filter((p: any) => typeof p?.text === "string").map((p: any) => p.text).join("").trim();
        }
        if (reply) break;

        if (attempt < delays.length && (res.status === 503 || res.status === 429)) {
          await sleep(delays[attempt]);
          continue;
        }
        break;
      } catch (_) {
        if (attempt < delays.length) await sleep(delays[attempt]);
      }
    }

    // Honest offline signal: the app labels this so users never mistake
    // a saved response for a fresh one.
    if (!reply) {
      return json({ reply: SAFETY_FALLBACK_REPLY, fallback: true });
    }
    return json({ reply });
  } catch (_) {
    return json({ reply: SAFETY_FALLBACK_REPLY, fallback: true });
  }
});

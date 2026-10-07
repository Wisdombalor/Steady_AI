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
    const { message, history } = await req.json().catch(() => ({ message: "Hello" }));
    const text = typeof message === "string" && message.trim() ? message : "Hello";

    // Shared turn list for every provider (roles normalized to user/model).
    const turns: Array<{ role: string; text: string }> = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        if (!h || typeof h.text !== "string" || !h.text.trim()) continue;
        turns.push({ role: h.role === "model" ? "model" : "user", text: h.text.slice(0, 2000) });
      }
    }

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> =
      turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
    contents.push({ role: "user", parts: [{ text: text.slice(0, 4000) }] });

    let via = "";
    const g = await tryGemini(contents);
    let reply = g.reply;
    if (reply) {
      via = "gemini";
    } else {
      // Free failover chain while Google is down: Groq's free tier first
      // (needs a GROQ_API_KEY secret), then keyless Pollinations.
      reply = await tryGroq(turns, text);
      if (reply) {
        via = "groq";
      } else {
        reply = await tryPollinations(turns, text);
        if (reply) via = "pollinations";
      }
    }

    // Honest offline signal: the app labels this so users never mistake
    // a saved response for a fresh one. The reason code + server log line
    // below are what diagnose a stuck fallback (400 = bad key,
    // 404 = model not available, 429 = quota exhausted).
    if (!reply) {
      if (g.outOfTokens) {
        // Quota exhaustion (429) with no working failover is a resting
        // state, not a glitch: tell the app to park Beacon until tokens
        // restore instead of looping fallbacks.
        return json({ reply: SAFETY_FALLBACK_REPLY, fallback: true, unavailable: true, reason: "gemini_429", retryAfterSeconds: g.retryAfter });
      }
      return json({ reply: SAFETY_FALLBACK_REPLY, fallback: true, reason: g.reason });
    }
    return json({ reply, via });
  } catch (e) {
    console.error(`[chat] exception ${String(e).slice(0, 200)}`);
    return json({ reply: SAFETY_FALLBACK_REPLY, fallback: true, reason: "exception" });
  }
});

// --- providers -------------------------------------------------------------

type GeminiResult = { reply: string; outOfTokens: boolean; reason: string; retryAfter: number };

async function tryGemini(
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
): Promise<GeminiResult> {
  const fail = (reason: string, outOfTokens = false, retryAfter = 0): GeminiResult =>
    ({ reply: "", outOfTokens, reason, retryAfter });
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[chat] GEMINI_API_KEY secret is not set in Supabase.");
    return fail("gemini_nokey");
  }
  // Stable generateContent endpoint (the Interactions API shape was
  // returning unparseable responses, which collapsed every reply
  // into the identical fallback below).
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const delays = [1200, 2500];
  let reply = "";
  let lastStatus = 0;
  let lastError = "";
  let retryAfter = 0;

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
      if (!res.ok) {
        lastStatus = res.status;
        const e = data?.error;
        lastError = String(typeof e === "string" ? e : (e?.message || JSON.stringify(e) || "")).slice(0, 200);
        // 429s often carry RetryInfo.retryDelay ("34s") — the exact wait.
        const details = Array.isArray(data?.error?.details) ? data.error.details : [];
        for (const d of details) {
          if (String(d?.["@type"] || "").includes("RetryInfo") && d?.retryDelay != null) {
            const m = String(d.retryDelay).match(/([\d.]+)/);
            if (m) retryAfter = Math.max(retryAfter, Math.ceil(parseFloat(m[1])));
          }
        }
      }
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

  if (!reply) {
    console.error(`[chat] gemini failed status=${lastStatus} err=${lastError}`);
    return fail(lastStatus ? `gemini_${lastStatus}` : "gemini_empty", lastStatus === 429, retryAfter);
  }
  return { reply, outOfTokens: false, reason: "", retryAfter: 0 };
}

// Groq free tier (OpenAI-compatible). Needs GROQ_API_KEY secret; skipped
// silently when unset so the chain falls through to Pollinations.
async function tryGroq(
  turns: Array<{ role: string; text: string }>,
  text: string,
): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return "";
  try {
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_INSTRUCTION },
      ...turns.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text })),
      { role: "user", content: text.slice(0, 4000) },
    ];
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 512,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[chat] groq failed status=${res.status} err=${String(data?.error?.message || JSON.stringify(data?.error) || "").slice(0, 200)}`);
      return "";
    }
    const out = data?.choices?.[0]?.message?.content;
    return typeof out === "string" ? out.trim() : "";
  } catch (e) {
    console.error(`[chat] groq exception ${String(e).slice(0, 200)}`);
    return "";
  }
}

// Keyless public inference (Pollinations). Last resort before the saved
// reply: no secret needed, quality varies, still guided by the system rules.
async function tryPollinations(
  turns: Array<{ role: string; text: string }>,
  text: string,
): Promise<string> {
  try {
    const convo = turns.map((t) => `${t.role === "model" ? "Beacon" : "User"}: ${t.text}`).join("\n").slice(-3000);
    const prompt = `${SYSTEM_INSTRUCTION}\n\n${convo}\nUser: ${text.slice(0, 1500)}\nBeacon:`;
    const res = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`,
      { signal: AbortSignal.timeout(25000) },
    );
    if (!res.ok) {
      console.error(`[chat] pollinations failed status=${res.status}`);
      return "";
    }
    const out = await res.text();
    return out.trim().slice(0, 2000);
  } catch (e) {
    console.error(`[chat] pollinations exception ${String(e).slice(0, 200)}`);
    return "";
  }
}

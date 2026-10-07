import { SB_CONF } from "./data";

const CHAT_URL = `${SB_CONF.url}/functions/v1/chat`;

// Beacon chat goes ONLY through the deployed Supabase Edge Function
// (secure Gemini proxy). No API keys in the UI, no direct calls to Google.
export async function chatReply({ message, history }) {
  let res;
  try {
    res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_CONF.key,
      },
      body: JSON.stringify({
        message,
        history: (history || []).slice(-10).map((m) => ({
          role: m.r === "u" ? "user" : "model",
          text: m.t,
        })),
      }),
    });
  } catch {
    throw new Error("NET");
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error("API:" + (data?.error || res.status));
  if (!data?.reply) throw new Error("API:empty");
  if (data?.fallback) console.warn("[beacon] saved fallback reply, reason:", data?.reason || "unknown");
  else if (data?.via && data.via !== "gemini") console.info("[beacon] reply via failover:", data.via);
  return {
    text: data.reply,
    fallback: !!data.fallback,
    unavailable: !!data.unavailable,
    retryAfterSeconds: Number(data.retryAfterSeconds) || 0,
    via: data.via || "gemini",
  };
}

export function aiErrorMessage(e) {
  const m = String(e?.message || "");
  if (m === "NET") return "Couldn't reach Beacon. Check your connection and try again.";
  if (m.startsWith("API")) return "Beacon returned an error. Try again.";
  return "Beacon isn't available right now. Try an activity or call someone you trust.";
}

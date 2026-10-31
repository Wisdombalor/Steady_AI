import { SB_CONF } from "./data";
import { supabase } from "./backend";

export async function chatReply({ message, history, country, signal }) {
  const { data, error } = await supabase().auth.getSession();
  if (error || !data.session) throw new Error("AUTH");
  let response;
  try {
    response = await fetch(`${SB_CONF.url}/functions/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_CONF.key, Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ message, country, history: (history || []).slice(-10).map((m) => ({ role: m.r === "u" ? "user" : "model", text: m.t })) }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(error.name === "TimeoutError" ? "TIMEOUT" : "NET");
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("AUTH");
  if (response.status === 429) throw new Error("LIMIT");
  if (!response.ok || !body.reply) throw new Error("API");
  return { text: body.reply, fallback: !!body.fallback, unavailable: !!body.unavailable, retryAfterSeconds: Number(body.retryAfterSeconds) || 0 };
}

export function aiErrorMessage(error) {
  const messages = {
    AUTH: "Sign in to use Beacon. Activities and local support are available without an account.",
    LIMIT: "The chat limit is reached. Please try again later, or use an activity or local support.",
    TIMEOUT: "Beacon took too long to reply. Please try again or open local support.",
    NET: "Couldn't reach Beacon. Check your connection and try again.",
  };
  return messages[error?.message] || "Beacon isn't available right now. Try an activity or contact someone you trust.";
}

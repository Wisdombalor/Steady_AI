const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_INSTRUCTION = `You are "Beacon," an empathetic, grounded, and non-judgmental AI companion for gambling recovery. 
Your primary goal is harm reduction, urge surfing (encouraging a 15-minute delay), cognitive reframing, and crisis intervention. 
Never calculate odds, predict games, or suggest gambling fixes debt.
Emergency lines: US/Canada: 1-800-GAMBLER or text 988. UK: 0808 8020 133.
When asked unrelated questions, answer accurately and politely without forcing gambling advice.`;

const SAFETY_FALLBACK_REPLY = `I'm right here with you. Urges feel intense, but they are like ocean waves—they peak and begin to break within 15 minutes. 

Let's pause together:
1. **Step away from screens** or triggers right now.
2. **Drink a glass of cold water** or take a slow walk around the room.
3. **Breathe slowly**: Inhale for 4 seconds, hold for 4, and exhale for 6.

You don't have to fight this alone. If you need immediate support, call 1-800-GAMBLER or text 988. What was happening right before this urge started?`;

function parseGeminiReply(data: any): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (step.type === "model_output" && Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item.type === "text" && item.text) {
            return item.text;
          }
        }
      }
    }
  }
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY secret is not set in Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message } = await req.json().catch(() => ({ message: "Hello" }));

    const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
    const delays = [1200, 2500];
    let reply = "";

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-3.8-flash",
            system_instruction: SYSTEM_INSTRUCTION,
            input: message,
          }),
        });

        const data = await res.json();
        reply = parseGeminiReply(data);

        if (reply) break;

        // If high demand spike, wait and try again
        if (attempt < delays.length && (res.status === 503 || data.error?.code === "service_unavailable")) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
          continue;
        }
      } catch (_) {
        if (attempt < delays.length) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
      }
    }

    // Always guarantee an empathetic recovery response even under Google outages
    if (!reply) {
      reply = SAFETY_FALLBACK_REPLY;
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ reply: SAFETY_FALLBACK_REPLY }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

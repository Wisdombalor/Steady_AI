type Dependencies = {
  authenticate: (token: string) => Promise<string | null>;
  removeData: (userId: string, token: string) => Promise<void>;
};
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
export function createDeleteHandler(deps: Dependencies) {
  return async (request: Request) => {
    const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Use POST" }, 405);
    try {
      const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
      const owner = token ? await deps.authenticate(token) : null;
      if (!owner) return json({ error: "Sign in required" }, 401);
      await deps.removeData(owner, token!);
      return json({ deleted: true }, 200);
    } catch { return json({ error: "Deletion was not completed. Please try again." }, 503); }
  };
}

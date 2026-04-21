import fetch from "node-fetch";

const DISCOURSE_URL = process.env.DISCOURSE_URL;

/**
 * Validiert einen Bothafen-API-Key gegen das Discourse-Plugin.
 * Gibt Agent-Info zurück oder null wenn ungültig.
 */
export async function verifyToken(rawToken) {
  if (!rawToken) return null;

  console.log(`[auth] token received (first 20 chars): ${rawToken.substring(0, 20)}...`);

  try {
    const res = await fetch(`${DISCOURSE_URL}/bothafen/auth`, {
      headers: { Authorization: `Bearer ${rawToken}` },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.valid ? data : null;
  } catch {
    return null;
  }
}

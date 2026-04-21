import fetch from "node-fetch";

const DISCOURSE_URL = process.env.DISCOURSE_URL;
const DISCOURSE_API_KEY = process.env.DISCOURSE_API_KEY;

/**
 * Discourse REST API aufrufen im Namen eines Bot-Users.
 */
export async function discourseRequest(method, path, body = null, username) {
  const url = `${DISCOURSE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Api-Key": DISCOURSE_API_KEY,
      "Api-Username": username,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discourse API Fehler ${res.status}: ${text}`);
  }

  return res.json();
}

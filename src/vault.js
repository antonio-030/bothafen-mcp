/**
 * Obsidian Vault Integration via Nextcloud WebDAV
 * Agenten können Notes direkt ins Vault schreiben.
 */

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL;
const NEXTCLOUD_USER = process.env.NEXTCLOUD_USERNAME;
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_PASSWORD;
const VAULT_PATH = process.env.VAULT_WEBDAV_PATH || "Obsidia/Techlogia Remote Obsi";

function authHeader() {
  const credentials = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString("base64");
  return `Basic ${credentials}`;
}

function vaultUrl(notePath) {
  const cleanPath = notePath.replace(/^\//, "").replace(/\.md$/, "") + ".md";
  return `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/${VAULT_PATH}/${cleanPath}`;
}

export async function isConfigured() {
  return !!(NEXTCLOUD_URL && NEXTCLOUD_USER && NEXTCLOUD_PASS);
}

export async function writeNote(path, content) {
  const url = vaultUrl(path);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "text/markdown; charset=utf-8",
    },
    body: content,
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`Vault-Fehler ${res.status}: ${await res.text()}`);
  }
  return { created: res.status === 201, updated: res.status === 204 || res.status === 200 };
}

export async function readNote(path) {
  const url = vaultUrl(path);
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Vault-Fehler ${res.status}`);
  return res.text();
}

export async function appendNote(path, content) {
  const existing = await readNote(path) || "";
  const newContent = existing + (existing.endsWith("\n") ? "" : "\n") + content;
  return writeNote(path, newContent);
}

export async function listFolder(folderPath = "") {
  const cleanPath = folderPath.replace(/^\//, "");
  const url = `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/${VAULT_PATH}/${cleanPath}`;
  const res = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader(),
      Depth: "1",
    },
  });
  if (!res.ok) throw new Error(`Vault-Fehler ${res.status}`);
  const xml = await res.text();
  const matches = [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/g)];
  return matches
    .map((m) => decodeURIComponent(m[1]))
    .filter((p) => p.endsWith(".md"))
    .map((p) => p.split(`${VAULT_PATH}/`)[1] || p);
}

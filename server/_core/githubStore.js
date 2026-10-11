// The GitHub-backed file store for generated documents.
//
// Bills (and later other generated documents) are small PDFs that must be
// private forever and retrievable on demand. A private GitHub repository is
// the cheapest store that fits: free, private, versioned by construction,
// and reachable from a serverless function over plain HTTPS. Firebase
// Storage would need a billing upgrade; this needs only a token.
//
// Everything is base64 in JSON, exactly like the GitHub Contents API itself:
// no multipart, no streams, no extra dependencies. Files are addressed by
// the <module>/<referenceType>/<referenceId>/<timestamp>-<name> path built
// by documentPath.js; nothing outside that shape is ever read or removed.

const API_ROOT = "https://api.github.com";

export class DocumentStoreNotConfiguredError extends Error {
  constructor() {
    super("GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO must be set.");
    this.name = "DocumentStoreNotConfiguredError";
  }
}

function config() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) throw new DocumentStoreNotConfiguredError();
  return {
    token,
    owner,
    repo,
    branch: process.env.GITHUB_BRANCH || "main"
  };
}

export function isConfigured() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
}

function headers(config, extra = {}) {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra
  };
}

function contentsUrl(config, repositoryPath) {
  const segments = String(repositoryPath).split("/").map(encodeURIComponent).join("/");
  return `${API_ROOT}/repos/${config.owner}/${config.repo}/contents/${segments}`;
}

// Writes (or replaces) a file. `content` is base64, which is what the
// Contents API expects - the browser side never sees this.
export async function putFile(repositoryPath, content, message) {
  const c = config();
  const response = await fetch(contentsUrl(c, repositoryPath), {
    method: "PUT",
    headers: headers(c, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      message: message || `Add document ${repositoryPath}`,
      content,
      branch: c.branch
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub write failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return response.json();
}

// Reads a file's bytes back as base64. A path the repo does not contain is a
// 404 and is the caller's problem to interpret.
export async function getFile(repositoryPath) {
  const c = config();
  const response = await fetch(contentsUrl(c, repositoryPath), {
    headers: headers(c, { Accept: "application/vnd.github.v3.raw" })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub read failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

// Deleting needs the current blob sha, so a read and a delete make the
// operation: two requests, and a race only when two admins delete the same
// file at once (the loser gets 404, treated as success).
export async function deleteFile(repositoryPath, message) {
  const c = config();

  const metaResponse = await fetch(contentsUrl(c, repositoryPath), { headers: headers(c) });
  if (metaResponse.status === 404) return { deleted: false, reason: "not_found" };
  if (!metaResponse.ok) {
    const detail = await metaResponse.text().catch(() => "");
    throw new Error(`GitHub metadata failed (${metaResponse.status}): ${detail.slice(0, 300)}`);
  }
  const meta = await metaResponse.json();

  const response = await fetch(contentsUrl(c, repositoryPath), {
    method: "DELETE",
    headers: headers(c, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      message: message || `Remove document ${repositoryPath}`,
      sha: meta.sha,
      branch: c.branch
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub delete failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return { deleted: true };
}

export const githubStore = { putFile, getFile, deleteFile, isConfigured };

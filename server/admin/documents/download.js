// GET /api/admin/documents/download — serve the bytes of an archived bill.
//
// The file store is a PRIVATE repository: there is no shareable public URL
// for a customer invoice (names, phones and addresses inside), so the admin
// panel asks this route and this route alone. The token in the GitHub client
// never leaves the server, and the path must match the shape the app wrote -
// see _core/documentPath.js for why that allowlist is the real boundary.
//
// Response: { content: <base64>, mimeType, fileName }.

import { requireAdmin } from "../../_core/authz.js";
import { applyCors, handlePreflight } from "../../_core/cors.js";
import { isValidDocumentPath, parseDocumentPath } from "../../_core/documentPath.js";
import { getFile, DocumentStoreNotConfiguredError } from "../../_core/githubStore.js";

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  csv: "text/csv"
};

// Downloads are rendered or opened in the browser, so active content types
// are downgraded even though the store only ever receives PDFs today.
function safeMimeType(fileName) {
  const extension = String(fileName).split(".").pop().toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export default async function handler(req, res) {
  // The admin panel calls this from its own domain, so the preflight is the
  // first thing that reaches this route.
  if (handlePreflight(req, res, "GET, OPTIONS")) return;
  applyCors(req, res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const repositoryPath = String(req.query?.path ?? "").trim();
  const fileName = parseDocumentPath(repositoryPath)?.fileName ?? "";

  if (!isValidDocumentPath(repositoryPath)) {
    return res.status(400).json({ error: "BAD_DOCUMENT_PATH" });
  }

  try {
    const content = await getFile(repositoryPath);
    return res.status(200).json({
      content,
      mimeType: safeMimeType(fileName),
      fileName
    });
  } catch (error) {
    if (error instanceof DocumentStoreNotConfiguredError) {
      return res.status(503).json({ error: "DOCUMENT_STORE_NOT_CONFIGURED" });
    }
    const message = String(error?.message ?? "");
    if (message.includes("(404)")) {
      return res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
    }
    console.error(`document download failed [${repositoryPath}]:`, error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}

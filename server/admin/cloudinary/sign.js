// POST /api/admin/cloudinary/sign — signed upload parameters for the Admin.
//
// An unsigned upload preset would let anyone write to the cloud account, so
// uploads are signed here and constrained: a fixed folder, an allow-list of
// formats and a size ceiling. The secret never leaves the server.

import { createHash } from "node:crypto";
import { requireAdmin } from "../../_core/authz.js";
import { applyCors, handlePreflight } from "../../_core/cors.js";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp", "avif"];

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!apiKey || !apiSecret || !cloudName) {
    console.error("Cloudinary credentials are not configured.");
    return res.status(503).json({ error: "UPLOAD_NOT_CONFIGURED" });
  }

  const folder = String(req.body?.folder ?? "proactive/products").replace(/[^A-Za-z0-9/_-]/g, "").slice(0, 80);
  const timestamp = Math.floor(Date.now() / 1000);

  const params = {
    timestamp,
    folder,
    allowed_formats: ALLOWED_FORMATS.join(","),
    max_bytes: MAX_BYTES
  };

  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&") + apiSecret;

  const signature = createHash("sha1").update(toSign).digest("hex");

  return res.status(200).json({
    apiKey,
    cloudName,
    folder,
    timestamp,
    signature,
    allowedFormats: ALLOWED_FORMATS,
    maxBytes: MAX_BYTES
  });
}

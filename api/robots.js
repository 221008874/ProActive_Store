// GET /robots.txt — crawler policy plus the sitemap pointer.
//
// Served by a route rather than a static file because the Sitemap directive
// must be an absolute URL, which depends on the deployment's host.

function baseUrl(req) {
  return (process.env.SITE_URL ?? `https://${req.headers?.host ?? "localhost"}`).replace(/\/+$/, "");
}

export default function handler(req, res) {
  const body = `User-agent: *
Allow: /
Disallow: /order-success
Disallow: /cart

Sitemap: ${baseUrl(req)}/sitemap.xml
`;

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
  return res.status(200).send(body);
}

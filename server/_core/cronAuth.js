// Guard for the scheduled routes.
//
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the project
// has CRON_SECRET configured. Without the variable (local runs, forks) the
// routes are open — same open-dev/closed-prod policy as the captcha gate,
// and the jobs themselves are idempotent.

export function isCronAuthorized(req, secret = process.env.CRON_SECRET) {
  if (!secret) return true;
  const header = req.headers?.authorization ?? "";
  return header === `Bearer ${secret}`;
}

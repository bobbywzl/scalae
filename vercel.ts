import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  // Daily desk regeneration: 11:00 UTC ≈ pre-market US East. The route also
  // requires CRON_SECRET (Vercel attaches it as a Bearer token automatically).
  crons: [{ path: "/api/cron/daily", schedule: "0 11 * * *" }],
};

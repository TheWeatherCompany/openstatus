import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Okta from "next-auth/providers/okta";
import Resend from "next-auth/providers/resend";

/**
 * Provider instances. Kept as upstream-style module-level const exports so
 * this file is safe to import from both client and server contexts — the
 * provider constructors read their auth env vars (AUTH_GITHUB_*, AUTH_GOOGLE_*,
 * AUTH_OKTA_*) internally via NextAuth, so OUR code never references
 * `process.env.*` here. That avoids Next.js 16 Turbopack's "secret leaked
 * across the client/server boundary" warning when the auth module is
 * pulled in by both layout.tsx (Server Component) and proxy.ts (middleware).
 *
 * Conditional inclusion (which providers are actually wired into NextAuth)
 * happens in ./index.ts — that file is server-only via the NextAuth handler,
 * so reading `process.env.*` for the conditional checks is safe there.
 */

export const GitHubProvider = GitHub({
  allowDangerousEmailAccountLinking: true,
});

export const GoogleProvider = Google({
  allowDangerousEmailAccountLinking: true,
  authorization: {
    params: {
      // See https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
      prompt: "select_account",
    },
  },
});

// Okta uses NextAuth's built-in env reading: AUTH_OKTA_ID / AUTH_OKTA_SECRET
// / AUTH_OKTA_ISSUER are picked up automatically when no explicit config is
// passed (NextAuth v5 convention). Self-hosted deployments that already use
// the OKTA_CLIENT_ID / OKTA_CLIENT_SECRET names should alias them at boot —
// see the example in mercury-charts/charts/openstatus-stack/RUNBOOK.md.
export const OktaProvider = Okta({
  allowDangerousEmailAccountLinking: true,
});

export const ResendProvider = Resend({
  apiKey: undefined, // REMINDER: keep undefined to avoid sending emails
  async sendVerificationRequest(params) {
    console.log("");
    console.log(`>>> Magic Link: ${params.url}`);
    console.log("");
  },
});

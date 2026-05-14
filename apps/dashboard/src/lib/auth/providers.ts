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

// Okta config is read from OKTA_CLIENT_ID / OKTA_CLIENT_SECRET / OKTA_ISSUER
// — these are the canonical names already in use across the openstatus repo
// + the TWC deployment (ALB OIDC also reads these). Passing them explicitly
// here means we don't need to alias to NextAuth v5's AUTH_OKTA_* default
// names at deploy time. Single naming convention, end-to-end.
export const OktaProvider = Okta({
  clientId: process.env.OKTA_CLIENT_ID,
  clientSecret: process.env.OKTA_CLIENT_SECRET,
  issuer: process.env.OKTA_ISSUER,
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

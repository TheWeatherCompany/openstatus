import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Okta from "next-auth/providers/okta";
import Resend from "next-auth/providers/resend";

/**
 * Build the list of enabled NextAuth providers based on what's configured.
 *
 * Each provider is included only when its credentials (or feature flag) are
 * present in the environment. Empty/missing env vars => provider isn't
 * registered => button doesn't appear on /login. This avoids non-functional
 * sign-in options that look working but fail at click-time with
 * "missing client_id" errors — common pain point on first self-host setup.
 *
 * Add a new provider:
 *   1. import it from `next-auth/providers/<name>`
 *   2. push it into `providers` here, gated on its required env vars
 *   3. set those env vars in your deployment (or leave empty to hide the button)
 *
 * Magic-link (Resend) stays gated by SELF_HOST=true OR NODE_ENV=development,
 * preserving prior upstream behavior.
 */
export function getEnabledProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        allowDangerousEmailAccountLinking: true,
        authorization: {
          params: {
            // See https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
            prompt: "select_account",
          },
        },
      }),
    );
  }

  if (
    process.env.AUTH_OKTA_ID &&
    process.env.AUTH_OKTA_SECRET &&
    process.env.AUTH_OKTA_ISSUER
  ) {
    providers.push(
      Okta({
        clientId: process.env.AUTH_OKTA_ID,
        clientSecret: process.env.AUTH_OKTA_SECRET,
        issuer: process.env.AUTH_OKTA_ISSUER,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (
    process.env.NODE_ENV === "development" ||
    process.env.SELF_HOST === "true"
  ) {
    providers.push(ResendProvider);
  }

  return providers;
}

export const ResendProvider = Resend({
  apiKey: undefined, // REMINDER: keep undefined to avoid sending emails
  async sendVerificationRequest(params) {
    console.log("");
    console.log(`>>> Magic Link: ${params.url}`);
    console.log("");
  },
});

/**
 * Back-compat exports — older code paths in this app and tests import the
 * provider symbols directly. Kept so this change is purely additive.
 *
 * @deprecated prefer `getEnabledProviders()` — these symbols are unconditional
 * and don't reflect whether the provider is actually enabled at runtime.
 */
export const GitHubProvider = GitHub({
  allowDangerousEmailAccountLinking: true,
});

export const GoogleProvider = Google({
  allowDangerousEmailAccountLinking: true,
  authorization: {
    params: {
      prompt: "select_account",
    },
  },
});
</content>

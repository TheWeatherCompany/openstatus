import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";

import { Events, setupAnalytics } from "@openstatus/analytics";
import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";

import { WelcomeEmail, sendEmail } from "@openstatus/emails";
import { headers } from "next/headers";
import { adapter } from "./adapter";
import {
  GitHubProvider,
  GoogleProvider,
  OktaProvider,
  ResendProvider,
} from "./providers";

export type { DefaultSession };

/**
 * Build the enabled-provider list based on which credentials are present in
 * the environment. Lives here (server-only auth handler module) rather than
 * in ./providers.ts so OUR code doesn't read `process.env.*` from a file
 * that crosses the client/server boundary (Next.js 16 / Turbopack rejects
 * that). Empty/missing env vars = provider not registered = no UI button.
 *
 * Magic-link (Resend) stays gated by SELF_HOST=true OR NODE_ENV=development,
 * preserving prior upstream behavior.
 */
function buildProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(GitHubProvider);
  }
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(GoogleProvider);
  }
  // NextAuth v5 reads AUTH_OKTA_ID / AUTH_OKTA_SECRET / AUTH_OKTA_ISSUER
  // automatically; we gate registration on their presence so the Okta sign-in
  // button only renders when the deployment has actually configured Okta.
  if (
    process.env.AUTH_OKTA_ID &&
    process.env.AUTH_OKTA_SECRET &&
    process.env.AUTH_OKTA_ISSUER
  ) {
    providers.push(OktaProvider);
  }
  if (
    process.env.NODE_ENV === "development" ||
    process.env.SELF_HOST === "true"
  ) {
    providers.push(ResendProvider);
  }

  return providers;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // debug: true,
  adapter,
  providers: buildProviders(),
  callbacks: {
    async signIn(params) {
      // We keep updating the user info when we loggin in

      if (params.account?.provider === "google") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        await db
          .update(user)
          .set({
            firstName: params.profile.given_name,
            lastName: params.profile.family_name || "",
            photoUrl: params.profile.picture,
            // keep the name in sync
            name: `${params.profile.given_name} ${
              params.profile.family_name || ""
            }`.trim(),
            updatedAt: new Date(),
          })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }
      if (params.account?.provider === "github") {
        if (!params.profile) return true;
        if (Number.isNaN(Number(params.user.id))) return true;

        await db
          .update(user)
          .set({
            name: params.profile.name,
            photoUrl: String(params.profile.avatar_url),
            updatedAt: new Date(),
          })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }

      // REMINDER: only used in dev mode
      if (params.account?.provider === "resend") {
        if (Number.isNaN(Number(params.user.id))) return true;
        await db
          .update(user)
          .set({ updatedAt: new Date() })
          .where(eq(user.id, Number(params.user.id)))
          .run();
      }

      return true;
    },
    async session(params) {
      return params.session;
    },
  },
  events: {
    // That should probably done in the callback method instead
    async createUser(params) {
      if (!params.user.id || !params.user.email) {
        throw new Error("User id & email is required");
      }

      // this means the user has already been created with clerk
      if (params.user.tenantId) return;

      await sendEmail({
        from: "Thibault from OpenStatus <thibault@openstatus.dev>",
        subject: "Welcome to OpenStatus.",
        to: [params.user.email],
        react: WelcomeEmail(),
      });

      const analytics = await setupAnalytics({
        userId: `usr_${params.user.id}`,
        email: params.user.email,
        location: (await headers()).get("x-forwarded-for") ?? undefined,
        userAgent: (await headers()).get("user-agent") ?? undefined,
      });

      await analytics.track(Events.CreateUser);
    },

    async signIn(params) {
      if (params.isNewUser) return;
      if (!params.user.id || !params.user.email) return;

      const analytics = await setupAnalytics({
        userId: `usr_${params.user.id}`,
        email: params.user.email,
        location: (await headers()).get("x-forwarded-for") ?? undefined,
        userAgent: (await headers()).get("user-agent") ?? undefined,
      });

      await analytics.track(Events.SignInUser);
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  // basePath: "/api/auth", // default is `/api/auth`
  // secret: process.env.AUTH_SECRET, // default is `AUTH_SECRET`
  debug: process.env.NODE_ENV === "development",
});

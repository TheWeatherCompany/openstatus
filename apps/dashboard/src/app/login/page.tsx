import type { Metadata } from "next";
import Link from "next/link";

import { signIn } from "@/lib/auth";
import { GitHubIcon } from "@openstatus/icons";
import { GoogleIcon } from "@openstatus/icons";
import { Separator } from "@openstatus/ui/components/ui/separator";
import type { SearchParams } from "nuqs/server";
import { LoginButton } from "./_components/login-button";
import MagicLinkForm from "./_components/magic-link-form";
import { searchParamsCache } from "./search-params";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to openstatus. Monitor your services and keep your users informed.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${process.env.OPENSTATUS_URL || "https://app.openstatus.dev"}/login`,
  },
};

export default async function Page(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const { redirectTo } = searchParamsCache.parse(searchParams);

  return (
    <div className="my-16 grid w-full max-w-lg gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-cal text-3xl tracking-tight">Sign In</h1>
        <p className="text-pretty font-commit-mono text-muted-foreground text-sm">
          Get started now. No credit card required.
        </p>
      </div>
      <div className="grid gap-4 p-4">
        {process.env.NODE_ENV === "development" ||
        process.env.SELF_HOST === "true" ? (
          <div className="grid gap-4">
            <MagicLinkForm />
            <Separator />
          </div>
        ) : null}
        {process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET ? (
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: redirectTo ?? undefined });
            }}
            className="w-full"
          >
            <LoginButton type="submit" provider="github">
              Sign in with GitHub <GitHubIcon className="ml-2 h-4 w-4" />
            </LoginButton>
          </form>
        ) : null}
        {process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: redirectTo ?? undefined });
            }}
            className="w-full"
          >
            <LoginButton type="submit" provider="google">
              Sign in with Google <GoogleIcon className="ml-2 h-4 w-4" />
            </LoginButton>
          </form>
        ) : null}
        {process.env.AUTH_OKTA_ID &&
        process.env.AUTH_OKTA_SECRET &&
        process.env.AUTH_OKTA_ISSUER ? (
          <form
            action={async () => {
              "use server";
              await signIn("okta", { redirectTo: redirectTo ?? undefined });
            }}
            className="w-full"
          >
            <LoginButton type="submit" provider="okta">
              Sign in with Okta
            </LoginButton>
          </form>
        ) : null}
      </div>
      <p className="mx-auto max-w-md text-pretty px-8 text-center text-muted-foreground text-xs">
        By clicking continue, you agree to our{" "}
        <Link
          href="https://openstatus.dev/legal/terms"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="https://openstatus.dev/legal/privacy"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

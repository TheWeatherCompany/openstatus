import { OpenPanel, type PostEventPayload } from "@openpanel/sdk";
import { env } from "../env";
import type { EventProps } from "./events";

// Only construct the OpenPanel SDK when real creds are configured. Upstream
// instantiated it unconditionally with whatever was in env (often empty
// strings in self-hosted setups), which caused the SDK to fire /track POSTs
// to api.openpanel.dev with an empty client_id → cascading 401s in the
// browser console. The `setupAnalytics` function already early-returns a
// no-op outside production; this guard catches the missing-creds case too.
const hasOpenPanelCreds = Boolean(
  env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID && env.OPENPANEL_CLIENT_SECRET,
);

const op = hasOpenPanelCreds
  ? new OpenPanel({
      clientId: env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
      clientSecret: env.OPENPANEL_CLIENT_SECRET,
    })
  : null;

op?.setGlobalProperties({
  env: process.env.VERCEL_ENV || process.env.NODE_ENV || "localhost",
  // app_version
});

export type IdentifyProps = {
  userId?: string;
  fullName?: string | null;
  email?: string;
  workspaceId?: string;
  plan?: "free" | "starter" | "team";
  // headers from the request
  location?: string;
  userAgent?: string;
};

export async function setupAnalytics(props: IdentifyProps) {
  if (process.env.NODE_ENV !== "production") {
    return noop();
  }
  // Same noop fallback when OpenPanel creds aren't configured (self-hosted
  // without observability). Callers don't have to check; they just call
  // .track(...) and get a logged no-op.
  if (!op) {
    return noop();
  }

  if (props.location) {
    op.api.addHeader("x-client-ip", props.location);
  }

  if (props.userAgent) {
    op.api.addHeader("user-agent", props.userAgent);
  }

  if (props.userId) {
    const [firstName, lastName] = props.fullName?.split(" ") || [];
    await op.identify({
      profileId: props.userId,
      email: props.email,
      firstName: firstName,
      lastName: lastName,
      properties: {
        workspaceId: props.workspaceId,
        plan: props.plan,
      },
    });
  }

  return {
    track: (opts: EventProps & PostEventPayload["properties"]) => {
      const { name, ...rest } = opts;
      return op.track(name, rest);
    },
  };
}

/**
 * Noop analytics for development environment
 */
async function noop() {
  return {
    track: (
      opts: EventProps & PostEventPayload["properties"],
    ): Promise<unknown> => {
      return new Promise((resolve) => {
        console.log(`>>> Track Noop Event: ${opts.name}`);
        resolve(null);
      });
    },
  };
}

import type { Metadata } from "next";

export const TITLE = "openstatus";
export const DESCRIPTION =
  "Open-source platform to monitor your services and keep your users informed.";

const OG_TITLE = "openstatus";
const OG_DESCRIPTION = "Monitor your services and keep your users informed.";
// Origin shown in OG card footer + used as metadataBase. Server-side read
// from OPENSTATUS_URL (request-time); falls back to upstream so this file
// stays safe to render even when the env var is unset (e.g. local dev).
const OPENSTATUS_ORIGIN =
  process.env.OPENSTATUS_URL || "https://app.openstatus.dev";
const FOOTER = OPENSTATUS_ORIGIN.replace(/^https?:\/\//, "");
const IMAGE = "assets/og/dashboard-v2.png";

export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${TITLE}`,
    default: TITLE,
  },
  description: DESCRIPTION,
  metadataBase: new URL(OPENSTATUS_ORIGIN),
  robots: {
    index: false,
    follow: false,
  },
};

export const twitterMetadata: Metadata["twitter"] = {
  title: TITLE,
  description: DESCRIPTION,
  card: "summary_large_image",
  images: [
    `/api/og?title=${OG_TITLE}&description=${OG_DESCRIPTION}&footer=${FOOTER}&image=${IMAGE}`,
  ],
};

export const ogMetadata: Metadata["openGraph"] = {
  title: TITLE,
  description: DESCRIPTION,
  type: "website",
  images: [
    `/api/og?title=${OG_TITLE}&description=${OG_DESCRIPTION}&footer=${FOOTER}&image=${IMAGE}`,
  ],
};

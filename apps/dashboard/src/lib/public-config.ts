/**
 * Runtime-injected public configuration.
 *
 * WHY: Self-hosted deploys need different canonical URLs per environment
 * (dev / nonprod / prod / k3d-local). NEXT_PUBLIC_* env vars bake at build
 * time into the client bundle, so they'd require one image per env. We
 * publish a single image and resolve per-env at runtime instead.
 *
 * HOW: `RootLayout` reads `process.env.OPENSTATUS_URL` server-side at every
 * request, then injects a `<script>` tag that sets a window global. Client
 * components read the global via `getPublicConfig()`. Server components
 * read `process.env.OPENSTATUS_URL` directly (no need to round-trip).
 *
 * Env vars consumed:
 *   - OPENSTATUS_URL: canonical dashboard origin (e.g.
 *     "https://openstatus.dev.mercury.weather.com" or
 *     "http://localhost:5000"). Falls back to "https://app.openstatus.dev"
 *     to preserve upstream behavior when unset.
 *
 * Keep this file tiny and dependency-free — it's imported from both server
 * and client code paths and runs before any data fetching.
 */

const PUBLIC_CONFIG_KEY = "__OPENSTATUS_PUBLIC_CONFIG__";

export type PublicConfig = {
  /** Canonical dashboard URL — invite links, OG metadata, slack-card API URL. */
  openstatusUrl: string;
  /**
   * Wildcard domain hosting status pages (no scheme, no slug). Status page URL
   * is composed as `https://<slug>.<statusPageOrigin>`. Set this to your
   * wildcard cert domain (e.g. "status.weather.com") on EKS, or leave at the
   * upstream default if you publish to *.openstatus.dev still.
   */
  statusPageOrigin: string;
};

function readServerConfig(): PublicConfig {
  return {
    openstatusUrl: process.env.OPENSTATUS_URL || "https://app.openstatus.dev",
    statusPageOrigin: process.env.STATUS_PAGE_ORIGIN || "openstatus.dev",
  };
}

/**
 * Returns the runtime-resolved public config.
 *
 * Works in three contexts:
 *  - Server Components / Route Handlers / Server Actions: reads `process.env`
 *    directly (request-time, no caching).
 *  - Client Components after RootLayout has rendered: reads the window global.
 *  - Client Components BEFORE RootLayout (extremely rare — e.g. error pages):
 *    falls back to upstream defaults so the page still renders.
 */
export function getPublicConfig(): PublicConfig {
  if (typeof window !== "undefined") {
    const injected = (window as unknown as Record<string, PublicConfig>)[
      PUBLIC_CONFIG_KEY
    ];
    if (injected) return injected;
    // Fall back to upstream defaults rather than throw — avoids breaking
    // boundary cases like error.tsx that render outside the normal flow.
    return {
      openstatusUrl: "https://app.openstatus.dev",
      statusPageOrigin: "openstatus.dev",
    };
  }
  return readServerConfig();
}

/**
 * Server-only helper for RootLayout. Returns a JS snippet (string) that
 * sets the window global. Inject via `<script dangerouslySetInnerHTML>`.
 */
export function publicConfigInlineScript(): string {
  const cfg = readServerConfig();
  // JSON.stringify is safe here — only string values, no XSS vector from
  // OPENSTATUS_URL (operator-controlled env var, not user input).
  return `window.${PUBLIC_CONFIG_KEY}=${JSON.stringify(cfg)};`;
}

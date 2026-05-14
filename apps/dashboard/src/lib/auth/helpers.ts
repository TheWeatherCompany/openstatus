import type { AdapterUser } from "next-auth/adapters";
import * as randomWordSlugs from "random-word-slugs";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

/**
 * Self-hosted unlock: every newly-created workspace starts on plan='team'
 * with all Pro feature flags on. The hosted SaaS default is plan='hobby'
 * which gates customDomain / status-subscribers / audit-log / etc. — none
 * of which make sense self-hosted (no billing tier exists).
 *
 * Keep this JSON in sync with mercury-charts/openstatus-stack/migrations/
 * always_unlock_workspace_limits.sql — that SQL refreshes pre-existing
 * rows on every helm reconcile, this code unlocks brand-new rows at
 * INSERT time. Both must match upstream's `limitsSchema`
 * (packages/db/src/schema/workspaces/validation.ts) exactly because the
 * dashboard validates `limits` via Zod on every workspace edit.
 */
const TEAM_LIMITS = JSON.stringify({
  monitors: 9999,
  "synthetic-checks": 9999999,
  periodicity: ["30s", "1m", "5m", "10m", "30m", "1h"],
  "multi-region": true,
  "max-regions": 35,
  "data-retention": "24 months",
  regions: [
    "ams", "arn", "atl", "bog", "bom", "bos", "cdg", "den", "dfw", "ewr",
    "eze", "fra", "gdl", "gig", "gru", "hkg", "iad", "jnb", "lax", "lhr",
    "mad", "mia", "nrt", "ord", "otp", "phx", "qro", "scl", "sjc", "sea",
    "sin", "syd", "waw", "yul", "yyz",
  ],
  "private-locations": true,
  screenshots: true,
  "response-logs": true,
  otel: true,
  "status-pages": 999,
  "page-components": 999,
  maintenance: true,
  "monitor-values-visibility": true,
  "status-subscribers": true,
  "custom-domain": true,
  i18n: true,
  "password-protection": true,
  "email-domain-protection": true,
  "ip-restriction": true,
  "white-label": true,
  "no-index": true,
  notifications: true,
  pagerduty: true,
  opsgenie: true,
  "grafana-oncall": true,
  whatsapp: true,
  sms: true,
  "sms-limit": 999,
  "notification-channels": 999,
  members: "Unlimited",
  "audit-log": true,
  "slack-agent": true,
});

/**
 * Auto-join firm SSO users to a shared workspace.
 *
 * When FIRM_EMAIL_DOMAIN matches a user's email, they're added to the
 * workspace identified by FIRM_WORKSPACE_SLUG instead of getting their
 * own random-slug workspace. Mirrors how Claude.ai / ChatGPT Enterprise /
 * Notion / Slack handle SSO: sign in via SSO → land in the org workspace
 * as a member, with the option to create personal workspaces later.
 *
 * Behavior:
 *   - Domain match + firm workspace exists  → join as "member"
 *   - Domain match + firm workspace absent  → become "owner" of a
 *     freshly-created workspace with the canonical slug (first user
 *     bootstraps the firm workspace for everyone after them)
 *   - Domain miss (or env vars unset)       → upstream behavior:
 *     random 2-word slug, user becomes "owner"
 *
 * Both env vars are optional. Leave unset to disable auto-join entirely
 * (preserves upstream behavior bit-for-bit).
 */
function matchesFirmDomain(email: string | null | undefined): boolean {
  const domain = process.env.FIRM_EMAIL_DOMAIN;
  if (!domain || !email) return false;
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

async function resolveWorkspaceForNewUser(
  userId: number,
  email: string | null | undefined,
): Promise<{ workspaceId: number; role: "owner" | "member" }> {
  const firmSlug = process.env.FIRM_WORKSPACE_SLUG;
  // Display name shown in the workspace switcher + dashboard chrome. The
  // first firm-domain user bootstraps the workspace with this name; later
  // users join the existing row, so this value is only consulted once per
  // env. Defaults to "The Weather Company" for our deployment; override
  // via env if forking this fork for another org.
  const firmName = process.env.FIRM_WORKSPACE_NAME || "The Weather Company";

  if (firmSlug && matchesFirmDomain(email)) {
    const existing = await db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.slug, firmSlug))
      .get();

    if (existing) {
      console.log(
        `auto-join: ${email} → workspace '${firmSlug}' (id=${existing.id}) as member`,
      );
      return { workspaceId: existing.id, role: "member" };
    }

    // First firm-domain user — create the canonical firm workspace and
    // make them its owner. Subsequent firm-domain users will hit the
    // `existing` branch above and auto-join as members.
    const created = await db
      .insert(workspace)
      .values({
        slug: firmSlug,
        name: firmName,
        plan: "team",
        limits: TEAM_LIMITS,
      })
      .returning({ id: workspace.id })
      .get();
    console.log(
      `auto-join: ${email} bootstrapped workspace '${firmSlug}' (name='${firmName}', id=${created.id}) as owner`,
    );
    return { workspaceId: created.id, role: "owner" };
  }

  // Non-firm user (or auto-join disabled) — upstream path: random slug,
  // user becomes owner of their own workspace.
  let slug: string | undefined = undefined;
  while (!slug) {
    slug = randomWordSlugs.generateSlug(2);
    const slugAlreadyExists = await db
      .select()
      .from(workspace)
      .where(eq(workspace.slug, slug))
      .get();
    if (slugAlreadyExists) {
      console.warn(`slug already exists: '${slug} - recreating new one'`);
      slug = undefined;
    }
  }
  const created = await db
    .insert(workspace)
    .values({ slug, name: "", plan: "team", limits: TEAM_LIMITS })
    .returning({ id: workspace.id })
    .get();
  return { workspaceId: created.id, role: "owner" };
}

export async function createUser(data: AdapterUser) {
  const newUser = await db
    .insert(user)
    .values({
      email: data.email,
      photoUrl: data.image,
      name: data.name,
      firstName: data.firstName,
      lastName: data.lastName,
    })
    .returning()
    .get();

  const { workspaceId, role } = await resolveWorkspaceForNewUser(
    newUser.id,
    data.email,
  );

  await db
    .insert(usersToWorkspaces)
    .values({
      userId: newUser.id,
      workspaceId,
      role,
    })
    .returning()
    .get();

  return newUser;
}

export async function getUser(id: string) {
  const _user = await db
    .select()
    .from(user)
    .where(eq(user.id, Number(id)))
    .get();

  return _user || null;
}

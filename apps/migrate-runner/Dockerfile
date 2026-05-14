# syntax=docker/dockerfile:1.7
#
# migrate-runner — single-purpose image that applies Drizzle migrations
# against an OpenStatus libSQL instance. Consumed by the
# `drizzle-migrate-hook` in mercury-charts/charts/openstatus-stack (Helm
# post-install/post-upgrade hook, weight 0).
#
# Why this exists:
#   The upstream service images (workflows/server/dashboard/...) are
#   stripped runtime bundles — they don't ship packages/db/src/migrate.mts
#   or the drizzle/*.sql files. A fresh libSQL has no schema until someone
#   runs migrations by hand. This image is what runs them.
#
# Why a dedicated image rather than "clone + bun install" inside the hook:
#   - No network dependency at deploy time (image is pre-pulled like every
#     other chart image; ECR creds via existing IRSA on EKS).
#   - No apt-get / curl / git inside the hook script.
#   - Predictable timing: hook completes in seconds, not minutes.
#
# Build context: monorepo root (.). We need packages/db/{src,drizzle,env.mjs}
# plus apps/migrate-runner/{package.json,Dockerfile}.

FROM oven/bun:1.3.11 AS install
WORKDIR /app

# Use the migrate-runner's own package.json (not the monorepo's) so bun
# doesn't walk up looking for workspace: deps it can't resolve. The four
# deps migrate.mts actually imports — and nothing else — are pinned in
# apps/migrate-runner/package.json.
COPY apps/migrate-runner/package.json ./package.json
RUN \
    --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --production

FROM oven/bun:1.3.11 AS runtime
LABEL \
    org.opencontainers.image.source="https://github.com/TheWeatherCompany/openstatus" \
    org.opencontainers.image.title="OpenStatus Drizzle Migrate Runner" \
    org.opencontainers.image.description="One-shot Drizzle migration runner for self-hosted OpenStatus on Mercury"
WORKDIR /app

COPY --from=install /app/node_modules /app/node_modules
COPY --from=install /app/package.json /app/package.json

# Bring in the Drizzle source migrate.mts cares about. drizzle/ holds the
# generated SQL migrations; src/migrate.mts is the runner; env.mjs is its
# config (skipValidation:true upstream so missing CLICKHOUSE vars are OK).
COPY packages/db/src/migrate.mts /app/src/migrate.mts
COPY packages/db/drizzle         /app/drizzle
COPY packages/db/env.mjs         /app/env.mjs

USER 1000:1000
ENTRYPOINT ["bun", "src/migrate.mts"]

ARG NODE_VERSION=24.19.0

# Base
FROM node:${NODE_VERSION} AS base

WORKDIR /app

RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PNPM_HOME/bin:$PATH

RUN corepack enable
RUN corepack prepare pnpm@11.5.0 --activate
RUN pnpm add -g turbo
RUN pnpm add -g tsx


# Prune stage
FROM base AS pruner

COPY . .

RUN tsx ./scripts/generate-sdks.ts

# https://turbo.build/repo/docs/guides/tools/docker
RUN turbo prune --scope=@hexclave/backend --scope=@hexclave/dashboard --scope=@hexclave/template --docker



# Build stage
FROM base AS builder

# Skip generate-sdks.ts in preinstall hook (file not available in pruned output)
ENV HEXCLAVE_SKIP_TEMPLATE_GENERATION=true

# Turborepo remote cache (optional). When TURBO_API/TURBO_TEAM are passed as build
# args and a TURBO_TOKEN secret is mounted on the build step below, `turbo run`
# pulls/pushes artifacts from the remote cache to skip unchanged work. Left empty
# (no token) for local builds, in which case turbo just builds normally.
ARG TURBO_API=
ARG TURBO_TEAM=
ENV TURBO_API=${TURBO_API}
ENV TURBO_TEAM=${TURBO_TEAM}

# copy over package.json files and install dependencies
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml .
COPY .gitignore .
COPY pnpm-workspace.yaml .
COPY turbo.json .
COPY configs ./configs
COPY --from=pruner /app/scripts/postinstall-patch-next-async-debug-info.mjs ./scripts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# copy over the rest of the code for the build
COPY --from=pruner /app/out/full/ .

# `turbo prune` selects files via git, and .gitignore ignores the *contents* of
# the generated SDK packages (packages/js, packages/next, packages/react,
# packages/tanstack-start -- only their package.json is tracked, see the
# "Generated packages" block in .gitignore). The pruned output therefore carries
# hollow packages: a package.json with no src/ and no scripts/. Restore the
# sources that the pruner stage generated with generate-sdks.ts.
#
# Without this, @hexclave/next#build dies on its missing scripts/generate-env.ts,
# and when a warm turbo/GHA cache papers over that failure the dashboard's
# Next.js build traces the hollow workspace deps into a standalone output made
# almost entirely of zero-byte files -- an image that builds green and then
# crash-loops at runtime with ERR_INVALID_PACKAGE_CONFIG.
COPY --from=pruner /app/packages/js ./packages/js
COPY --from=pruner /app/packages/next ./packages/next
COPY --from=pruner /app/packages/react ./packages/react
COPY --from=pruner /app/packages/tanstack-start ./packages/tanstack-start

# Dashboard still needs standalone output for its Next.js build
ENV NEXT_CONFIG_OUTPUT=standalone

# Build the backend and dashboard
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=secret,id=TURBO_TOKEN \
    TURBO_TOKEN="$(cat /run/secrets/TURBO_TOKEN 2>/dev/null || true)" \
    pnpm turbo run docker-build --filter=@hexclave/backend... --filter=@hexclave/dashboard...

# Verify the dashboard standalone output is real before it can reach an image.
# A warm turbo/GHA cache can satisfy a build step that would otherwise fail and
# leave a standalone tree of zero-byte files behind; the resulting image builds
# green, passes its TCP healthcheck, and only fails at runtime with
# ERR_INVALID_PACKAGE_CONFIG -- which also takes the backend down, because
# entrypoint.sh reaps the sibling process when either service exits. Fail loudly
# here instead of publishing that image.
RUN set -eu; \
    sa=/app/apps/dashboard/.next/standalone; \
    [ -d "$sa" ] || { echo "FATAL: $sa does not exist" >&2; exit 1; }; \
    for f in "$sa/apps/dashboard/server.js" "$sa/apps/dashboard/package.json"; do \
      [ -s "$f" ] || { echo "FATAL: $f is missing or empty -- dashboard build did not produce a usable standalone output" >&2; exit 1; }; \
    done; \
    total=$(find "$sa" -type f | wc -l); \
    empty=$(find "$sa" -type f -size 0 | wc -l); \
    echo "dashboard standalone: $total files, $empty empty"; \
    [ "$total" -ge 100 ] || { echo "FATAL: only $total files in standalone output" >&2; exit 1; }; \
    [ "$((empty * 10))" -le "$total" ] || { echo "FATAL: $empty of $total standalone files are zero bytes" >&2; exit 1; }

# Build the self-host seed script
RUN --mount=type=cache,id=pnpm,target=/pnpm/store cd apps/backend && pnpm build-self-host-migration-script



# Final image
FROM node:${NODE_VERSION}-slim

WORKDIR /app

# Install packages needed for deployment
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y openssl postgresql-client socat && \
    rm -rf /var/lib/apt/lists

# Copy built dashboard (standalone includes monorepo apps/ structure)
COPY --from=builder --chown=node:node /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=node:node /app/apps/dashboard/public ./apps/dashboard/public

# Restore workspace node_modules needed by non-Next runtime scripts (e.g. migrations)
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages

# Copy the bundled Elysia backend LAST — the dashboard standalone output includes
# a traced subset of apps/backend/ via pnpm workspace symlinks, and Docker COPY
# creates opaque directory layers that hide files from earlier layers. By copying
# the real backend dist after everything else, its files are guaranteed visible.
COPY --from=builder --chown=node:node /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=node:node /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder --chown=node:node /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder --chown=node:node /app/apps/backend/package.json ./apps/backend/package.json

# Add the entrypoint script
COPY ./docker/server/entrypoint.sh .
RUN chmod +x entrypoint.sh

# Hash the complete assembled runtime tree once while building the image. The
# entrypoint uses this manifest to invalidate persistent runtime copies when any
# bundled backend, dashboard, workspace, or entrypoint artifact changes. Include
# entry types, modes, symlink targets, and regular-file contents, but not mtimes.
RUN { \
      find /app -mindepth 1 ! -path /app/.stack-runtime-build-identity -printf 'entry\t%y\t%m\t%p\t%l\n'; \
      find /app -mindepth 1 ! -path /app/.stack-runtime-build-identity -type f -exec sha256sum {} +; \
    } | LC_ALL=C sort | sha256sum | cut -d ' ' -f1 > /tmp/stack-runtime-build-identity && \
    mv /tmp/stack-runtime-build-identity /app/.stack-runtime-build-identity

WORKDIR /app

# Define environment variables for both services
ENV NODE_ENV=production
ENV BACKEND_PORT=8102
ENV DASHBOARD_PORT=8101

USER node

# The entrypoint completes migrations and seeding before either service listens. Give large
# production databases a realistic startup window, then require backend database readiness
# rather than accepting a process that cannot serve authenticated traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5m --retries=3 \
  CMD ["node", "-e", "Promise.all([fetch('http://127.0.0.1:' + process.env.BACKEND_PORT + '/health?db=1'), fetch('http://127.0.0.1:' + process.env.DASHBOARD_PORT + '/')]).then((responses) => { if (responses.some((response) => !response.ok)) process.exit(1); }).catch(() => process.exit(1));"]

# Set entrypoint to run both backend and dashboard
ENTRYPOINT ["./entrypoint.sh"]

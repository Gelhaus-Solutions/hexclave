# Temporal worker for self-hosted deployment. Runs the long-lived worker process
# (apps/worker) that executes all Hexclave workflows and activities.
#
# Build:  docker build -f docker/worker/Dockerfile --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD) -t hexclave-worker .
# Run:    docker run --env-file .env hexclave-worker
#
# Deploys: run the new SHA-tagged container, then stop the old one with a grace period at least
# as long as the worker's shutdownGraceTime (e.g. `docker stop --time=120 <old>`). With
# AUTO_UPGRADE worker versioning, the new build promotes itself to Current at startup (see
# apps/worker/src/promote-version.ts) — the Temporal cluster must have the dynamic config flag
# system.enableDeploymentVersions enabled.

ARG NODE_VERSION=22.21.1

# Base
FROM node:${NODE_VERSION} AS base

WORKDIR /app

RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

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

# The worker imports backend code (via the temporal-activities seam), so the prune pulls in
# @hexclave/backend and its workspace deps transitively.
RUN turbo prune --scope=@hexclave/worker --scope=@hexclave/template --docker


# Build stage
FROM base AS builder

# Skip generate-sdks.ts in preinstall hook (file not available in pruned output)
ENV HEXCLAVE_SKIP_TEMPLATE_GENERATION=true

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml .
COPY .gitignore .
COPY pnpm-workspace.yaml .
COPY turbo.json .
COPY configs ./configs
COPY --from=pruner /app/scripts/postinstall-patch-next-async-debug-info.mjs ./scripts/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# Build the worker's workspace dependencies (packages/temporal, packages/shared, ...). The
# worker itself runs from TypeScript source via tsx, so it has no build step of its own.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm turbo run build --filter=@hexclave/worker...

# Generate the Prisma client (backend's schema; the worker uses it through the seam)
RUN pnpm -C apps/backend run codegen-prisma


# Final image
FROM node:${NODE_VERSION}-slim

WORKDIR /app

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app ./

ARG GIT_COMMIT_SHA
ENV HEXCLAVE_GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV NODE_ENV=production

USER node

# tsx honors the worker tsconfig's paths mapping (the @/* alias into apps/backend/src)
CMD ["./apps/worker/node_modules/.bin/tsx", "--tsconfig", "apps/worker/tsconfig.json", "apps/worker/src/index.ts"]

# ============================================================
# Base
# ============================================================

FROM node:24-alpine AS base

WORKDIR /usr/src/app

COPY ./package*.json ./

# ============================================================
# Development dependencies
# ============================================================

FROM base AS development-deps

RUN npm ci

COPY . ./


# ============================================================
# Development
# ============================================================

FROM development-deps AS development

ENV NODE_ENV=development

EXPOSE 3000

CMD ["npm", "run", "start:dev"]


# ============================================================
# Production build
# ============================================================

FROM base AS builder

RUN npm ci

COPY . ./

# Generate Prisma client and build application
RUN npm run build


# ============================================================
# Production dependencies
# ============================================================

FROM base AS production-deps

ENV NODE_ENV=production
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

RUN npm ci --omit=dev && \
    npm cache clean --force


# ============================================================
# Production
# ============================================================

FROM node:24-alpine AS production

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

# Runtime package files
COPY --from=production-deps \
    --chown=appuser:appgroup \
    /usr/src/app/package*.json ./

COPY --from=production-deps \
    --chown=appuser:appgroup \
    /usr/src/app/node_modules ./node_modules

# Prisma migrations/config
COPY --from=builder \
    --chown=appuser:appgroup \
    /usr/src/app/prisma ./prisma

COPY --from=builder \
    --chown=appuser:appgroup \
    /usr/src/app/prisma.config.ts ./prisma.config.ts

# Compiled application
COPY --from=builder \
    --chown=appuser:appgroup \
    /usr/src/app/dist ./dist

# Production entrypoint
COPY --from=builder \
    --chown=appuser:appgroup \
    /usr/src/app/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

USER appuser

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]

CMD ["node", "dist/main.js"]

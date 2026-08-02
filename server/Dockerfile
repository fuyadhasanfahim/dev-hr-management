# Multi-stage Dockerfile for local development (E3-F3-T1).
#
# NOTE: PUPPETEER_SKIP_DOWNLOAD=true is set so `npm ci`'s postinstall step
# (`puppeteer browsers install chrome`, see package.json) doesn't try to
# download Chrome during the image build. That keeps this build small and
# avoids headless-Chrome's Debian dependency requirements, which are out of
# scope for this task (local backend/DB development, not PDF rendering).
# Endpoints that generate PDFs via Puppeteer (receipt/quotation PDF export)
# will NOT work in this containerized setup without further work — this is
# a known, documented limitation, not something silently broken.

FROM node:24-slim AS base
WORKDIR /app

FROM base AS deps
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 5000
CMD ["node", "dist/server.js"]

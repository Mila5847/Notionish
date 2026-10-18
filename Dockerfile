# Single-container image used as the Home Assistant add-on: the API serves the
# built web app and listens on the ingress port.

FROM node:20-alpine AS web
WORKDIR /web
COPY packages/web/package.json packages/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY packages/web/ ./
RUN npm run build

FROM node:20-alpine AS api
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY packages/api/package.json packages/api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY packages/api/prisma ./prisma
RUN npx prisma generate
COPY packages/api/tsconfig.json ./
COPY packages/api/src ./src
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
# Full node_modules: the prisma CLI is needed at startup for migrate deploy.
COPY --from=api /app/node_modules ./node_modules
COPY --from=api /app/package.json ./
COPY --from=api /app/prisma ./prisma
COPY --from=api /app/dist ./dist
COPY --from=web /web/dist ./web
COPY addon/start.mjs ./addon/start.mjs

ENV NODE_ENV=production \
    PORT=8099 \
    WEB_DIST=/app/web \
    UPLOAD_DIR=/data/uploads

CMD ["node", "/app/addon/start.mjs"]

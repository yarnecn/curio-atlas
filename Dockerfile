FROM node:24-bookworm-slim AS builder

WORKDIR /src
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY . .
RUN pnpm config set fetch-retries 5 \
 && pnpm config set fetch-timeout 120000 \
 && pnpm install --frozen-lockfile
RUN pnpm exec turbo run build \
      --filter=@knowledge-map/api \
      --filter=@knowledge-map/worker \
      --filter=@knowledge-map/web
RUN pnpm --offline --filter @knowledge-map/api deploy --prod --legacy /out/api \
 && pnpm --offline --filter @knowledge-map/worker deploy --prod --legacy /out/worker

FROM node:24-bookworm-slim AS runtime
ARG APP_VERSION=0.1.0
LABEL org.opencontainers.image.title="Curio Atlas" \
      org.opencontainers.image.version="$APP_VERSION"

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates python3 python-is-python3 tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /out/api ./apps/api
COPY --from=builder /out/worker ./apps/worker
COPY --from=builder /src/apps/web/.next/standalone/apps/web ./apps/web
COPY --from=builder /src/infra ./infra
COPY --from=builder /src/content ./content
COPY --from=builder /src/tools/crawler ./tools/crawler
COPY --from=builder /src/scripts/app-config.mjs ./scripts/app-config.mjs
COPY --from=builder /src/scripts/serve-image.mjs ./scripts/serve-image.mjs
RUN printf '%s' "$APP_VERSION" > /app/VERSION \
 && mkdir -p /app/config \
 && chown -R node:node /app

USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "/app/scripts/serve-image.mjs", "/app/config/app.config.json"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

FROM node:22.11.0-alpine AS build

WORKDIR /app

COPY package.json package-lock.json .nvmrc ./
RUN npm install --global npm@11.3.0 && npm --version
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY scripts/verify-wink-bridge.mjs scripts/sync-wink-bridge.mjs scripts/build-wink-warm.mjs ./scripts/
COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.25.3-alpine AS server

ENV ALLOWED_PARENT_ORIGINS="'none'"

COPY ./etc/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html/

RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

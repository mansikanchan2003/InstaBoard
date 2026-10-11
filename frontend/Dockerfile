# syntax=docker/dockerfile:1.7
# InstaBoard web image: the built React app served by unprivileged nginx, which also reverse-proxies /api to the
# backend so the browser talks to ONE origin (first-party session cookie, no cross-origin CORS in production).
#   docker build -t instaboard-web ./frontend                     # API mode (default)
#   docker build -t instaboard-web --build-arg VITE_DATA_SOURCE=demo ./frontend   # demo-only static build

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_DATA_SOURCE=api
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_DATA_SOURCE=${VITE_DATA_SOURCE} VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN if [ "$VITE_DATA_SOURCE" = "demo" ]; then npm run build; else npm run build:api; fi

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

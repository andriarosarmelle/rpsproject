FROM node:24-bookworm-slim AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_STRAPI_URL=""
ARG NEXT_PUBLIC_BACKEND_MODE="real"

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_STRAPI_URL=$NEXT_PUBLIC_STRAPI_URL
ENV NEXT_PUBLIC_BACKEND_MODE=$NEXT_PUBLIC_BACKEND_MODE

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001

CMD ["npm", "run", "start"]

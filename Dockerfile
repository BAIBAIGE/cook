FROM node:24-alpine AS builder

RUN apk update
RUN npm install -g pnpm@11.21.0

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile && pnpm run build

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80

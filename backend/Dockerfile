# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Production Stage ---
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./

RUN mkdir -p /app/uploads

# tsx wird fuer Seeding benoetigt
RUN npm install tsx

EXPOSE 3001

CMD ["node", "dist/index.js"]

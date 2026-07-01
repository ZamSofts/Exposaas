# -------- deps stage ----------
FROM node:20-bullseye AS deps

WORKDIR /app

COPY package*.json ./

# npm cache improves repeat installs
RUN --mount=type=cache,target=/root/.npm npm ci


# -------- builder stage ----------
FROM node:20-bullseye AS builder

WORKDIR /app

# reuse installed deps
COPY --from=deps /app/node_modules ./node_modules

# copy full source
COPY . .

# Prisma generate (same as your current flow)
RUN npx prisma generate

# Next build (unchanged)
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build


# -------- runtime stage ----------
FROM node:20-bullseye AS runner

WORKDIR /app

ENV NODE_ENV=production

# bring only what is needed to RUN (not build)
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/src/config ./src/config
COPY extra ./extra


# SAME command behavior as your package.json "start"
CMD ["npm", "run", "start"]

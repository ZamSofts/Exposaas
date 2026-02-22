FROM node:22-bullseye

WORKDIR /app

# Copy only dependency files first (better caching & safety)
COPY package*.json ./

RUN npm ci

# Copy the rest of the app
COPY . .


# Generate Prisma client INSIDE container
RUN npx prisma generate


# Build Next.js (REQUIRED for next start)
RUN npm run build


EXPOSE 3000



CMD ["npm", "run", "start"]

# Step 1: Use Node 22 because pg-boss requires it
FROM node:22-alpine

# Step 2: Set working directory
WORKDIR /app

# Step 3: Copy the rest of the project
COPY . .

# Step 4: Install dependencies
RUN npm install --legacy-peer-deps

# Step 5: Generate Prisma Client
RUN npx prisma generate

# Step 6: Build Next.js for production
RUN npm run build

# Step 7: Expose port
EXPOSE 3001

# Step 8: Run Prisma migrations and start app
CMD npx prisma migrate deploy && npm run start

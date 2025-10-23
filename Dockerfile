# Step 1: Use Node 22 because pg-boss requires it
FROM node:22-alpine

# Step 2: Set working directory
WORKDIR /app

# Step 3: Copy only package files and prisma folder first
COPY package*.json ./
COPY prisma ./prisma

# Step 4: Install dependencies
RUN npm install --legacy-peer-deps

# Step 5: Copy the rest of your project
COPY . .

# Step 6: Build Next.js app
RUN npm run build

# Step 7: Expose port
EXPOSE 3000

# Step 8: Start the app
CMD ["npm", "start"]

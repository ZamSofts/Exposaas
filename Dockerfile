# Step 1: Use Node 22 because pg-boss requires it
FROM node:22-alpine

# Step 2: Set working directory
WORKDIR /app

# Step 5: Copy the rest of the project
COPY . .

# Step 4: Install dependencies
RUN npm install --legacy-peer-deps

# Step 7: Expose port
EXPOSE 3001

# Step 8: Run Prisma commands and start app
CMD ["npm", "run", "start"]
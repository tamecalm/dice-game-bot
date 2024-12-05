# Step 1: Use an official Node.js image as the base
FROM node:18

# Step 2: Set the working directory to /app (this will be your root directory in the container)
WORKDIR /app

# Step 3: Copy package.json and package-lock.json to the working directory
# This step allows npm to install dependencies without copying the entire application first.
COPY package*.json ./

# Step 4: Install dependencies without using the cache to ensure you're getting fresh packages
RUN npm install --no-cache

# Step 5: Copy the rest of the application code into the container
COPY . .

# Step 6: Expose the port your bot listens on (e.g., 3000)
EXPOSE 3000

# Step 7: Define environment variables (use .env file for secrets)
ENV NODE_ENV=production

# Step 8: Define the entry point (ensure the path reflects your file structure)
CMD ["node", "src/config/app.js"]

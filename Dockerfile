# Step 1: Use an official Node.js image as the base
FROM node:18

# Step 2: Set the working directory inside the container
WORKDIR /src

# Step 3: Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy the rest of the application code
COPY . .

# Step 6: Expose the port your bot listens on (e.g., 3000)
EXPOSE 3000

# Step 7: Define environment variables (use .env file for secrets)
ENV NODE_ENV=production

# Step 8: Define the entry point
CMD ["node", "config/app"]
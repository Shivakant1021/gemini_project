# Use an official Node.js LTS image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the rest of the app files (excluding .dockerignore files)
COPY . .

# Expose the app port (change if not 3000)
EXPOSE 3000

# Run the app in production mode
CMD ["npm", "start"]

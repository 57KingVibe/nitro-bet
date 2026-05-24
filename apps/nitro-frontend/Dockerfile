# Use Alpine Linux with Node.js for a lightweight, fast build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json ./
RUN npm install

# Copy application source
COPY . .

# Build the production application
RUN npm run build

# Use a lightweight server to serve the static output
FROM node:18-alpine AS runner
WORKDIR /app

# Install 'serve' globally to host the static files
RUN npm install -g serve

# Copy built assets from the builder stage
COPY --from=builder /app/dist /app/dist

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["serve", "-s", "dist", "-l", "3000"]

# Bumped from node:18-alpine to node:20-alpine
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the Next.js application for production
RUN npm run build

# Next.js default port
EXPOSE 3000

# Start the production server
CMD ["npm", "start"]
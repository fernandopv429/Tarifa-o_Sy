FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the frontend and backend
RUN npm run build

# Expose the application port
EXPOSE 3000

ENV NODE_ENV=production

# Start the server using npm start
CMD ["npm", "run", "start"]

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the frontend and backend
RUN npm run build

# Install tsx globally to run TS directly
RUN npm install -g tsx

# Expose the application port
EXPOSE 3000

# Start the server using npm start
CMD ["npm", "run", "start"]

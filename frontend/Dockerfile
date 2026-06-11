FROM node:18-alpine

WORKDIR /app

# Copy frontend
COPY . .

# Install dependencies and build
RUN npm install && npm run build

# Install serve to run the production build
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Run the app
CMD ["serve", "-s", "build", "-l", "3000"]

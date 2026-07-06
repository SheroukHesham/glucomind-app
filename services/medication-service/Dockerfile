FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Install netcat variant
RUN apt-get update && apt-get install -y netcat-openbsd


CMD ["/wait-for-kafka.sh", "kafka", "npm", "run", "dev"]


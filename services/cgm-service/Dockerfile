FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install


COPY . .

RUN apt-get update \
    && apt-get install -y --no-install-recommends netcat-openbsd fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*


CMD ["/wait-for-kafka.sh", "kafka", "npm", "run", "dev"]

EXPOSE 3000
EXPOSE 4000

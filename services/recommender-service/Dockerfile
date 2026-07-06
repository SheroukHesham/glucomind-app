FROM node:18

# Set working directory
WORKDIR /app

# Copy Node package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Install Python, pip, venv, and required build tools
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv python3-distutils netcat-openbsd && ln -sf /usr/bin/python3 /usr/bin/python



# Create a virtual environment
RUN python3 -m venv /opt/venv

# Set environment so pip uses the venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies inside venv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all app files
COPY . .


# Command to start the service after Kafka is ready
# Dockerfile
CMD ["/wait-for-kafka.sh", "kafka", "npm", "run", "dev"]

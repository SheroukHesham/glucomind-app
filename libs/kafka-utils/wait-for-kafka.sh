#!/bin/bash

# Wait for Kafka
echo "Waiting for Kafka..."
until nc -z kafka 9092; do
  sleep 2
done

# Wait for MongoDB
echo "Waiting for MongoDB..."
until nc -z mongodb 27017; do
  sleep 2
done

echo "All services are up. Starting Node.js..."
exec "${@:2}"

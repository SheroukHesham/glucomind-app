#!/bin/bash
set -euo pipefail

BOOTSTRAP="${KAFKA_BOOTSTRAP:-kafka:9092}"
KAFKA_TOPICS=/opt/bitnami/kafka/bin/kafka-topics.sh

echo "Waiting for Kafka at $BOOTSTRAP..."
until "$KAFKA_TOPICS" --bootstrap-server "$BOOTSTRAP" --list >/dev/null 2>&1; do
  sleep 2
done

# create_topic <name> <partitions> <replication> [key=value ...]
create_topic() {
  local name=$1 partitions=$2 replication=$3
  shift 3
  local config_args=()
  for c in "$@"; do config_args+=(--config "$c"); done

  "$KAFKA_TOPICS" --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
    --topic "$name" --partitions "$partitions" --replication-factor "$replication" \
    ${config_args[@]+"${config_args[@]}"}
}

# ---- cgm-service -> emergency-service
create_topic glucose-events 3 1

# ---- user-service -> medication / recommender
create_topic medication-creation-events 3 1
create_topic user-creation-events 3 1
create_topic user-settings 3 1 cleanup.policy=compact

# ---- planned (from the earlier designs): uncomment when you implement them
create_topic device-tokens 3 1 cleanup.policy=compact
create_topic registration.medication.command 3 1
create_topic registration.diet.command 3 1
create_topic registration.emergency.command 3 1
create_topic registration.result 3 1

echo "Topics ready:"
"$KAFKA_TOPICS" --bootstrap-server "$BOOTSTRAP" --list

#!/bin/bash
set -euo pipefail

BOOTSTRAP="${KAFKA_BOOTSTRAP:-kafka:9092}"
KAFKA_TOPICS="/opt/bitnami/kafka/bin/kafka-topics.sh"

echo "Waiting for Kafka at ${BOOTSTRAP}..."

until "$KAFKA_TOPICS" --bootstrap-server "$BOOTSTRAP" --list >/dev/null 2>&1; do
  sleep 2
done

echo "Kafka is available."

# create_topic <name> <partitions> <replication> [key=value ...]
create_topic() {
  local name="$1"
  local partitions="$2"
  local replication="$3"

  shift 3

  local -a config_args=()

  for config in "$@"; do
    config_args+=(--config "$config")
  done

  echo "Creating topic: ${name}"

  if ((${#config_args[@]} > 0)); then
    "$KAFKA_TOPICS" \
      --bootstrap-server "$BOOTSTRAP" \
      --create \
      --if-not-exists \
      --topic "$name" \
      --partitions "$partitions" \
      --replication-factor "$replication" \
      "${config_args[@]}"
  else
    "$KAFKA_TOPICS" \
      --bootstrap-server "$BOOTSTRAP" \
      --create \
      --if-not-exists \
      --topic "$name" \
      --partitions "$partitions" \
      --replication-factor "$replication"
  fi
}

# CGM -> Emergency
create_topic glucose-events 3 1

# User -> Medication / Recommender
create_topic medication-creation-events 3 1
create_topic user-creation-events 3 1
create_topic user-settings 3 1 cleanup.policy=compact

# Device token synchronization
create_topic device-tokens 3 1 cleanup.policy=compact

# Registration workflow
create_topic registration 3 1
create_topic registration.diet.command 3 1
# create_topic registration.emergency.command 3 1
# create_topic registration.medication.command 3 1
create_topic registration.result 3 1
create_topic registration.completed 3 1

echo ""
echo "Topics ready:"
"$KAFKA_TOPICS" --bootstrap-server "$BOOTSTRAP" --list

# syntax=docker/dockerfile:1
#
# A React Native app is not "served" like a website. This image runs the Expo dev server (Metro):
# the phone / emulator opens the QR code and downloads the JavaScript bundle from it.
# The installable app itself (APK / IPA) is produced by `eas build`, outside Docker.

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-slim AS dev
WORKDIR /app

ENV EXPO_NO_TELEMETRY=1

# Dependencies first, so this layer is cached until package*.json changes
COPY package*.json ./
RUN npm ci

COPY . .

# Metro (JS bundle + dev tools)
EXPOSE 8081

# Overridden by docker-compose (`command:`), where the flags come from EXPO_START_FLAGS
CMD ["npx", "expo", "start", "--lan"]
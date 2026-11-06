/**
 * Every backend call goes through the API gateway (infra/gateway/nginx.conf):
 *   <EXPO_PUBLIC_API_URL>/<service>/<route of that service>
 *
 * EXPO_PUBLIC_API_URL is set in the root .env and passed to the container by docker-compose:
 *   physical phone     http://<your computer's LAN IP>:8080/api
 *   Android emulator   http://10.0.2.2:8080/api
 *   iOS simulator      http://localhost:8080/api
 *
 * Expo inlines EXPO_PUBLIC_* values when Metro builds the bundle. After changing the value,
 * restart with a clean cache:  docker-compose run --rm frontend npx expo start -c   (or restart the container).
 */
const BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

if (!BASE) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. Define it in the root .env file (see .env.example).",
  );
}

export const API = {
  user: `${BASE}/user`,
  cgm: `${BASE}/cgm`,
  medication: `${BASE}/medication`,
  recommender: `${BASE}/recommender`,
} as const;

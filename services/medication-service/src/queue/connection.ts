import type { ConnectionOptions } from "bullmq";
import { REDIS_URL } from "../config";

/** Parses redis://[:password@]host[:port][/db] into BullMQ connection options. */
export function parseRedisUrl(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
  };
}

export const connection: ConnectionOptions = parseRedisUrl(REDIS_URL);

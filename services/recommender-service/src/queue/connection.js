/** @typedef {import("bullmq").ConnectionOptions} ConnectionOptions */

/**
 * Parses redis://[:password@]host[:port][/db] into BullMQ connection options.
 * @param {string} url
 * @returns {ConnectionOptions}
 */
function parseRedisUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
  };
}

const connection = parseRedisUrl(process.env.REDIS_URL || "redis://redis:6379");

module.exports = { connection, parseRedisUrl };

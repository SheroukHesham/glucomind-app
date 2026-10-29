const { Worker } = require("bullmq");
const { connection } = require("../queue/connection");
const {
  MEAL_QUEUE,
  JOB_GENERATE,
  JOB_RECONCILE,
  reconcileMealSchedules,
} = require("./queue");
const { generateMealPlan } = require("./generator");

// The LLM is the bottleneck: keep this at 1 (or the number of GPUs/model slots you can really run in parallel).
const CONCURRENCY = Number(process.env.MEAL_WORKER_CONCURRENCY || 1);

/**
 * @param {import("bullmq").Job} job
 * @returns {Promise<string>}
 */
async function processJob(job) {
  switch (job.name) {
    case JOB_GENERATE:
      return generateMealPlan(job.data.userId);
    case JOB_RECONCILE:
      return JSON.stringify(await reconcileMealSchedules());
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

function startMealWorker() {
  const worker = new Worker(MEAL_QUEUE, processJob, {
    connection,
    concurrency: CONCURRENCY,
  });
  worker.on("completed", (job, result) =>
    console.log(`[meal] job ${job.id}: ${result}`),
  );
  worker.on("failed", (job, err) =>
    console.error(
      `[meal] job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
      err.message,
    ),
  );
  worker.on("error", (err) => console.error("[meal] worker error:", err));
  return worker;
}

module.exports = { startMealWorker, processJob };

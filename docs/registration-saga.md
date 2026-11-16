# Registration saga

One request from the app registers the user in three services. Either all three keep their data or none does.

```
App ── POST /register (Idempotency-Key) ──► user-service  (orchestrator)
                                             1. saves the saga            (its memory)
                                             2. saves the user as PENDING (cannot log in)
                                             3. sends CREATE to both participants
        registration.medication.command ──► medication-service  saves medications + reminders
        registration.diet.command       ──► recommender-service saves diet profile + 3:00 AM meal schedule
        registration.result             ◄── each one answers ok / failed
                                             all ok  -> user ACTIVE, saga COMPLETED, "registration.completed" event
                                             any failed -> user deleted, ROLLBACK to BOTH, saga FAILED once both confirmed
App ◄── 201 COMPLETED | 202 PENDING (poll GET /register/:id) | 409 / 422 FAILED (nothing is saved anywhere)
```

## States

| Saga status    | Meaning                                         | The client sees             |
| -------------- | ----------------------------------------------- | --------------------------- |
| `PENDING`      | commands sent, waiting for the answers          | `PENDING`                   |
| `COMPENSATING` | something failed, rollbacks are being confirmed | `PENDING` (not final yet)   |
| `COMPLETED`    | all steps done, user is ACTIVE                  | `COMPLETED` + `userId`      |
| `FAILED`       | everything is rolled back                       | `FAILED` + `error` + `code` |

Step status: `PENDING -> DONE`, or `FAILED`, and finally `COMPENSATED` after a rollback.
`FAILED` is reported only after every participant confirmed its rollback, so a "failed" answer always
means "nothing is saved" and the same email can be used again immediately.

Error codes: `EMAIL_TAKEN` (409), `STEP_FAILED`, `TIMEOUT`, `INTERRUPTED` (422).

## What happens when ... (all of these are tested)

| Situation                                           | Result                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| a participant refuses the data (invalid time)       | rollback of everyone, `STEP_FAILED` with a message for the user                                            |
| a participant crashes / Redis is down while saving  | same: the step fails, everything that was saved is removed                                                 |
| a participant is down                               | after `REGISTRATION_TIMEOUT_MS` the saga rolls back; the participant receives the ROLLBACK when it returns |
| a command or a result is lost                       | the sweeper resends the commands; participants answer again without duplicating data                       |
| Kafka delivers a message twice                      | every handler is idempotent: no duplicate data                                                             |
| a ROLLBACK arrives before a delayed CREATE          | the tombstone makes the late CREATE refuse                                                                 |
| a rollback fails (Redis down)                       | it is reported as failed and retried until it succeeds                                                     |
| user-service crashes half way                       | the saga document tells the sweeper exactly where to continue                                              |
| the same request is sent twice / double tap         | same `Idempotency-Key` -> same registration, no second account                                             |
| two people register the same email at the same time | one wins (409 for the other); the loser never reaches a participant                                        |

## Rules every step must follow

1. **Idempotent CREATE**: running it twice leaves exactly the data of running it once (upserts with a natural key).
2. **Idempotent ROLLBACK that also works if CREATE never ran**: delete by `registrationId`, never assume the data exists.
3. **Tombstone first in ROLLBACK**: a late CREATE of a cancelled registration is refused.
4. **Validate before writing anything**, so a bad slice fails without side effects.
5. **Always answer** (ok or failed) with a message that is safe to show to the user.
6. Side effects outside the database (Redis schedules) are part of CREATE **and** of ROLLBACK.

## Adding a participant (for example the emergency-service)

1. `libs/event-contracts/registration.ts`: add the name to `REGISTRATION_STEPS`, its topic to `COMMAND_TOPIC`,
   its slice type, and add the entry to `StepPayloads`. Add the topic to `topics.ts` and to `infra/kafka/create-topics.sh`
   (`registration.emergency.command` is already there). Run `scripts/sync-contracts.sh`.
2. `user-service/src/registration/registration.service.ts`: put the slice into `payloads` in `start()`.
   The saga model, the sweeper and `finalizeCompensation` are built from `REGISTRATION_STEPS` and need no change.
3. In the new service: a participant with `validate`, `create` and `rollback` (copy `medication-service/src/registration/participant.ts`),
   a tombstone model, a consumer on the command topic and a producer for `registration.result`
   (copy `kafka/registrationConsumer.ts` and `kafka/producers.ts`).
4. Add the new consumer group to `world.ts` in `tests/registration-saga` and copy a few scenarios.

**Before you do this for the emergency service:** a step inside the saga makes registration depend on that service being up.
The emergency service must stay available and independent, so it is better NOT a step. Save the emergency contacts after the
registration, from the `registration.completed` event (the recommender-service already does this for the first meal plan):
a failed save is then retried later and never blocks or rolls back the sign-up.

## Building another saga yourself

1. **List the steps and decide which can be undone.** For each: its owner service, what it saves, what undoes it.
   Put the step that is hardest to undo (an email sent, money moved) LAST, or run it only after completion.
2. **Define the contract first**: topics, a command (`CREATE`/`ROLLBACK` + `sagaId` + payload), a result, the saga/step states.
3. **Give the orchestrator a memory**: one document per saga with its id (the client's idempotency key), the status of every
   step, the payloads and timestamps. All state changes are conditional updates ("only if the status is still PENDING").
4. **Make the first local step reversible and invisible**: create the main record as `PENDING` so nobody can use it yet
   (a "semantic lock"), and activate it on success.
5. **Save the saga before publishing anything.** If the process dies in between, the saga document is still there.
6. **Fail fast and roll back everyone**, including the step that failed and the steps that never answered.
7. **Finish only when the rollbacks are confirmed.**
8. **Write the sweeper**: resend unacknowledged commands, roll back after a timeout, finish sagas whose steps are all done,
   re-publish events that did not reach Kafka. It is the safety net for everything that can be lost.
9. **Expose it as an async API**: idempotency key in, `201` / `202` / `4xx` out, a status endpoint to poll.
10. **Test failures, not only success**: fakes for the database and the broker with switches for lost / duplicated / delayed
    messages, a crashing participant and a crashing orchestrator. Then break the code on purpose and check a test fails.

## Operating it

Inspect (collection name of the `RegistrationSaga` model):

    db.registrationsagas.find({ status: { $in: ["PENDING", "COMPENSATING"] } })

A saga that stays `COMPENSATING` for a long time prints `ALERT: rollback ... is stuck`: a participant cannot undo its work
(check its logs). Settings (all optional): `REGISTRATION_WAIT_MS` (how long POST waits, default 8000),
`REGISTRATION_TIMEOUT_MS` (default 60000), `REGISTRATION_RESEND_AFTER_MS` (default 10000).
Finished sagas are deleted after 30 days.

## Known limits

- Verified on in-memory fakes of MongoDB and Kafka, not against the real ones. Run one registration end to end in Docker
  and one with a deliberately invalid medication time before relying on it.
- The `emergencyContacts` of the form are accepted but not saved anywhere yet (no participant owns them).
- The registration wizard has no medications step yet; the backend already accepts a `medications` list.
- Several user-service instances are safe by design (conditional updates, idempotent steps) but this was not load tested.

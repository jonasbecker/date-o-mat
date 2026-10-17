// Emptying the test database between suites. The app server of the previous suite can
// still be busy in the background (after(): deck refill, event reading) and hold locks –
// TRUNCATE then deadlocks now and then. Wait a moment and try again.

const RETRYABLE = new Set(["40P01", "55P03"]); // deadlock_detected, lock_not_available

export async function resetDb(db, tables) {
  for (let attempt = 1; ; attempt++) {
    try {
      await db.query(`TRUNCATE ${tables} CASCADE`);
      return;
    } catch (error) {
      if (!RETRYABLE.has(error.code) || attempt >= 6) throw error;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

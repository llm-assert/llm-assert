import type { Clock } from "../../src/judge/client.js";

/**
 * Fake clock for deterministic testing of time-dependent logic.
 * Sleep calls resolve immediately (advancing internal time by the requested duration).
 * Use `now()` to inspect the current fake time.
 */
export class FakeClock implements Clock {
  private currentTime: number;

  constructor(startTime: number = 0) {
    this.currentTime = startTime;
  }

  now(): number {
    return this.currentTime;
  }

  async sleep(ms: number): Promise<void> {
    // Advance time by the sleep duration and resolve immediately
    this.currentTime += ms;
  }

  /** Manually advance time without a sleep (for token bucket refill testing) */
  advance(ms: number): void {
    this.currentTime += ms;
  }
}

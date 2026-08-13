import { test } from "node:test";
import assert from "node:assert/strict";

import {
  currentSky,
  moonPhase,
  nextLunarEvents,
  LUNAR_EVENTS_VERSION,
} from "../src/index.js";

const FIXED_INSTANT = new Date("2026-07-28T04:30:00.000Z");

function circularDistance(actual, target) {
  const delta = Math.abs(actual - target) % 360;
  return Math.min(delta, 360 - delta);
}

test("waxing and waning follow elongation, including the full-moon phase bucket", () => {
  const beforeExactFull = moonPhase(0, 170);
  assert.equal(beforeExactFull.phase_name, "Full Moon");
  assert.equal(beforeExactFull.waxing, true);
  assert.equal(beforeExactFull.waning, false);

  const afterExactFull = moonPhase(0, 190);
  assert.equal(afterExactFull.phase_name, "Full Moon");
  assert.equal(afterExactFull.waxing, false);
  assert.equal(afterExactFull.waning, true);
});

test("moonPhase accepts a single instant and matches the two-longitude form", () => {
  // Regression: 2026-08-12, just past new moon. Calling moonPhase(date) used to
  // run Date - undefined through the longitude arithmetic, producing NaN
  // elongation/illumination (null once serialised) with waxing stuck false.
  const justPastNew = new Date("2026-08-12T18:00:00.000Z");
  const fromInstant = moonPhase(justPastNew);

  assert.ok(Number.isFinite(fromInstant.elongation));
  assert.ok(Number.isFinite(fromInstant.illumination_percent));
  assert.equal(fromInstant.phase_name, "New Moon");
  assert.equal(fromInstant.waxing, true);
  assert.equal(fromInstant.waning, false);
  assert.ok(
    circularDistance(fromInstant.elongation, 0) < 1,
    `expected near-zero elongation just past new moon, got ${fromInstant.elongation}°`,
  );

  const sky = currentSky(justPastNew);
  assert.deepEqual(
    fromInstant,
    moonPhase(sky.sun.longitude, sky.moon.longitude),
  );
});

test("moonPhase rejects invalid input instead of returning NaN flags", () => {
  const isInvalidInput = (error) =>
    error instanceof TypeError && error.code === "invalid_input";
  assert.throws(() => moonPhase(new Date("not-a-date")), isInvalidInput);
  assert.throws(() => moonPhase(Number.NaN, 100), isInvalidInput);
  assert.throws(() => moonPhase(0, Number.NaN), isInvalidInput);
});

test("current sky exposes a stable lunar phase fraction from engine positions", () => {
  const sky = currentSky(FIXED_INSTANT);
  assert.ok(sky.moon.phase_fraction >= 0 && sky.moon.phase_fraction < 1);
  assert.equal(
    sky.moon.phase_fraction,
    Math.round((sky.moon.elongation_degrees / 360) * 1_000_000) / 1_000_000,
  );
  assert.equal(sky.moon.waxing, sky.moon.elongation_degrees < 180);
  assert.equal(sky.moon.waning, !sky.moon.waxing);
});

test("next lunar events are deterministic Swiss Ephemeris crossings", () => {
  const first = nextLunarEvents(FIXED_INSTANT);
  const second = nextLunarEvents(FIXED_INSTANT);
  assert.deepEqual(first, second);
  assert.equal(first.events_version, LUNAR_EVENTS_VERSION);

  const fullAt = new Date(first.full_moon.instant_utc);
  const newAt = new Date(first.new_moon.instant_utc);
  assert.ok(fullAt > FIXED_INSTANT);
  assert.ok(newAt > FIXED_INSTANT);

  const fullSky = currentSky(fullAt);
  const newSky = currentSky(newAt);
  assert.ok(
    circularDistance(fullSky.moon.elongation_degrees, 180) < 0.02,
    `full-moon crossing drifted to ${fullSky.moon.elongation_degrees}°`,
  );
  assert.ok(
    circularDistance(newSky.moon.elongation_degrees, 0) < 0.02,
    `new-moon crossing drifted to ${newSky.moon.elongation_degrees}°`,
  );
});

test("independent requests in one lunation return identical public event instants", () => {
  const earlier = nextLunarEvents(new Date("2026-07-27T18:00:00.000Z"));
  const later = nextLunarEvents(new Date("2026-07-28T04:30:00.000Z"));

  assert.equal(earlier.full_moon.instant_utc, later.full_moon.instant_utc);
  assert.equal(earlier.new_moon.instant_utc, later.new_moon.instant_utc);
  assert.match(earlier.full_moon.instant_utc, /:\d{2}\.000Z$/);
  assert.match(earlier.new_moon.instant_utc, /:\d{2}\.000Z$/);
});

test("next lunar events reject an invalid instant", () => {
  assert.throws(
    () => nextLunarEvents(new Date("not-a-date")),
    (error) => error instanceof TypeError && error.code === "invalid_input",
  );
});

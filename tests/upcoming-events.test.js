import { test } from "node:test";
import assert from "node:assert/strict";

import {
  nextStations,
  nextIngresses,
  positionsNow,
  UPCOMING_EVENTS_VERSION,
  STATION_BODIES,
} from "../src/index.js";

const FIXED_INSTANT = "2026-08-13T00:00:00.000Z";

test("stations are deterministic ephemeris crossings where speed changes sign", () => {
  const first = nextStations(FIXED_INSTANT, { bodies: ["Mercury"] });
  const second = nextStations(FIXED_INSTANT, { bodies: ["Mercury"] });
  assert.deepEqual(first, second);
  assert.equal(first.events_version, UPCOMING_EVENTS_VERSION);
  assert.equal(first.stations.length, 1);

  const station = first.stations[0];
  assert.equal(station.body, "Mercury");
  assert.ok(new Date(station.instant_utc) > new Date(FIXED_INSTANT));
  assert.match(station.instant_utc, /:\d{2}\.000Z$/);

  const hourMs = 3_600_000;
  const before = positionsNow(new Date(new Date(station.instant_utc).getTime() - hourMs)).planets.Mercury;
  const after = positionsNow(new Date(new Date(station.instant_utc).getTime() + hourMs)).planets.Mercury;
  assert.notEqual(before.speed < 0, after.speed < 0, "speed must change sign across the station");
  const expectedAfterRetro = station.kind === "station_retrograde";
  assert.equal(after.speed < 0, expectedAfterRetro, "kind must match post-station motion");
});

test("every station body yields a station within the default horizon", () => {
  const { stations } = nextStations(FIXED_INSTANT);
  assert.deepEqual(
    [...new Set(stations.map((s) => s.body))].sort(),
    [...STATION_BODIES].sort(),
  );
  const instants = stations.map((s) => s.instant_utc);
  assert.deepEqual(instants, [...instants].sort(), "stations sorted chronologically");
});

test("stations reject bodies that never station", () => {
  assert.throws(
    () => nextStations(FIXED_INSTANT, { bodies: ["Sun"] }),
    (error) => error instanceof TypeError && error.code === "invalid_input",
  );
});

test("ingresses land on an exact sign boundary", () => {
  const { ingresses } = nextIngresses(FIXED_INSTANT, { bodies: ["Sun", "Moon"] });
  assert.equal(ingresses.length, 2);
  for (const ingress of ingresses) {
    const at = positionsNow(new Date(ingress.instant_utc)).planets[ingress.body];
    const offset = at.longitude % 30;
    const distance = Math.min(offset, 30 - offset);
    assert.ok(distance < 0.001, `${ingress.body} ingress off boundary by ${distance}°`);
    assert.equal(at.sign, ingress.to_sign);
  }
  const moon = ingresses.find((i) => i.body === "Moon");
  const sun = ingresses.find((i) => i.body === "Sun");
  const days = (iso) => (new Date(iso) - new Date(FIXED_INSTANT)) / 86_400_000;
  assert.ok(days(moon.instant_utc) < 3, "Moon changes sign within ~2.5 days");
  assert.ok(days(sun.instant_utc) < 32, "Sun changes sign within a month");
});

test("ingresses omit bodies whose next crossing is beyond the horizon", () => {
  const { ingresses, horizon_days } = nextIngresses(FIXED_INSTANT, {
    bodies: ["Moon", "Pluto"],
    horizonDays: 30,
  });
  assert.equal(horizon_days, 30);
  assert.deepEqual(ingresses.map((i) => i.body), ["Moon"]);
});

test("upcoming events reject an invalid instant", () => {
  const isInvalidInput = (error) => error instanceof TypeError && error.code === "invalid_input";
  assert.throws(() => nextStations("not-a-date"), isInvalidInput);
  assert.throws(() => nextIngresses("not-a-date"), isInvalidInput);
});

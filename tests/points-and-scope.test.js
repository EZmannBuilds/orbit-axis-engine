import { test } from "node:test";
import assert from "node:assert/strict";

import {
  positionsNow,
  currentSky,
  computeNatalChart,
  personalTransits,
  skySnapshotHash,
  PLANETS,
  POINTS,
} from "../src/index.js";

const INSTANT = "2026-08-13T12:00:00.000Z";

// Time and place are a fixed example, not anyone's chart.
const PROFILE = {
  birth_date: "1990-06-15",
  birth_time: "12:00",
  time_accuracy: "exact",
  latitude: 40.7128,
  longitude: -74.006,
  utc_offset_at_birth: "-04:00",
  house_system: "placidus",
};

test("Chiron and Lilith are computed as points, not planets", () => {
  const pos = positionsNow(new Date(INSTANT));
  assert.deepEqual(Object.keys(pos.points).sort(), [...POINTS].sort());
  for (const name of POINTS) {
    assert.ok(Number.isFinite(pos.points[name].longitude), `${name} longitude`);
    assert.ok(pos.points[name].sign, `${name} sign`);
  }
  // The planet set must be untouched — it feeds aspects and element balance.
  assert.equal(Object.keys(pos.planets).length, PLANETS.length);
  for (const name of POINTS) assert.equal(pos.planets[name], undefined);
});

test("the two Liliths differ, so neither can silently stand for the other", () => {
  const { points } = positionsNow(new Date(INSTANT));
  const gap = Math.abs(points.Lilith.longitude - points.TrueLilith.longitude);
  assert.ok(gap > 0.5, `mean and osculating apogee should differ, got ${gap}°`);
});

test("adding points did not change what seeds a daily fortune", () => {
  const sky = currentSky(INSTANT);
  const before = skySnapshotHash(sky);
  // A point moving (or appearing) must not disturb the hash: it is derived
  // from season, moon sign, phase, and retrogrades only.
  const mutated = { ...sky, points: { ...sky.points, Chiron: { longitude: 0, sign: "Aries" } } };
  assert.equal(skySnapshotHash(mutated), before);
  assert.equal(sky.snapshot_hash, before);
});

test("natal charts carry points and their houses without touching planet_houses", () => {
  const chart = computeNatalChart(PROFILE);
  for (const name of POINTS) {
    assert.ok(chart.points[name], `${name} present`);
    assert.ok(chart.point_houses[name] >= 1 && chart.point_houses[name] <= 12, `${name} house`);
  }
  assert.deepEqual(
    Object.keys(chart.planet_houses).sort(),
    [...PLANETS].sort(),
    "planet_houses must still hold exactly the ten planets",
  );
});

test("a chart with no birth time has points but no point houses", () => {
  const chart = computeNatalChart({ ...PROFILE, time_accuracy: "unknown", birth_time: undefined });
  assert.ok(chart.points.Chiron, "points do not need a birth time");
  assert.deepEqual(chart.point_houses, {}, "houses do");
});

test("transits reach the outer planets, Chiron, the nodes, and the angles", () => {
  const chart = computeNatalChart(PROFILE);
  const sky = currentSky(INSTANT);
  const transits = personalTransits(sky, chart, 8);

  const transiting = new Set(transits.map((t) => t.transiting));
  const targets = new Set(transits.map((t) => t.natal));
  // At an 8° orb across 15 targets, the slow bodies cannot all be absent
  // unless they are excluded by scope — which is the bug this guards.
  assert.ok(
    ["Uranus", "Neptune", "Pluto", "Chiron"].some((b) => transiting.has(b)),
    `expected an outer-planet or Chiron transit, saw ${[...transiting].join(", ")}`,
  );
  assert.ok(
    ["Ascendant", "MC", "North Node", "South Node", "Chiron"].some((t) => targets.has(t)),
    `expected an angle, node, or Chiron target, saw ${[...targets].join(", ")}`,
  );
  for (const t of transits) assert.ok(t.orb <= 8, "orb limit respected");
});

test("transit scope is caller-controlled and still accepts a bare planets object", () => {
  const chart = computeNatalChart(PROFILE);
  const sky = currentSky(INSTANT);

  const legacy = personalTransits(sky, chart, 3, {
    bodies: ["Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"],
    targets: ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"],
  });
  for (const t of legacy) {
    assert.ok(!["Uranus", "Neptune", "Pluto", "Chiron"].includes(t.transiting));
    assert.ok(!["Ascendant", "MC", "North Node"].includes(t.natal));
  }

  // The pre-points call shape: no points, no angles, no nodes.
  const bare = personalTransits({ planets: sky.planets }, { planets: chart.planets }, 3);
  assert.ok(Array.isArray(bare));
  for (const t of bare) assert.ok(sky.planets[t.transiting], "only planets resolve");
});

test("a single scoped pair produces at most one aspect", () => {
  const chart = computeNatalChart(PROFILE);
  const sky = currentSky(INSTANT);
  const transits = personalTransits(sky, chart, 10, { bodies: ["Saturn"], targets: ["Sun"] });
  assert.ok(transits.length <= 1, "tightest aspect per pair only");
});

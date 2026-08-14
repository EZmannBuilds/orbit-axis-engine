// Orbit Axis Engine :: parity with the pre-extraction implementation.
//
// This is the test that justifies the extraction. The engine was carved out of
// the Orbit Axis application, and the only acceptable outcome is that it
// produces *identical* numbers — not "close enough". The fixture here is the
// same file the application uses, generated before extraction on darwin-arm64
// and already verified byte-identical on linux-x64.
//
// If this suite passes in both repositories, the engine is a faithful
// replacement and the application can switch to it without changing a single
// user-visible reading.
//
// Tolerances match the application's: far looser than the observed difference
// (0.0° across 440 compared values) purely to absorb last-digit formatting.
// They must NOT be widened to make a failing test pass — a real drift means the
// binaries, data files, or flags genuinely differ, and that is a bug to find.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  positionsAtUT, PLANETS, computeNatalChart, currentSky,
  personalTransits, runtimeManifest, runtimeKey,
} from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(join(HERE, "fixtures", "calculation-parity.json"), "utf8"));

const TOL_LONGITUDE_DEG = 1e-6;   // 0.0036 arcsec
const TOL_SPEED_DEG_DAY = 1e-6;
const TOL_ILLUMINATION_PCT = 0.01;
const PLATFORM = runtimeKey();

const CASES = [
  { name: "normal_known_time",   year: 1990, month: 6,  day: 15, hour: 14, minute: 30, second: 0, lat: 41.8781,  lon: -87.6298,  withHouses: true },
  { name: "northern_high_lat",   year: 1985, month: 12, day: 21, hour: 6,  minute: 0,  second: 0, lat: 59.3293,  lon: 18.0686,   withHouses: true },
  { name: "southern_lat",        year: 1978, month: 3,  day: 3,  hour: 23, minute: 15, second: 0, lat: -33.8688, lon: 151.2093,  withHouses: true },
  { name: "eastern_lon",         year: 2001, month: 9,  day: 9,  hour: 8,  minute: 45, second: 0, lat: 35.6895,  lon: 139.6917,  withHouses: true },
  { name: "western_lon",         year: 2004, month: 2,  day: 28, hour: 19, minute: 5,  second: 0, lat: 37.7749,  lon: -122.4194, withHouses: true },
  { name: "day_boundary_before", year: 1999, month: 12, day: 31, hour: 23, minute: 59, second: 0, lat: 51.5072,  lon: 0.1276,    withHouses: true },
  { name: "day_boundary_after",  year: 2000, month: 1,  day: 1,  hour: 0,  minute: 1,  second: 0, lat: 51.5072,  lon: 0.1276,    withHouses: true },
  { name: "leap_day",            year: 2000, month: 2,  day: 29, hour: 12, minute: 0,  second: 0, lat: 48.8566,  lon: 2.3522,    withHouses: true },
  { name: "equator",             year: 1995, month: 6,  day: 1,  hour: 12, minute: 0,  second: 0, lat: 0,        lon: 0,         withHouses: true },
  { name: "far_past",            year: 1911, month: 11, day: 11, hour: 11, minute: 11, second: 0, lat: 52.5200,  lon: 13.4050,   withHouses: true },
  { name: "far_future",          year: 2040, month: 1,  day: 1,  hour: 0,  minute: 0,  second: 0, lat: 51.5074,  lon: -0.1278,   withHouses: true },
  { name: "no_houses",           year: 1988, month: 7,  day: 7,  hour: 12, minute: 0,  second: 0, lat: null,     lon: null,      withHouses: false },
];

function closeTo(actual, expected, tol, label) {
  const drift = Math.abs(actual - expected);
  assert.ok(drift <= tol,
    `${label}: ${actual} differs from the recorded ${expected} by ${drift.toExponential(3)}, beyond ${tol} (platform ${PLATFORM})`);
}

test("the fixture matches the Swiss Ephemeris version this engine ships", () => {
  assert.equal(FIXTURE.swissEphemerisVersion, runtimeManifest().swissEphemerisVersion,
    "a fixture from a different ephemeris version cannot prove parity");
});

for (const testCase of CASES) {
  test(`positions match the pre-extraction implementation: ${testCase.name}`, () => {
    const { name, ...input } = testCase;
    const expected = FIXTURE.positions[name];
    assert.ok(expected, `fixture is missing case ${name}`);
    const actual = positionsAtUT(input);

    for (const planet of PLANETS) {
      const e = expected.planets[planet];
      const a = actual.planets[planet];
      assert.ok(a, `${name}: ${planet} missing`);
      closeTo(a.longitude, e.longitude, TOL_LONGITUDE_DEG, `${name} ${planet} longitude`);
      closeTo(a.speed, e.speed, TOL_SPEED_DEG_DAY, `${name} ${planet} speed`);
      // Discrete values must match exactly — a tolerance here would let a real
      // sign-boundary error through.
      assert.equal(a.sign, e.sign, `${name} ${planet} sign`);
      assert.equal(a.degrees, e.degrees, `${name} ${planet} degree`);
      assert.equal(a.minutes, e.minutes, `${name} ${planet} minute`);
      assert.equal(a.retrograde, e.retrograde, `${name} ${planet} retrograde`);
    }

    assert.equal(actual.houses.length, expected.houses.length, `${name} house count`);
    for (const eh of expected.houses) {
      const ah = actual.houses.find((h) => h.house === eh.house);
      assert.ok(ah, `${name}: house ${eh.house} missing`);
      closeTo(ah.longitude, eh.longitude, TOL_LONGITUDE_DEG, `${name} house ${eh.house}`);
      assert.equal(ah.sign, eh.sign, `${name} house ${eh.house} sign`);
    }

    if (expected.ascendant) {
      closeTo(actual.ascendant.longitude, expected.ascendant.longitude, TOL_LONGITUDE_DEG, `${name} Ascendant`);
      closeTo(actual.midheaven.longitude, expected.midheaven.longitude, TOL_LONGITUDE_DEG, `${name} Midheaven`);
    } else {
      assert.equal(actual.ascendant, null, `${name} should have no Ascendant without houses`);
    }
  });
}

// ── domain layer ────────────────────────────────────────────────────────────

const PROFILE = {
  id: "00000000-0000-4000-8000-000000000001", nickname: "Parity Fixture",
  birth_date: "1990-06-15", birth_time: "14:30", time_accuracy: "exact",
  latitude: 41.8781, longitude: -87.6298, utc_offset_at_birth: "-05:00", house_system: "placidus",
};

test("natal chart matches the pre-extraction implementation", () => {
  const chart = computeNatalChart(PROFILE);
  const e = FIXTURE.natal;
  closeTo(chart.planets.Sun.longitude, e.sun, TOL_LONGITUDE_DEG, "natal Sun");
  closeTo(chart.planets.Moon.longitude, e.moon, TOL_LONGITUDE_DEG, "natal Moon");
  closeTo(chart.angles.ascendant.longitude, e.ascendant, TOL_LONGITUDE_DEG, "natal Ascendant");
  closeTo(chart.angles.midheaven.longitude, e.midheaven, TOL_LONGITUDE_DEG, "natal Midheaven");
  assert.equal(chart.houses.length, e.houseCount);
  assert.equal(chart.aspects.length, e.aspectCount, "aspect count");
  assert.deepEqual(chart.retrogrades, e.retrogrades);
  assert.deepEqual(chart.big_three, e.bigThree);
  assert.deepEqual(chart.element_balance, e.elementBalance);
  assert.deepEqual(chart.modality_balance, e.modalityBalance);
  assert.equal(chart.calculation_status, e.calculationStatus);
});

test("unknown birth time withholds houses and angles identically", () => {
  const chart = computeNatalChart({ ...PROFILE, birth_time: null, time_accuracy: "unknown" });
  const e = FIXTURE.natalUnknownTime;
  assert.equal(chart.time_known, e.timeKnown);
  assert.equal(chart.houses.length, e.houseCount, "no houses without a birth time");
  assert.equal(Boolean(chart.angles?.ascendant), e.hasAscendant, "no Ascendant without a birth time");
  assert.deepEqual(chart.warnings, e.warnings);
  closeTo(chart.planets.Sun.longitude, e.sun, TOL_LONGITUDE_DEG, "unknown-time Sun");
});

test("current sky matches at a fixed instant, including the snapshot hash", () => {
  const sky = currentSky(new Date(FIXTURE.instant));
  const e = FIXTURE.sky;
  closeTo(sky.planets.Sun.longitude, e.sun, TOL_LONGITUDE_DEG, "sky Sun");
  closeTo(sky.planets.Moon.longitude, e.moon, TOL_LONGITUDE_DEG, "sky Moon");
  assert.equal(sky.zodiac_season, e.zodiacSeason);
  assert.equal(sky.moon.sign, e.moonSign);
  assert.equal(sky.moon.phase_name, e.moonPhase);
  closeTo(sky.moon.illumination_percent, e.illumination, TOL_ILLUMINATION_PCT, "illumination");
  assert.deepEqual(sky.retrogrades, e.retrogrades);
  assert.equal(sky.aspects.length, e.aspectCount);
  // The snapshot hash seeds daily readings. If it drifted, the same user would
  // get a different reading from the engine than from the old code.
  assert.equal(sky.snapshot_hash, e.snapshotHash, "snapshot hash must be stable across the extraction");
});

// The scope the pre-extraction application used. The fixture records the
// transits THAT list produces, so parity is asserted against it explicitly
// rather than against whatever the current defaults happen to be. Parity is a
// claim about the numbers being identical, not a freeze on which bodies the
// engine is willing to look at; the defaults have since grown to include the
// outer planets, Chiron, the nodes, and the angles.
const LEGACY_SCOPE = {
  bodies: ["Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"],
  targets: ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"],
};

test("transits match, including applying and separating classification", () => {
  const chart = computeNatalChart(PROFILE);
  const sky = currentSky(new Date(FIXTURE.instant));
  const actual = personalTransits(sky, chart, 3, LEGACY_SCOPE);
  assert.equal(actual.length, FIXTURE.transits.length, "transit count");
  for (const [i, e] of FIXTURE.transits.entries()) {
    const a = actual[i];
    assert.equal(a.transiting, e.transiting, `transit ${i} transiting body`);
    assert.equal(a.natal, e.natal, `transit ${i} natal body`);
    assert.equal(a.aspect, e.aspect, `transit ${i} aspect`);
    closeTo(a.orb, e.orb, TOL_LONGITUDE_DEG, `transit ${i} orb`);
    assert.equal(a.applying, e.applying, `transit ${i} applying/separating`);
  }
});

test("determinism: the same input twice gives the same object", () => {
  const a = computeNatalChart(PROFILE);
  const b = computeNatalChart(PROFILE);
  assert.deepEqual(a.planets, b.planets);
  assert.deepEqual(a.houses, b.houses);
  assert.deepEqual(a.aspects, b.aspects);
});

// ── regression: scoped-package installation paths ───────────────────────────
// Update 5.0. Publishing the engine as `@ezmannbuilds/orbit-axis-engine` put an
// "@" into the resolved ephemeris path. The argument allow-list rejected it, so
// EVERY calculation failed once the engine was installed as a package — while
// every unit test still passed, because the tests run from a plain checkout
// where no "@" appears. Only executing the built Vercel artefact revealed it.

test("an ephemeris path inside a scoped npm package is accepted", async () => {
  const { assertSafeArgs } = await import("../src/adapters/swiss-ephemeris/exec.js");
  assert.doesNotThrow(() => assertSafeArgs([
    "-edir/var/task/node_modules/@ezmannbuilds/orbit-axis-engine/ephemeris",
  ]), "a scoped package path must not be mistaken for a malformed argument");
});

test("widening the allow-list did not open a shell-injection hole", async () => {
  const { assertSafeArgs } = await import("../src/adapters/swiss-ephemeris/exec.js");
  const injections = [
    "-edir/x;rm -rf /", "-edir/x|cat", "-edir/x$(id)", "-edir/x&y",
    "-edir/x>out", "-edir/x<in", "-edir/x'y", '-edir/x"y',
    `-edir/x${String.fromCharCode(10)}y`, `-edir/x${String.fromCharCode(0)}`,
  ];
  for (const arg of injections) {
    assert.throws(() => assertSafeArgs([arg]), `${JSON.stringify(arg)} must still be rejected`);
  }
});

test("the resolved ephemeris directory is itself an acceptable argument", async () => {
  // The end-to-end version of the bug: whatever path resolution produces must
  // survive validation, wherever the engine happens to be installed.
  const { assertSafeArgs } = await import("../src/adapters/swiss-ephemeris/exec.js");
  const { resolveRuntime } = await import("../src/adapters/swiss-ephemeris/paths.js");
  const rt = resolveRuntime();
  assert.doesNotThrow(() => assertSafeArgs([`-edir${rt.ephemerisDir}`]),
    `the real ephemeris path must be a valid argument: ${rt.ephemerisDir}`);
});

// ── synastry (new in Update 5.0) ────────────────────────────────────────────
// Not an extraction: the application had a synastry placeholder in its UI and
// no calculation behind it. These tests pin the new behaviour so it can be
// changed deliberately rather than accidentally.

test("synastry finds aspects between two different charts", async () => {
  const { computeSynastryAspects } = await import("../src/domain/synastry.js");
  const a = computeNatalChart(PROFILE);
  const b = computeNatalChart({ ...PROFILE, birth_date: "1986-11-02", birth_time: "07:15" });
  const aspects = computeSynastryAspects(a, b);
  assert.ok(aspects.length > 0, "two real charts should share at least one aspect");
  for (const asp of aspects) {
    assert.ok(["conjunction", "sextile", "square", "trine", "opposition"].includes(asp.aspect));
    assert.ok(["easy", "challenging", "intense"].includes(asp.quality));
    assert.ok(asp.orb >= 0 && asp.orb <= 9, `orb ${asp.orb} should be within the widest allowance`);
  }
  // Sorted tightest first.
  const orbs = aspects.map((x) => x.orb);
  assert.deepEqual(orbs, [...orbs].sort((x, y) => x - y));
});

test("synastry compares same-named bodies across charts", async () => {
  const { computeSynastryAspects } = await import("../src/domain/synastry.js");
  // Two identical charts: every body is exactly conjunct its counterpart.
  const a = computeNatalChart(PROFILE);
  const aspects = computeSynastryAspects(a, a);
  const sunSun = aspects.find((x) => x.personA === "Sun" && x.personB === "Sun");
  assert.ok(sunSun, "A's Sun to B's Sun is a real synastry contact and must be reported");
  assert.equal(sunSun.aspect, "conjunction");
  assert.equal(sunSun.orb, 0);
});

test("synastry is deterministic and order-sensitive in the documented way", async () => {
  const { computeSynastryAspects } = await import("../src/domain/synastry.js");
  const a = computeNatalChart(PROFILE);
  const b = computeNatalChart({ ...PROFILE, birth_date: "1986-11-02", birth_time: "07:15" });
  assert.deepEqual(computeSynastryAspects(a, b), computeSynastryAspects(a, b), "must be deterministic");
  // Swapping charts swaps the roles, so personA/personB invert.
  const swapped = computeSynastryAspects(b, a);
  assert.equal(swapped.length, computeSynastryAspects(a, b).length);
});

test("synastry summary counts without claiming compatibility", async () => {
  const { computeSynastryAspects, summariseSynastry } = await import("../src/domain/synastry.js");
  const a = computeNatalChart(PROFILE);
  const b = computeNatalChart({ ...PROFILE, birth_date: "1986-11-02", birth_time: "07:15" });
  const s = summariseSynastry(computeSynastryAspects(a, b));
  assert.equal(s.total, s.easy + s.challenging + s.intense, "every aspect is counted exactly once");
  assert.ok(s.tightest, "a summary should name the tightest contact");
  // Deliberately absent: any score, percentage, or verdict.
  assert.ok(!("score" in s) && !("compatibility" in s) && !("rating" in s),
    "the engine must not score compatibility — that is interpretation, not astronomy");
});

test("synastry tolerates a chart with missing planets", async () => {
  const { computeSynastryAspects } = await import("../src/domain/synastry.js");
  assert.deepEqual(computeSynastryAspects({ planets: {} }, computeNatalChart(PROFILE)), []);
  assert.deepEqual(computeSynastryAspects(null, null), []);
});

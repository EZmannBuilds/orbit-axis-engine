import { test } from "node:test";
import assert from "node:assert/strict";

import { zoneOffsetMinutes, computeNatalChart, chartInputHash } from "../src/index.js";

test("offsets come from the zone's history, not from the current rules", () => {
  const cases = [
    // [zone, local wall time, expected minutes east, why it is here]
    ["America/Chicago", { year: 2005, month: 7, day: 9, hour: 1, minute: 57 }, -300, "CDT"],
    ["America/Chicago", { year: 2005, month: 1, day: 9, hour: 1, minute: 57 }, -360, "CST"],
    ["Europe/London", { year: 1990, month: 6, day: 15, hour: 12 }, 60, "BST"],
    ["Europe/London", { year: 1990, month: 1, day: 15, hour: 12 }, 0, "GMT"],
    ["Asia/Kolkata", { year: 2000, month: 1, day: 1, hour: 12 }, 330, "half-hour zone"],
    ["Asia/Kathmandu", { year: 2000, month: 1, day: 1, hour: 12 }, 345, "45-minute zone"],
    ["Australia/Adelaide", { year: 2000, month: 1, day: 1, hour: 12 }, 630, "southern DST"],
    ["UTC", { year: 2020, month: 6, day: 1, hour: 0 }, 0, "UTC"],
  ];
  for (const [zone, local, expected, why] of cases) {
    assert.equal(zoneOffsetMinutes(zone, local), expected, `${zone} (${why})`);
  }
});

test("daylight-saving edges resolve the documented way", () => {
  // 2:30am on a spring-forward date never happens; the offset standing before
  // the jump is returned rather than a guess.
  assert.equal(
    zoneOffsetMinutes("America/Chicago", { year: 2005, month: 4, day: 3, hour: 2, minute: 30 }),
    -360,
  );
  // 1:30am on a fall-back date happens twice; the earlier reading wins.
  assert.equal(
    zoneOffsetMinutes("America/Chicago", { year: 2005, month: 10, day: 30, hour: 1, minute: 30 }),
    -300,
  );
});

test("an unknown zone is refused rather than silently treated as UTC", () => {
  assert.throws(
    () => zoneOffsetMinutes("Not/AZone", { year: 2000, month: 1, day: 1 }),
    (error) => error instanceof TypeError && error.code === "invalid_input",
  );
});

const BASE = {
  birth_date: "1990-06-15",
  birth_time: "01:57",
  time_accuracy: "exact",
  latitude: 41.8781,
  longitude: -87.6298,
  house_system: "placidus",
};

test("a named zone produces the same chart as the offset it implies", () => {
  const byZone = computeNatalChart({ ...BASE, timezone_name: "America/Chicago" });
  const byOffset = computeNatalChart({ ...BASE, utc_offset_at_birth: "-05:00" });
  assert.deepEqual(byZone.planets, byOffset.planets);
  assert.equal(byZone.angles.ascendant.longitude, byOffset.angles.ascendant.longitude);
  assert.ok(!byZone.warnings.includes("utc_offset_assumed"));
});

test("an explicit offset still wins, so existing charts cannot move", () => {
  // Deliberately contradictory: the zone says -05:00 in June, the caller says
  // UTC. The caller's assertion is honoured.
  const chart = computeNatalChart({
    ...BASE,
    timezone_name: "America/Chicago",
    utc_offset_at_birth: "+00:00",
  });
  const asUtc = computeNatalChart({ ...BASE, utc_offset_at_birth: "+00:00" });
  assert.equal(chart.angles.ascendant.longitude, asUtc.angles.ascendant.longitude);
});

test("supplying neither is reported, because it moves every angle", () => {
  const chart = computeNatalChart(BASE);
  assert.ok(chart.warnings.includes("utc_offset_assumed"));
  const zoned = computeNatalChart({ ...BASE, timezone_name: "America/Chicago" });
  assert.notEqual(chart.angles.ascendant.sign, zoned.angles.ascendant.sign);
});

test("the input hash still separates charts that differ only by zone", () => {
  const a = chartInputHash({ ...BASE, timezone_name: "America/Chicago" });
  const b = chartInputHash({ ...BASE, timezone_name: "Europe/London" });
  assert.notEqual(a, b);
});

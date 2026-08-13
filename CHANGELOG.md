# Changelog

All notable changes to Orbit Axis Engine are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Before 1.0.0, minor versions may contain breaking changes. The response
`contractVersion` is versioned separately and independently.

## [0.2.0] — 2026-08-13

### Added

- `nextStations(date?, { bodies, horizonDays })` — the next retrograde or
  direct station per planet, located by bisecting real ephemeris speed
  sign-changes, sorted chronologically. Default horizon 800 days (covers the
  longest inter-station wait, Mars).
- `nextIngresses(date?, { bodies, horizonDays })` — the next sign ingress per
  body within the horizon (default 400 days); a retrograde body re-entering
  the previous sign counts. Slow outer planets beyond the horizon are omitted
  rather than guessed.
- `STATION_BODIES`, `INGRESS_BODIES`, `UPCOMING_EVENTS_VERSION` constants;
  TypeScript declarations and README rows for all of the above.
- Playground: natal chart wheel (SVG — zodiac band, house cusps, natal
  planets, tight-orb aspect lines, transit markers on the rim), an
  "Upcoming — stations & ingresses" card, and a `/api/upcoming` endpoint.

### Fixed

- Playground: element/modality balance meters rendered zero-width fills;
  oversized request bodies now get a 400 instead of a dropped connection.

## [0.1.1] — 2026-08-13

### Added

- `README` API section documenting the public surface.
- TypeScript declarations (`src/index.d.ts`), wired through `types` and the
  `exports` map.
- `npm run ui` — a zero-dependency local playground (`ui/`) serving current
  sky, moon phase, natal chart, transits, and lunar events on
  `http://localhost:4747`. Localhost only; nothing is stored or sent anywhere.

### Fixed

- `moonPhase` now accepts a single instant (`moonPhase(date)`, defaulting to
  now) and derives both longitudes from the ephemeris. Previously a lone Date
  fell through the two-longitude arithmetic and returned NaN elongation and
  illumination (serialised as `null`) with `waxing` stuck `false`.
- `moonPhase` throws a `TypeError` with `code: "invalid_input"` on an invalid
  instant or non-finite longitudes instead of returning NaN-poisoned flags,
  matching the `nextLunarEvents` convention.
- `currentSky` validates its instant up front: an invalid date now throws
  `TypeError` `code: "invalid_input"` naming `currentSky`, instead of leaking
  the adapter's "Birth year must be a whole number". ISO-string instants are
  accepted, matching `moonPhase` and `nextLunarEvents`.

## [0.1.0] — 2026-07-20

Initial extraction from the Orbit Axis application (Update 5.0).

### Added

- Deterministic natal chart calculation: planetary positions, houses, angles,
  aspects, retrograde state, element and modality balance, chart ruler.
- Current sky snapshot with lunar phase, illumination, retrogrades, and a
  stable coarse snapshot hash suitable for seeding daily readings.
- Personal transits from moving bodies to fixed natal bodies, with orb and
  applying/separating classification derived from the transiting body's speed.
- Swiss Ephemeris adapter with per-platform runtime resolution, checksum
  verification, hardened subprocess execution, and structured errors.
- `contractVersion` v1 metadata block on calculations.
- `npm run runtime:check` — offline verification of platform, manifest,
  checksums, ephemeris data, and a smoke calculation.
- Parity suite proving the extracted engine matches the pre-extraction
  implementation exactly.

### Platforms

- `darwin-arm64` (development), `linux-x64` (deployment, statically linked).
- Verified on both. Unsupported platforms fail with a named error rather than
  falling back to a binary built for another operating system.

### Ephemeris

- Swiss Ephemeris 2.10.03, built from official source
  (`github.com/aloistr/swisseph`, tag `v2.10.03`, commit `175e1fc`).
- macOS ↔ Linux parity: maximum longitude difference 0.0° across 440 compared
  values.

### Licence

- AGPL-3.0-or-later, inherited from the Swiss Ephemeris free licensing option.

### Not included

- No persistence, no user accounts, no network access, no AI provider.
- Synastry is not yet extracted; it remains in the application.

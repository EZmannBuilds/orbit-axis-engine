# CLAUDE.md

Guidance for Claude Code and other agents working in this repository.

`README.md` covers what the engine does and its API. `CONTRIBUTING.md` covers setup.
This file covers what an agent needs that a human contributor does not.

## This repository is public and AGPL. Both facts constrain what you may do.

**Public.** Nothing private goes in here — not Erik's birth data or chart, not account
identifiers, not natal data of any kind, not API keys, not anything from the Orbit vault. Test
fixtures use invented dates. If you need a chart to test with, invent one and say so.

**AGPL-3.0-or-later, inherited from Swiss Ephemeris.** Not a preference and not negotiable. Do
not add a dependency without checking its licence against that obligation, and do not relicense
or dual-licence anything. `docs/`, `NOTICE`, `SOURCE.md` and `THIRD_PARTY_NOTICES.md` carry the
details; the app repo has more in `docs/deployment/swiss-ephemeris-licensing.md`.

## The engine is consumed by vendoring, so changes here land twice

`~/Projects/orbit` does not depend on this package from a registry — it keeps a copy in
`vendor/orbit-axis-engine/` and syncs it. A change here is not live in the app until someone runs
`npm run engine:sync` in the app repo and commits the result. `npm run engine:check` there fails
on drift.

So: **never edit `vendor/` in the app repo to fix an engine bug.** Fix it here, sync there.
And when you change engine behaviour, say in your report that the app needs a re-sync.

## Determinism is the product

The whole point of this repository is that the same inputs produce the same output, locally, with
no network call. Guard that:

- **No network calls.** Not for ephemeris data, not for timezones, not for anything.
- **No dependencies** unless there is no alternative — and then check the licence first.
- **No `Date.now()` or `new Date()` without an explicit instant** in calculation paths. A
  function whose answer depends on when it ran is not deterministic.
- Binaries live in `bin/darwin-arm64` and `bin/linux-x64`. The app's Vercel config ships the
  linux binary and excludes the darwin one; if you add a platform, that config needs updating too.

## Versioning

`CHANGELOG.md` follows Keep a Changelog; the package follows SemVer. Before 1.0.0, minor versions
may break. **The response `contractVersion` is versioned separately and independently** — changing
a response shape is a contract change even when the package version does not move.

Update `CHANGELOG.md` in the same commit as the change it describes.

## Checks

```bash
npm run verify    # lint + runtime:check + test — run this before reporting done
npm run ui        # local playground on :4747
```

`npm run verify` is the one that matters. Report which of the three parts passed if any failed.

## Approval gates

Ask Erik before: publishing to npm, tagging a release, merging to `main`, force-pushing, or
anything that changes the public surface of the repository. **Never enter an API key or secret
anywhere.** Remember that pushing here is publishing — this repo is world-readable.

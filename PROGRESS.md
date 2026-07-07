# Development Progress (read this first when taking over)

> Plan: [PLAN.md](PLAN.md); UI spec: [docs/design/booking-ui-extensions.md](docs/design/booking-ui-extensions.md).
> **Update this file as part of every phase commit** so any human or AI can pick up the work.

## Status

| Phase | Scope | Status | Branch / Commit |
|---|---|---|---|
| P0 | Planning docs | ✅ Done | `main` `70e6715` |
| P1 | Scaffold + 8-table schema + seed | ✅ Done (reviewed + fixed) | `p1-project-scaffold` `26f77e7`+`fc7d889` → [PR #1](https://github.com/codekaburra/booking-system/pull/1) (open) |
| P2 | Weekly timetable (shop/resource views, RWD, overrides) | 🔨 Implemented, review in progress | `p2-timetable` (stacked on P1) |
| P3 | Booking form (Mode A multi-preference) + client dedup + status page | ⬜ Not started | |
| P4 | Admin core (auth, approval w/ overbooking guard, email, manual booking/cancel) | ⬜ Not started | |
| P5 | Client login + My bookings + settings admin + special dates | ⬜ Not started | |
| P6 | Polish (reminders, self-cancel, slot generation cron, channels) | ⬜ Not started | |
| P7 | Google Calendar one-way push | ⬜ Not started | |
| P8 | Instant mode B (time-range booking, anti-overlap) | ⬜ Not started | |

## Fixed workflow for every phase

1. Branch off the previous phase's branch (`p3-booking-form`, `p4-admin-core`, …)
2. **developer** implements (role definition: `.claude/agents/developer.md`)
3. **reviewer** reviews read-only (`.claude/agents/reviewer.md`), outputs 🔴🟡🟢 findings
4. Fix → re-verify → **one (set of) commit(s) per phase**, message format `P2: weekly timetable — ...`
5. Update this file's status table → push

## Verification (run after every change)

```bash
npm run build && npm run lint
```
- SQL changes: no psql on this machine — validate with PGlite (`npm i @electric-sql/pglite`, run migration + seed, then consistency queries).
- UI: `npm run dev` and inspect. **Demo mode**: without Supabase env vars the data layer falls back to `src/lib/data/demo.ts` (mirrors seed.sql — keep them in sync).

## Contracts (do not violate)

- **Timezone**: date attribution / week starts computed in Asia/Taipei; DB timestamptz stores UTC, convert only for display. Helpers in `src/lib/tz.ts`.
- **date_overrides priority** (also documented in the migration and `src/lib/timetable.ts` header): overrides > rules; closed > special_hours > extra_open; resource-level > shop-level. Shop-level special_hours = intersection with each resource's rules (it never opens a resource that had no shift).
- **Overbooking guard**: approve must check `booked_count < capacity` inside a transaction (the DB CHECK is only a backstop).
- **Status color tokens** (`--status-*`) are template-wide and never overridable per shop; status is never conveyed by color alone (always text/icon too). Resource colors are stripes/dots only.
- **Shop-specific info** lives only in `src/config/shop.config.ts` + `.env`; never hardcode.
- Migration 0001 is frozen: schema changes go into new migration files.

## Current technical state

- Next.js 16 + React 19 + Tailwind v4 (CSS variables wired through `@theme inline` in `globals.css`)
- Supabase: **no real project created yet**; `.env.example` has placeholders; code must build and run in demo mode without env vars
- Not yet deployed to Vercel
- Docs language: English (product UI language: Traditional Chinese)

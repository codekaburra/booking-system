# Development Progress (read this first when taking over)

> Plan: [PLAN.md](PLAN.md); UI spec: [docs/design/booking-ui-extensions.md](docs/design/booking-ui-extensions.md).
> **Update this file as part of every phase commit** so any human or AI can pick up the work.

## Status

| Phase | Scope | Status | Branch / Commit |
|---|---|---|---|
| P0 | Planning docs | ✅ Done | `main` `70e6715` |
| P1 | Scaffold + 8-table schema + seed | ✅ Done (reviewed + fixed) | `p1-project-scaffold` `26f77e7`+`fc7d889` → [PR #1](https://github.com/codekaburra/booking-system/pull/1) (open) |
| P2 | Weekly timetable (shop/resource views, RWD, overrides) | ✅ Done (reviewed + fixed) | `p2-timetable` (stacked on P1) |
| P3 | Booking form (Mode A multi-preference) + client dedup + status page | ✅ Done (reviewed + fixed) | `p3-booking-form` |
| P4 | Admin core (auth, approval w/ overbooking guard, email, manual booking/cancel) | ✅ Done | `p4-admin-core` |
| P5 | Client login + My bookings + settings admin + special dates | ✅ Done | `p5-client-settings` |
| P6 | Polish (reminders, self-cancel, slot generation cron, channels) | ⬜ Not started | |
| P7 | Google Calendar one-way push | ⬜ Not started | |
| P8 | Instant mode B (time-range booking, anti-overlap) | ⬜ Not started | |

## ⚠️ Next action (as of 2026-07-14)

**Start P6** (polish: slot-generation cron, reminders, self-cancel, notifications log).
Branch off `p5-client-settings` (or merge stack to `main` first per process note below).

P5 delivered: client login/signup (Supabase Auth + demo phone login), My bookings
(logged-in list + guest phone+booking_id lookup), `getBookingByCode`, status page
with real state, booking form autofill, admin settings (courses/resources/hours,
`resource_courses` editor, special dates + holiday import + conflict check),
client management list. Migration `0004_resource_courses.sql`.

## Plan review (2026-07-08) — decisions now recorded in PLAN.md, land in the phases below
Architecture (8 tables, two modes, per-shop deploy, RPC transactions, tz contract) is sound —
nothing overturned. Findings and where they now live:
- 🔴 **approve must also check resource-level time overlap**, not just capacity (an instructor
  can be double-booked by two overlapping slots of different courses; certain once P6 generates
  slots). → PLAN §6 + P4 scope; reuses the P1 `(resource_id, starts_at, ends_at) where approved`
  partial index.
- 🟡 **`resource_courses` mapping table** needed for P6 slot generation + P5 editor UI. → PLAN §5/§7/§10.
- 🟡 **notification tracking**: single `notified_at` can't drive reminders → `notifications` log
  table (P6) or minimal `reminded_at`. → PLAN §5/§8/P6.
- 🟡 **unreachable guest** (no email): admin flag + form encouragement. → PLAN §4/§8/P4.
- 🟡 **admin role storage**: Supabase Auth `app_metadata.role='admin'`; every server action
  verifies role before service role. → PLAN §4/P4.
- 🟡 **`unique(request_id, slot_id)`** on request_slots → PLAN §5 (fold into `0002`, see above).

## Process / workflow suggestions (for the multi-AI workflow)
- **Commit the verification scripts** — don't leave them in scratchpad. Add `vitest`, commit the
  pure-function tests (tz / timetable / phone / booking-id / preferences) and `scripts/check-sql.mjs`
  (PGlite) so any AI can re-verify in one command. Highest-leverage for handoffs.
- **Branch strategy**: the stack is `p1→p2→p3` with PR #1 still open. After P3, **merge the whole
  stack into `main` once**, then branch each later phase off `main` (stop the PR pile-up).
- Deferred P2 🟢 (still open): `formatMinutes` 24:00, <37min slot clamp (Mode B/P8), allClosed
  reason edge, tab arrow-key nav.

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
- **Overbooking guard**: approve must check **both** `booked_count < capacity` **and** no
  overlapping *approved* booking for the same resource, inside one transaction (the DB CHECK /
  partial index are only backstops). See PLAN §6.
- **Status color tokens** (`--status-*`) are template-wide and never overridable per shop; status is never conveyed by color alone (always text/icon too). Resource colors are stripes/dots only.
- **Shop-specific info** lives only in `src/config/shop.config.ts` + `.env`; never hardcode.
- Migration 0001 is frozen: schema changes go into new migration files.

## Current technical state

- Next.js 16 + React 19 + Tailwind v4 (CSS variables wired through `@theme inline` in `globals.css`)
- Supabase: **no real project created yet**; `.env.example` has placeholders; code must build and run in demo mode without env vars
- Not yet deployed to Vercel
- Docs language: English (product UI language: Traditional Chinese)

# Development Progress (read this first when taking over)

> Plan: [PLAN.md](PLAN.md); UI spec: [docs/design/booking-ui-extensions.md](docs/design/booking-ui-extensions.md).
> **Update this file as part of every phase commit** so any human or AI can pick up the work.

## Status

| Phase | Scope | Status | Branch / Commit |
|---|---|---|---|
| P0 | Planning docs | ✅ Done | `main` `70e6715` |
| P1 | Scaffold + 8-table schema + seed | ✅ Done (reviewed + fixed) | `p1-project-scaffold` `26f77e7`+`fc7d889` → [PR #1](https://github.com/codekaburra/booking-system/pull/1) (open) |
| P2 | Weekly timetable (shop/resource views, RWD, overrides) | ✅ Done (reviewed + fixed) | `p2-timetable` (stacked on P1) |
| P3 | Booking form (Mode A multi-preference) + client dedup + status page | 🔨 In progress (data layer + `0002` RPC done; **build currently broken**; UI not started) | `p3-booking-form` (uncommitted) |
| P4 | Admin core (auth, approval w/ overbooking guard, email, manual booking/cancel) | ⬜ Not started | |
| P5 | Client login + My bookings + settings admin + special dates | ⬜ Not started | |
| P6 | Polish (reminders, self-cancel, slot generation cron, channels) | ⬜ Not started | |
| P7 | Google Calendar one-way push | ⬜ Not started | |
| P8 | Instant mode B (time-range booking, anti-overlap) | ⬜ Not started | |

## ⚠️ Next action — Opus handoff (as of 2026-07-08)

**Finish P3** on branch `p3-booking-form`. The previous developer subagent stopped
mid-task (rate limit). **The tree does not build** — fix that first, then finish the UI.

### State of P3 (reviewed by hand; reviewer subagent has NOT run yet)
**Done and good** (`src/lib/booking/*`, `0002` RPC, data-layer interface):
- `booking-id.ts` — `BK-YYYYMMDD-XXXX`, Taipei date, Crockford base32 (no I/L/O/U),
  injectable RNG, no modulo bias. `phone.ts` — TW mobile validate/normalize to 10 digits.
  `preferences.ts` — tick-order = preference order, auto-renumber on removal. All pure.
- `0002_create_booking_request.sql` — correct architecture (single plpgsql RPC = atomicity;
  Supabase JS has no client transactions). Re-validates each slot on submit (exists / course
  matches / future / has space) → closes the browse↔submit race. Correctly does **not** touch
  `booked_count` (that's P4 approve).
- `index.ts` interface + `supabase-source.ts` implement `findClientByPhone` / `createBooking`.

**🔴 Build is broken (fix first):**
- `src/lib/data/demo.ts` implements the read methods but is **missing** `findClientByPhone`
  and `createBooking` on `demoDataSource` → doesn't satisfy `BookingDataSource`; also has
  unused imports (`CreateBookingInput`, `CreateBookingResult`, `generateBookingId`,
  `normalizePhone`). `tsc` fails here. Implement both against the in-memory `clients` array
  (dedup by normalized phone; new phone → push a client; return a generated `booking_id`;
  `demo: true`, do **not** persist across requests — it's fine that it resets).

**🟡 Bugs to fix in the already-written code (0002 not committed — edit it directly):**
1. **Phone-归戶 race** in `0002`: two concurrent submits with the *same new phone* both
   `select` nothing → both `insert` → the second hits `clients.phone` unique and throws the
   raw DB error (double-click can trigger it). Change to `insert ... on conflict (phone) do
   nothing` then re-select, or catch `unique_violation` and re-select.
2. **Duplicate preference not blocked**: the same slot can be submitted as preference 1 *and*
   2. Add `unique(request_id, slot_id)` (see PLAN §5), dedup in `validate.ts`, and a dedup
   check in the `0002` RPC.

**🟢 Minor:** `p_channel` is hardcoded `'email'` in `0002` and `supabase-source.ts` — wire to
`shop.config` when P4 does notifications. Keep the base32 alphabet identical between `booking-id.ts`
(demo) and the SQL (real backend) — add a cross-reference comment on both sides.

### Remaining P3 work (UI — not started)
See PLAN §6 (Mode A flow) + §7 screens 2 & 3. Reuse `src/lib/data`, `src/lib/tz.ts`, status
tokens, `src/components/site-chrome.tsx`, and the sage/base + booking-ui-extensions design specs.
1. `/book` three-step form: ① pick course → ② tick multiple available slots (auto-numbered
   preference) → ③ name + phone (TW validation) + optional email.
2. **Server action** that re-validates server-side (server is source of truth), then calls
   `getDataSource().createBooking(...)`.
3. Submission **status page** (PLAN §7 #3): preferences + "awaiting confirmation" + `booking_id`
   (screenshot-able, used later for lookup).
4. Nav wiring; RWD; demo mode must work without Supabase env (non-persistent is OK).
5. Then run the **reviewer** subagent → fix → single P3 commit → update this table → push.

### Verify before commit
`npm run build && npm run lint` must pass; `npm run dev` and click through `/book` in demo mode.

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

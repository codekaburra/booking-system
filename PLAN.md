# Booking System — Plan

> Planning document. A booking-system template that can be cloned and applied to many shops and business types.
> Example scenario A (request mode): snowboard school — student views weekly timetable → submits form with multiple preferred time slots → owner confirms → notification.
> Example scenario B (instant mode): self-service gym / pilates / yoga — customer picks a room + start time + duration (30/45/60 min) → instantly confirmed.

Last updated: 2026-07-07 | **Development progress & handoff guide: [PROGRESS.md](PROGRESS.md)**

---

## 1. Project Goals

- Build a **booking-system template** reusable across many shops and business types.
- Core abstractions: **bookable resource** + **two booking modes**:
  - **Resource** = instructor (course shops) or room (self-service facilities) or equipment…; the UI label is set in config.
  - **Mode A — Request**: multiple preferences → owner approves (snowboard lessons, instructor-based shops).
  - **Mode B — Instant**: pick resource + start time + duration → instantly confirmed (self-service gym/pilates/yoga rooms).
- Each shop has its own **services**, **durations**, **capacities**, and **resources**.
- Two core screens:
  1. **Weekly Timetable** — booked / free per day per week (whole-shop / single-resource views).
  2. **Booking form** — Mode A: tick multiple preferred slots; Mode B: pick start time + duration.
- Designed for shops in Taiwan (timezone `Asia/Taipei`, Traditional Chinese UI, Taiwan payment/notification habits, **national holiday handling**).

---

## 2. Tech Stack & Infrastructure

| Layer | Choice |
|---|---|
| Frontend + backend | **Next.js (React)** + Tailwind CSS (RWD, mobile-first) |
| Database | **PostgreSQL, hosted on Supabase** |
| Auth | **Supabase Auth** (guest / client / admin) |
| Deployment | **Vercel** |
| Files (instructor photos, logo) | Supabase Storage |
| Email notifications | Resend (free tier) |
| WhatsApp notifications (optional) | WhatsApp Business API / Twilio |
| LINE notifications (optional) | LINE Messaging API (Official Account) |
| Google Calendar (P7) | Google Service Account + Calendar API |

> **Platform accounts**: exactly **one** Supabase account and **one** Vercel account; each shop is a separate project under them.
> **Domain**: one per shop (~NT$300–500/year).
> Start on free tiers; upgrade only when usage grows.

### Explicitly excluded
- ❌ Multi-tenant single deployment (using per-shop deploys instead, see §3)
- ❌ AWS (Supabase + Vercel is simpler for this project)
- ❌ Cloudflare full stack / D1 (keep PostgreSQL; Cloudflare at most as optional CDN later)
- ❌ Notion as display layer
- ❌ Google Calendar two-way sync (one-way push only)
- ❌ LINE Login (booking works without login instead)
- ❌ PHP / OpenCart e-commerce style course selling (we need true time-slot booking)

---

## 3. Deployment Model: One Deploy per Shop

Each shop = an independent deployment, physically isolated (strongest isolation, allows heavy per-shop customization).

```
template repo (one core codebase)
   │  branch-per-shop (fix once on core → merge into shop branches)
   ├── snowboard shop branch → its own Supabase project → deployed to snowboard.com
   ├── yoga shop branch      → its own Supabase project → deployed to yoga.com
   └── ...
```

### Keeping N deployments manageable
- One platform account each (Supabase / Vercel); log in once, see all projects.
- **branch-per-shop**: one repo, core fixes merge into each shop branch — no N copies of the code.
- Naming convention: `booking-snowboard`, `booking-yoga`, …
- **New-shop checklist** (target: under 10 minutes):
  1. Create Supabase project
  2. Run schema migrations
  3. Run seed to create an admin account
  4. Fill `.env` + edit `shop.config.ts`
  5. Connect the branch/repo to Vercel

### Where per-shop differences live
| Type | Location | Examples |
|---|---|---|
| Static brand config | `shop.config.ts` + `.env` | Shop name, logo, timezone, primary color, enabled notification channels, Google settings |
| Operational data | Each shop's Supabase (editable in admin UI) | Services, durations, capacities, opening hours, resources, bookings |

---

## 4. User Roles

| Role | Login? | Capabilities |
|---|---|---|
| **Guest** | No | Book directly (**phone number required**) → gets booking id + notification |
| **Client** | Optional | Books with autofilled info + sees "My bookings" history |
| **Admin (owner)** | Required | Approves bookings, manages services/resources/hours, sees all clients |

> Auth via Supabase Auth with a `role` distinction. Client login is an optional convenience; booking always works without login (low friction).

---

## 5. Database Tables (8)

> Because of per-shop deployment there is **no** `shop_id` and no multi-tenant RLS.

```
clients ──< booking_requests ──< request_slots >── slots >── resources
                     │ (on approve gets resource_id      └── courses
                     │  + starts_at/ends_at)
availability_rules ── resources
date_overrides ────── resources (nullable = whole shop)
```

### clients
| Column | Notes |
|---|---|
| id | client id |
| name | |
| phone | **required, unique** (dedup key: same phone = same person) |
| email | optional |
| line_user_id | optional (for LINE notifications) |
| preferred_channel | email / whatsapp / line |
| auth_user_id | linked to Supabase Auth after signup; null for guests; **unique** |
| note | |
| created_at | |

### courses (services)
| Column | Notes |
|---|---|
| id | |
| name | e.g. Private lesson / Group lesson |
| duration_min | **lesson/session length in minutes** |
| capacity | **people per session** (1 = private; 8 = group) |
| price | |
| is_active | |

### resources (bookable resource: instructor / room / equipment)
| Column | Notes |
|---|---|
| id | |
| type | instructor / room / equipment (UI label set in `shop.config.ts`) |
| name | e.g. Coach Ming / Room A |
| photo | |
| color | calendar display color |
| is_active | false = resigned / under maintenance |
| gcal_calendar_id | Google calendar created by the company for this resource (P7) |

### availability_rules (weekly recurring opening hours)
| Column | Notes |
|---|---|
| id | |
| resource_id | **each resource has its own availability** |
| weekday | |
| start_time / end_time | |

### date_overrides (special dates: national holidays / shop closure / leave / extra opening) ⭐
| Column | Notes |
|---|---|
| id | |
| date | |
| resource_id | **null = whole shop** (holidays, closure); set = single resource (instructor leave, room maintenance) |
| type | closed / special_hours / extra_open |
| start_time / end_time | used by special_hours / extra_open |
| reason | display text (Lunar New Year, typhoon, leave…) |

> **National holidays**: import Taiwan government office calendar (open data) yearly into shop-wide date_overrides; owner then adjusts day by day (e.g. open with shorter hours, or extra opening). Priority contract: date_overrides > availability_rules; closed > special_hours > extra_open; resource-level > shop-level.

### slots (concrete sessions; Mode A, generated from rules × course duration)
| Column | Notes |
|---|---|
| id | |
| course_id | |
| resource_id | |
| starts_at / ends_at | |
| capacity | |
| booked_count | confirmed count (overbooking guard) |

### booking_requests (bookings)
| Column | Notes |
|---|---|
| id | |
| client_id | FK → clients |
| booking_id | public code (e.g. BK-20260630-A1B2), also the lookup credential |
| status | pending / approved / rejected / cancelled / completed |
| course_id | |
| resource_id | **final resource** (Mode A: filled on approve; Mode B: set at creation) |
| starts_at / ends_at | **final time range** (same as above; Mode B overlap checks use these) |
| note | |
| notify_channel / notified_at | notification log |
| gcal_event_id | resource calendar event (P7) |
| company_gcal_event_id | company calendar event (P7) |

> **Both modes converge**: Mode A goes through request_slots preferences and writes the chosen slot's resource/time back on approve; Mode B writes this table directly (status = approved). Everything downstream — My bookings, notifications, reminders, cancellation, Google Calendar — is shared.

### request_slots (booking ↔ multiple preferred slots; Mode A)
| Column | Notes |
|---|---|
| request_id | FK → booking_requests |
| slot_id | FK → slots |
| preference_order | 1, 2, 3… |

---

## 6. Core Booking Flows

> Each shop sets **booking_mode: "request" or "instant"** in `shop.config.ts`.

### Mode B: Instant (self-service gym / pilates / yoga rooms)
```
Customer picks service (defines 30/45/60 duration) → room (or any) → start time (15/30-min grid)
   → phone required, match-or-create client → transaction checks no overlap for that resource/time range
   → directly approved + booking_id + "confirmed" notification
```
- Availability computed dynamically: opening hours (rules + date_overrides) minus existing bookings; **no pre-generated slots**.
- Room capacity = 1 (whole room per booking).

### Mode A: Request (snowboard lessons, instructor shops)
```
Student fills form (course + multiple preferred slots, phone required)
   → match clients by phone (existing → same client_id; new → create)
   → generate booking_id
   → status pending, send "request received" notification (with booking_id)
        ↓
Owner sees the request (each preference with live remaining capacity)
   → clicks "confirm this preference"
        → capacity check (booked_count < capacity?)
        → transaction: booked_count +1, status approved, other preferences released
        → "confirmed" notification; (P7) push to Google Calendar
   → or "reject" → status rejected, optional reason + notification
```

**Key**: the seat is only taken at approve time, inside a transaction — prevents overbooking when two students race for the last seat.

### Admin manual booking (phone / LINE DM / walk-in)
Many customers book by phone or DM. The owner can **create a booking directly in the admin UI**:
pick slot → enter name + phone (same client dedup) → directly approved (skips pending).

### Cancellation / reschedule
- **Minimal version first (P4)**: customer contacts the shop; owner cancels in admin → `booked_count -1`, status cancelled, notification, (P7) delete calendar events.
- **Self-service cancellation (P6)**: customer uses phone + booking_id via "My bookings"; subject to **cancellation policy** (no cancellation within N hours before start; N in `shop.config.ts`).
- **Reschedule** = cancel + rebook (no in-place edit; simplest logic). Owner can do it on behalf of a customer.

### Slot generation strategy (Mode A)
- A scheduled job **rolls forward 4 weeks of slots daily** (rules × course duration, **applying date_overrides**: closed → skip, special_hours → adjust, extra_open → add).
- When the owner edits hours / adds an override → only regenerate **future slots with no bookings**; slots with bookings are untouched and conflicts are listed for manual handling.
- Scheduler: Vercel Cron (free tier).

### Resource leave / temporary closure (instructor sick day, room maintenance)
- Owner adds a date_override (closed / special_hours) for that resource.
- If bookings exist in the affected range → system lists them; owner handles each: cancel (notify) or reschedule.
- Shares the conflict-handling logic with "edit opening hours" (built together in P5).

### National holidays
- Yearly import of the Taiwan government office calendar → shop-wide date_overrides (default closed); owner can flip individual days to open / special hours / extra opening.
- Timetable shows a label on special dates (e.g. "Lunar New Year — closed").

---

## 7. Screens (8)

### Customer-facing
1. **Weekly Timetable** (read-only, RWD)
   - View A: whole shop (all resources overlaid, distinguished by color)
   - View B: single resource (one instructor's / room's week)
   - 🟢 available / 🔴 full / ⚪ closed; special-date labels; Mode A shows `booked/total`
   - Mobile: one day at a time, swipe left/right
2. **Booking form**
   - Mode A: ① pick course → ② tick **multiple** preferred slots (only ones with space; auto-numbered by preference) → ③ name + phone (email optional)
   - Mode B: ① pick service (30/45/60) → ② pick room (or any) + start time → ③ name + phone → instant confirm
   - Logged-in clients get autofill
3. **Submission status page** — preferences + "awaiting confirmation" + booking_id (screenshot-able, used for lookup)
4. **My bookings** — upcoming / past list
   - Logged in → direct; not logged in → phone + booking_id

### Owner-facing (login required)
5. **Request inbox** — preferences with live remaining capacity, one-click confirm/reject (with capacity check); **manual booking** (phone/walk-in), cancel / reschedule on behalf
6. **Services + hours + resource management** — durations/capacities/prices, weekly hours, resources (colors, deactivate, Google link), **special dates management** (holiday import, closures, leave/maintenance + conflict handling for affected bookings)
7. **Client management** — client list + per-client session history (admin view)
8. **Login / signup** — clients and admin (role-based redirect)

---

## 8. Notifications

| Channel | Integration | Notes |
|---|---|---|
| **Email** | Resend | required; free tier covers thousands/month |
| **WhatsApp** | WhatsApp Business API / Twilio | pay per message (~NT$0.5–2) |
| **LINE** | LINE Messaging API (Official Account) | free tier; push requires the user to have friended the OA |

- Enabled channels → `shop.config.ts` (per shop).
- Clients pick `preferred_channel`; phone is **always required** since all channels may need it.
- Notification moments:
  1. On submission (received + booking_id)
  2. On admin confirm / reject
  3. On cancellation
  4. **Reminder one day before the session** (P6, Vercel Cron; the single best anti-no-show feature)

---

## 9. Google Calendar Integration (P7, one-way push)

Model: **one company Google account (Service Account) owns all calendars; instructors only subscribe read-only.**
(Generalized: one calendar per resource; room-type resources don't need sharing — they exist for the owner's overview.)

```
Company Service Account (single credential)
   ├── owns: "Coach Ming" calendar   → shared read-only with Ming
   ├── owns: "Coach Hua" calendar    → shared read-only with Hua
   └── owns: company master calendar → owner subscribes (always sees everything)
```

- The system writes to any of these calendars using the company credential (it owns them all).
- On booking confirm → create events in the resource calendar + company calendar, store both event ids; reschedule/cancel → update/delete via those ids.
- **Benefits**: no per-instructor OAuth; no tokens that die on staff turnover; **hiring/leaving never touches any subscription** — the owner's subscription is permanent.
- One-way only (system → calendar); instructors' private events are never read.
- Config in `.env`: `GOOGLE_SERVICE_ACCOUNT_KEY`, `COMPANY_GCAL_ID`.
- Note: Service Accounts owning calendars works best under Google Workspace.

---

## 10. Phases

| Phase | Scope |
|---|---|
| **P1 Foundation** | Supabase schema (8 tables incl. resources / date_overrides) + snowboard demo seed |
| **P2 Timetable** | Read-only weekly timetable (whole-shop / single-resource views), RWD, special-date labels |
| **P3 Booking (Mode A)** | Multi-preference form + client dedup + pending submission + status page |
| **P4 Admin core** | Supabase Auth (admin login) + approval + capacity check + booking_id + email notifications + **manual booking / cancel** (closes the loop) |
| **P5 Clients + settings** | Client signup/login + My bookings + services/resources/hours admin + **special dates (holiday import, leave/maintenance + conflict handling)** + client management + extract `shop.config.ts` (template-ization) |
| **P6 Polish** | Per-shop theming, mobile polish, **pre-session reminders**, **self-service cancellation (with policy)**, optional WhatsApp / LINE |
| **P7 Calendar** | Google Calendar one-way push (resource + company calendars) |
| **P8 Instant mode (Mode B)** | Start-time + duration booking, dynamic availability, anti-overlap transaction → self-service gym/pilates/yoga (payments become higher priority here) |

---

## 11. Development Workflow (subagents)

Every phase (P1–P8) uses the **developer / reviewer dual-subagent** flow:

```
1. developer subagent  → implements the phase per PLAN.md
2. reviewer subagent   → independent review (correctness, overbooking/overlap logic, schema consistency, RWD)
3. issues found        → developer fixes → re-review; phase is done only when it passes
```

- Agent definitions: `.claude/agents/developer.md`, `.claude/agents/reviewer.md`.
- The reviewer is read-only to keep the review independent; all fixes go through the developer.
- Reviewer especially watches: overbooking transaction (Mode A), time-range overlap (Mode B), `Asia/Taipei` timezone, date_overrides priority.

## 12. Design Spec (UI/UX)

Two documents; both developer and reviewer must follow them:

1. **Base theme**: global skill `sage-theme-uiux` (`~/.claude/skills/sage-theme-uiux/SKILL.md`)
   - Sage Theme A335: calm, natural, premium; 60-30-10 palette, type hierarchy, buttons/cards/forms.
   - Position: **default template theme** (fits yoga/pilates/gym); each shop overrides the primary color via CSS variables (snowboard shop uses glacier blue); typography and neutrals stay.
2. **Booking extensions**: [docs/design/booking-ui-extensions.md](docs/design/booking-ui-extensions.md)
   - Covers what the base theme doesn't: timetable grid, **status color tokens** (available/full/pending/closed — template-wide, not overridable), preference chips, status badges, dense admin tables, conflict warnings, mobile one-day view.
   - **On conflict, the extension spec wins** (functional recognizability beats subtlety); resource colors are stripes/dots only, status colors are the only fills.

## 13. Decisions Deferred to Implementation

- ORM: Prisma vs Supabase client (decide in P1).
- Payments (if online payment needed): ECPay / NewebPay / LINE Pay (after P6).
- Anti-abuse (no-login booking): phone format validation; SMS OTP or CAPTCHA if abused.
- Cloudflare: optional CDN/protection later (free).
- Phone-dedup edge case: one phone booking for multiple family members (fine as one client initially; add an "attendee name" field later if needed).
- Waitlist: queue when full (later if needed).
- Lesson packages / punch cards (buy 10 sessions): common in Taiwan, but involves payments + deduction — after the core flow is stable.
- Check-in / no-show marking: enriches client history (owner notes suffice initially).
- CSV export: for owner reports (half a day when needed).
- Self-service facility door access (smart lock / codes): **out of scope**; use booking_id at the counter / fixed code initially.
- Mode B payments (unmanned facilities usually require prepayment): evaluate at P8.

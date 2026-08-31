# Dev HR Management

A full-stack **ERP / HR management platform** for a digital agency — staff and
payroll, attendance and shifts, leads and clients, quotations and orders,
receipts and invoices, plus a real-time customer-support console. Built as a
small monorepo with a shared Node.js API and two Next.js front-ends.

<br/>

## Applications

| Path | Stack | Description |
| --- | --- | --- |
| **`server/`** | Node.js · Express · TypeScript · MongoDB | Unified REST + Socket.io API for every front-end. Owns authentication, the permission engine, all database access, and third-party integrations (S3, Cloudinary, WhatsApp Cloud API, Google Calendar, SMTP). |
| **`dashboard/`** | Next.js (App Router) · React · Redux Toolkit | The internal ERP / HR application **and the auth host** — it serves the sign-in, sign-up and password-reset pages for the whole platform. |
| **`support/`** | Next.js · Socket.io | Live-chat and ticketing console for support agents. Shares the platform session, so agents sign in once on the dashboard. |

> The public marketing site (**webbriks.com**) and payment portal live in
> separate repositories and consume this API.

<br/>

## Tech Stack

- **Frontend** — Next.js (App Router), React 19, Tailwind CSS, shadcn/ui, Redux Toolkit + RTK Query
- **Backend** — Node.js, Express 5, TypeScript, Mongoose
- **Database** — MongoDB (replica set — order/quotation flows use multi-document transactions)
- **Auth** — Better Auth, session cookies scoped to `.webbriks.com` for cross-app SSO
- **Realtime** — Socket.io
- **Infra** — Redis (cache + cross-instance invalidation + queues), AWS S3 (presigned uploads), Cloudinary, Pino structured logging, Sentry

<br/>

## Key Features

- **Layered RBAC** — access is the union of four grant sources, minus a
  per-user deny list:

  ```
  effective = role.permissions
            ∪ department.permissions      (the user's staff department)
            ∪ designation.permissions     (the user's staff designation)
            ∪ user.extraPermissions       (per-user override)
            − user.deniedPermissions
  ```

  Permissions are typed `resource.action` keys defined in code
  (`server/src/constants/permission.ts`); roles are stored in the database and
  editable from the **Roles & Permissions** admin UI. Route guards and API
  responses are permission-driven — e.g. prices and client identity are
  stripped from order / quotation payloads unless the caller holds
  `order.viewFinancials` / `order.viewClient`.

- **Unified authentication (SSO)** — the dashboard hosts sign-in; the backend
  issues a `.webbriks.com`-scoped session cookie, so a single login covers the
  dashboard and the support console.

- **Quotation → Order pipeline** — orders are created only by converting an
  accepted quotation, with an enforced status state machine.

- **HR suite** — attendance, shift assignment, leave workflow, payroll runs
  with amount-confirmation guards, and per-staff wallets / balances.

- **Live support** — visitors on the marketing site chat with an AI assistant
  and can escalate to a human agent in real time; existing clients are
  recognised by email.

- **WhatsApp Cloud API inbox** — inbound messages with optional AI auto-reply.

<br/>

## Getting Started

### Prerequisites

- **Node.js 20+**
- **MongoDB** (local or Atlas) — **must be a replica set**
- **Redis** — `REDIS_URL`, defaults to `redis://localhost:6379`

Each app reads its own `.env`. Backend keys are declared in
`server/src/config/env.config.ts`; front-end keys are the `NEXT_PUBLIC_*`
values referenced in each app's source.

### Run (development)

```bash
# 1 — API
cd server && npm install && npm run dev

# 2 — Dashboard
cd dashboard && npm install && npm run dev

# 3 — Support console
cd support && npm install && npm run dev
```

### Seed RBAC defaults

Run once after the first boot, and again after changing the built-in role
definitions or the department / designation grant defaults:

```bash
cd server && npm run seed:roles
```

This upserts the five built-in roles (`super_admin`, `admin`, `hr_manager`,
`team_leader`, `staff`), ensures the **Telemarketing** department exists with
its grant, and moves telemarketer staff into it. Custom roles are never
touched.

<br/>

## Build

```bash
cd server    && npm run build   # tsc → dist/
cd dashboard && npm run build   # next build
cd support   && npm run build   # next build
```

<br/>

## Testing

```bash
cd server && node --import tsx --test $(find src -name '*.test.ts')
```

Covers the permission resolver, role-escalation guards, the order/quotation
field-masking policy, payroll day-counting, and the order status state
machine.

<br/>

---

## Author

**Fuyad Hasan Fahim** — Full-Stack Developer

[![Portfolio](https://img.shields.io/badge/Portfolio-fuyadhasanfahim.com-4F46E5?style=for-the-badge&logo=googlechrome&logoColor=white)](https://fuyadhasanfahim.com)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-fuyadhasanfahim-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/fuyadhasanfahim)
[![X](https://img.shields.io/badge/X-@codewithfuyad-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/codewithfuyad)
[![Instagram](https://img.shields.io/badge/Instagram-@codewithfuyad-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/codewithfuyad)

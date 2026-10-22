# Order-status and staff notifications (SMS + WhatsApp + email)

One service, `server/src/services/notify.service.ts`, sends a message on every channel at once. It **never throws**:
each channel (SMS, WhatsApp, email) runs on its own, and a bad number, a gateway outage or a missing credential only
means that channel is skipped or reported as failed in the logs. The action that triggered it (changing an order's
status, marking attendance) always completes.

## What triggers a message

| Event | Who gets it | Where it is hooked |
| --- | --- | --- |
| Order created / moved to in progress, revision, completed, delivered, cancelled | the client (SMS, WhatsApp, email) | `order.service.ts` → `order-notify.service.ts` |
| Photo order status change | the client | `photo-order.service.ts` |
| Marked late / half-day / absent (check-in, scheduler auto-absent, manual or bulk edit) | the staff member | `attendance.service.ts`, `scheduler.service.ts` |
| Leave approved / rejected / revoked / expired, shift change | the staff member | `notification.service.ts` (types `attendance`, `leave`, `shift`) |

Staff messages ride on the in-app notification: whatever shows in the bell is also sent to the person's phone and
inbox. Pass `external: false` to `createNotification` for a bell-only copy (used for admins).

## Channels

- **SMS** — BulkSMSBD (same gateway and key as the hardware-store app: `SMS_API_KEY`, optional `SMS_SENDER_ID`).
  Only Bangladeshi mobiles (`01XXXXXXXXX` → `8801XXXXXXXXX`). Bengali text is sent as `unicode`, English as `text`.
- **WhatsApp** — Meta Cloud API. Business-initiated messages need an approved template; set the names below. With no
  template configured, a message is sent as free text only if the person wrote to us in the last 24 hours, otherwise skipped.
- **Email** — the existing SMTP transport; clients' `emails`, staff's user email.

## Safe by default: `NOTIFY_MODE`

`live` in production, `dry` everywhere else. In `dry` mode nothing is sent; the would-be message is logged
(`notify.dry_run`). To test against real phones locally, set `NOTIFY_MODE=live` in `server/.env`.

## WhatsApp templates

Category **Utility**, language **English** (`en`). Submit in Meta Business Manager, then set the names in `server/.env`.

### Order status — `WA_TEMPLATE_ORDER_STATUS`

```
Hello {{1}}, the status of your order {{2}} is now: {{3}}. Thank you for choosing Web Briks.
```

| Var | Filled with | Sample |
| --- | --- | --- |
| {{1}} | client name | Rahim |
| {{2}} | order number | ORD-2026-00010 |
| {{3}} | status | in progress |

### Staff alert — `WA_TEMPLATE_STAFF_ALERT` (`staff_attendance_update`)

```
Hello {{1}}, this is an update about your attendance or leave record at Web Briks: {{2}} - Web Briks HR
```

| Var | Filled with | Sample |
| --- | --- | --- |
| {{1}} | staff name | Karim |
| {{2}} | the alert | Marked Absent. Your attendance for 22/10/2026 has been marked absent. |

```
## Status

Approved by Meta (Web Briks, Utility, `en`): `order_status_update`, `staff_attendance_update`. An earlier `staff_hr_alert` was reclassified as Marketing and deleted; keep staff wording neutral (no "check the dashboard" call to action) so it stays Utility.

```
WA_TEMPLATE_ORDER_STATUS=order_status_update
WA_TEMPLATE_STAFF_ALERT=staff_attendance_update
NOTIFY_MODE=live
```

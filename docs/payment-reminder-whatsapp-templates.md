# WhatsApp templates for payment reminders

Submit both in Meta Business Manager → WhatsApp → Message templates.
Category: **Utility**. Language: **English** (code `en`).

## 1. Due payment — name: `payment_due_reminder`

```
Hello {{1}}, this is a reminder from Web Briks that {{2}} is still due for order {{3}}. You can pay securely here: {{4}}. If you have already paid, please ignore this message.
```

| Var | Filled with | Sample for Meta |
| --- | --- | --- |
| {{1}} | client name | Rahim |
| {{2}} | amount | BDT 60,000 |
| {{3}} | order number | ORD-2026-00010 |
| {{4}} | payment link | https://pay.example.com/payment/abc123 |

## 2. Recurring payment — name: `recurring_payment_reminder`

```
Hello {{1}}, your {{2}} payment for {{3}} of {{4}} is due (order {{5}}). If you have already paid, please ignore this message.
```

| Var | Filled with | Sample for Meta |
| --- | --- | --- |
| {{1}} | client name | Rahim |
| {{2}} | monthly / yearly | monthly |
| {{3}} | charge title | Hostinger VPS KVM1 |
| {{4}} | amount | BDT 10,500 |
| {{5}} | order number | ORD-2026-00010 |

## Status

Submitted to Meta under the Web Briks business (number +880 1353-047595) and pending review: `payment_due_reminder`, `recurring_payment_reminder`.

## Turning it on

After Meta approves a template, set these in `server/.env` on the server and restart `devhr-server`:

```
WA_TEMPLATE_PAYMENT_DUE=payment_due_reminder
WA_TEMPLATE_PAYMENT_RECURRING=recurring_payment_reminder
WA_TEMPLATE_LANGUAGE=en
```

A reminder whose template is not set is simply sent by email only. When a template is set, the client gets
the message on WhatsApp too (their phone number is taken from the client record; `01XXXXXXXXX` is converted
to `8801XXXXXXXXX`). If WhatsApp fails but email works, the reminder still counts as sent and the error is
shown on the Payment Reminders page.

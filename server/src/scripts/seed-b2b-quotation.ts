/**
 * One-off script: creates (or reuses) a Client and inserts the approved
 * "B2B Ordering Platform for Retailers & Resellers" quotation as a DRAFT,
 * so it shows up in the dashboard for review.
 *
 * Run from server/:  node --import tsx src/scripts/seed-b2b-quotation.ts
 *
 * Optional env overrides:
 *   B2B_CLIENT_NAME     (default: "FM")
 *   B2B_CLIENT_COMPANY  (default: "FM")
 *   B2B_CLIENT_EMAIL    (default: none — edit later in the dashboard)
 */
import mongoose, { Types } from 'mongoose';
import envConfig from '../config/env.config.js';
import ClientModel from '../models/client.model.js';
import UserModel from '../models/user.model.js';
import { QuotationService } from '../services/quotation.service.js';

const CLIENT_NAME = process.env.B2B_CLIENT_NAME || 'FM';
const CLIENT_COMPANY = process.env.B2B_CLIENT_COMPANY || 'FM';
const CLIENT_EMAIL = process.env.B2B_CLIENT_EMAIL || '';

const run = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected.');

        const actor =
            (await UserModel.findOne({ role: { $in: ['super_admin', 'admin'] } })) ||
            (await UserModel.findOne({}));
        if (!actor) throw new Error('No users in this database — cannot pick a createdBy.');
        const userId = String(actor._id);
        console.log(`Actor: ${actor.email || actor._id} (${actor.role || 'n/a'})`);

        // ── Client ───────────────────────────────────────────────────────────────
        let client = CLIENT_EMAIL
            ? await ClientModel.findOne({ emails: CLIENT_EMAIL })
            : await ClientModel.findOne({ name: CLIENT_NAME });
        if (!client) {
            client = await ClientModel.create({
                name: CLIENT_NAME,
                emails: CLIENT_EMAIL ? [CLIENT_EMAIL] : [],
                currency: 'USD',
                status: 'active',
                createdBy: new Types.ObjectId(userId),
            });
            console.log(`Created client ${client._id} (${CLIENT_NAME})`);
        } else {
            console.log(`Reusing client ${client._id} (${client.name})`);
        }

        const today = new Date();
        const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // ── Quotation content (approved) ─────────────────────────────────────────
        const overview =
            "WebBriks will design and build a bespoke B2B ordering platform that replaces FM's " +
            'current email-based ordering process with a single portal for retailers and resellers. ' +
            'Retailers log in to a dedicated account, browse the catalogue at their own negotiated ' +
            'prices, build a cart, and submit orders for FM approval. FM reviews and approves each ' +
            'order, generates an invoice from the cart, and the platform routes the confirmed shipment ' +
            'to one of two carrier integrations — Floship and DHL Express — selected ' +
            'automatically by configurable shipping rules that FM controls. Retailers see live shipment ' +
            'tracking, exchange messages with FM per order, and receive automated status notifications. ' +
            "The platform's structure mirrors FM's existing e-commerce site but is built for B2B buyers.";

        const scopeItems = [
            // Authentication & retailer accounts
            'Authentication: email + password login and "Continue with Google" sign-in, with role-based access (retailer / FM admin); JWT / session auth',
            'FM invites and creates retailer accounts; activate / deactivate; password reset',
            'Retailer profile: company info, contact, billing address, shipping address',
            // Product catalogue
            'Admin-managed product catalogue: name, SKU, description, images, category, base price, availability, status',
            // Pricing engine
            'Retailer-specific pricing engine: per-retailer per-product negotiated fixed price; per-retailer percentage discount / margin off base price',
            'Price resolution priority: (1) negotiated product price, (2) retailer discount / margin, (3) base price',
            // Storefront, cart & checkout
            "Storefront: product listing, search, category filter and product detail, each showing the retailer's own price",
            'Cart & checkout: add / update quantity / remove, live subtotal, review, submit order',
            // Orders & approval
            'Order lifecycle: Pending -> Approved / Rejected -> Confirmed -> Processing -> Shipped -> Delivered',
            'FM admin orders: list / filter / search, view detail, approve, reject with reason, change status',
            'Retailer orders: order history, order detail, status, tracking, invoice',
            // Invoicing
            'Invoice generated from the order / cart contents (line items, quantities, unit price, subtotal, shipping, discount, total, order reference, date)',
            'Invoice web view + PDF download',
            // Shipping integration & rule engine
            'Shipping abstraction layer with two providers: Floship and DHL Express',
            'FM-configurable shipping rules: name, conditions (product / destination / weight / quantity), provider, priority, active on / off',
            'On order confirmation the rule engine selects the provider and creates the shipment; FM can manually override the provider per order',
            'Layer designed so a third carrier can be added later as separate scope, without rebuilding the order flow',
            // Tracking
            'Shipment tracking shown to the retailer: carrier, tracking number, status, ship date, estimated delivery',
            'Tracking sync via provider webhooks where available, plus a scheduled poll fallback',
            // Messaging
            'Per-order conversation thread between retailer and FM (sender, message, timestamp, read / unread)',
            // Notifications
            'In-app + email notifications on: order placed, approved, rejected, confirmed, shipped, tracking updated, delivered, new message, invoice generated',
            // Admin dashboard
            'FM admin dashboard: retailers, products, pricing, orders, shipping rules, invoices, conversations, notifications',
        ];

        const clientRequirements = [
            'Existing e-commerce site URL and the platform it runs on',
            'Product data decision: products entered manually in the new platform (base scope), OR imported / synced from an existing product API (add-on — needs API docs, credentials and a sandbox)',
            'If a product API is used: product endpoints, fields, image endpoints, inventory endpoints, auth method; one-time import vs continuous sync; whether stock syncs too',
            'Current B2B price list plus example retailer prices, discount and margin structures; any minimum order quantities or product restrictions',
            'Confirm the price resolution priority (negotiated price -> retailer discount -> base price)',
            'Floship: account access, API documentation, sandbox + production credentials, webhook configuration; which Floship services are used; whether orders auto-create shipments; how tracking updates arrive',
            'DHL Express: account plus MyDHL API credentials (test + production), shipping account number; which DHL services; whether rates are calculated via DHL; whether labels are generated; tracking sync method',
            'The actual rules for choosing Floship vs DHL (by destination, product, weight, etc.) and any exceptions',
            'Invoicing: sample invoice / template, company legal and registration info, tax / VAT requirements, invoice numbering format, currency; whether the invoice is generated before or after order approval',
            'Confirm messaging is per-order only (base scope) vs also general retailer <-> FM messaging',
            'Final list of notification events required; confirm email + in-app only (no SMS / WhatsApp / push in base scope); sender email / domain and any branded email templates',
            'Branding: logo, brand colours, fonts, brand guidelines, existing UI / Figma files; confirm the B2B portal should visually follow the existing e-commerce site',
            'Hosting & deployment: preferred hosting / existing cloud accounts, domain or subdomain for the portal, staging + production environments, email infrastructure, database hosting',
            'All credentials and assets delivered within the first 5 working days; the 30-day timeline assumes prompt responses and working third-party APIs',
            'Confirm whether online payment is required. Base scope assumes an invoice / credit-account B2B workflow with no online payment gateway; payment-gateway integration is separate scope',
        ];

        const notIncluded = [
            'Online payment gateway / card processing',
            'Accounting-software integration (QuickBooks, Xero, etc.)',
            'Continuous product / inventory synchronisation with the existing e-commerce platform (one-time import only if an API is provided; otherwise manual)',
            'A third or additional shipping carrier beyond Floship and DHL Express',
            'Real-time chat beyond per-order threaded messaging',
            'SMS / WhatsApp / push notifications',
            'Advanced analytics, BI or custom reporting suites',
            'Large-scale data migration from legacy systems',
            'Native mobile apps',
            'Domain, hosting, paid third-party API licences and ad spend (client cost)',
            'SEO, content creation, product photography / copywriting',
        ];

        const includedSupport = [
            '90 days of post-sale support after delivery — any bug or issue in the delivered features is fixed at no charge for 90 days from the delivery / handover date',
            "One deployment to FM's production environment",
            'Handover: source code, README, environment / setup documentation, and an admin walkthrough session',
        ];

        const keyTerms = [
            'Fixed price USD 1,500. Timeline 30 working days from kickoff and receipt of all credentials and assets.',
            'Shipping providers: this scope covers integration of the two carriers named by FM — Floship and DHL Express — behind a single shipping layer. FM does not write code to use them. FM controls, from the admin panel: (a) which carrier a given order uses, through shipping rules based on product, destination, weight, quantity and priority; (b) a per-order manual override of the chosen carrier; and (c) an active on / off switch per carrier and per rule. The layer is built so a third carrier can be added later as additional scope, without rebuilding the order flow. Adding brand-new integration types beyond shipping is not included.',
            'Product data is FM-managed in the platform unless an existing product API is supplied, in which case a one-time import is included.',
            'Base scope is an invoice / credit-account workflow — no online payment.',
            "Timeline depends on FM providing working Floship and DHL API access; carrier-side delays or undocumented APIs are outside WebBriks' control and pause the delivery clock.",
            'WebBriks provides 90 days of free bug / issue support on delivered features, starting from the delivery / handover date.',
            'Any item listed under Not Included, or any new request, is quoted and approved separately.',
            'Payment milestones: 50% advance to start, 50% on final delivery and production deployment.',
        ];

        const workflow = [
            'Days 1-3 — Setup & design: requirements lock, schema design, repo + environments, UI direction from the existing site',
            'Days 4-9 — Auth, retailers, catalogue: login / RBAC / Google sign-in, retailer profiles, admin product management',
            'Days 10-14 — Pricing engine, storefront, cart: per-retailer price resolution, storefront with personalised prices, cart & checkout',
            'Days 15-19 — Orders & approval, invoicing: order lifecycle, FM approve / reject, invoice generation + PDF',
            'Days 20-25 — Shipping layer & rules: Floship + DHL integration, rule engine, manual override, shipment creation',
            'Days 26-28 — Tracking, messaging, notifications: webhook + poll tracking sync, per-order chat, in-app / email notifications',
            'Days 29-30 — QA, deployment, handover: end-to-end testing, production deploy, documentation & walkthrough',
        ];

        const quotation = await QuotationService.createQuotation(
            {
                serviceType: 'web-development',
                clientId: client._id,
                company: { name: 'WEB BRIKS LLC' },
                client: {
                    contactName: CLIENT_NAME,
                    companyName: CLIENT_COMPANY,
                    ...(CLIENT_EMAIL ? { email: CLIENT_EMAIL } : {}),
                },
                details: {
                    title: 'B2B Ordering Platform for Retailers & Resellers',
                    date: today.toISOString(),
                    validUntil: validUntil.toISOString(),
                },
                currency: 'USD',
                overview,
                notIncluded,
                clientRequirements,
                includedSupport,
                keyTerms,
                workflow,
                services: [
                    {
                        category: 'web-development',
                        scopeDescription:
                            'End-to-end B2B ordering portal (retailer storefront + FM admin) with retailer-specific pricing, order approval, invoicing, dual carrier integration with rule-based routing, tracking, per-order messaging, and automated notifications.',
                        scopeItems,
                        techStack: {
                            description:
                                'Frontend and backend kept independent (REST) so future integrations are easier to add.',
                            frontend: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'],
                            backend: ['Node.js', 'NestJS', 'TypeScript', 'REST API'],
                            database: ['PostgreSQL', 'Prisma ORM'],
                            tools: [
                                'Redis + BullMQ (background jobs, tracking sync, email)',
                                'JWT + RBAC auth',
                                'Floship API',
                                'DHL Express (MyDHL) API',
                                'Webhook endpoints',
                                'Email / notification provider',
                                'Object storage for images & invoice PDFs',
                                'Vercel (frontend) + managed cloud (backend)',
                            ],
                        },
                        basePrice: 1500,
                        lineItems: [],
                        discount: 0,
                        taxRate: 0,
                    },
                ],
                paymentMilestones: [
                    { label: 'Advance / kickoff', percentage: 50, note: 'Project starts on receipt' },
                    {
                        label: 'Final delivery & production deployment',
                        percentage: 50,
                        note: 'On handover',
                    },
                ],
            } as any,
            userId,
        );

        console.log('\n✅ Quotation created.');
        console.log(`Number:  ${quotation.quotationNumber}`);
        console.log(`Group:   ${quotation.quotationGroupId}`);
        console.log(`Id:      ${quotation._id}`);
        console.log(`Status:  ${quotation.status} (draft — review it in the dashboard)`);
        if (!CLIENT_EMAIL) {
            console.log('\nNote: no client email set. Add the client contact details in the dashboard before sending.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Seed script failed:', err);
        process.exit(1);
    }
};

run();

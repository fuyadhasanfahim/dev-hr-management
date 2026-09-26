/**
 * One-off: rewrites quotation 6aa2b3ce29834d40f9a66c70 so its scope follows the
 * house structure used by QTN-2026-0044..0047 — a 2-space-indented feature tree
 * (MODULE -> sub-feature -> sub-sub-feature), module price carried inline as
 * " - N", service.basePrice = sum of module prices, no "Full Development" line.
 *
 * Run from server/:  node --import tsx src/scripts/rewrite-b2b-quotation.ts
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import { QuotationService } from '../services/quotation.service.js';

const QUOTATION_ID = '6aa2b3ce29834d40f9a66c70';

// Module price (USD) -> must sum to 1500.
const MODULES: Array<[string, number, string[]]> = [
    ['RETAILER ACCOUNTS & AUTHENTICATION', 150, [
        'Sign-in',
        '  Email & password login',
        '  Continue with Google (OAuth 2.0)',
        '  Forgot / reset password',
        'Role-based access control',
        '  Retailer role',
        '  FM admin role',
        '  Permission checks on every admin action',
        '  JWT / session handling',
        'Retailer onboarding (FM-managed)',
        '  Invite retailer by email',
        '  Create / edit retailer account',
        '  Activate / deactivate retailer',
        'Retailer profile',
        '  Company information',
        '  Contact person(s)',
        '  Billing address',
        '  Shipping address',
    ]],
    ['PRODUCT CATALOGUE', 130, [
        'Product record',
        '  Name, SKU, description',
        '  Product images (multiple)',
        '  Category & tags',
        '  Base price & currency',
        '  Availability / status',
        'Catalogue administration',
        '  Create / edit / archive product',
        '  Bulk status update',
        '  Category management',
        'Optional one-time import from the existing store (only if a product API is supplied)',
    ]],
    ['RETAILER-SPECIFIC PRICING ENGINE', 200, [
        'Negotiated price list',
        '  Per-retailer, per-product fixed price',
        '  Effective / expiry dates',
        'Retailer discount / margin',
        '  Percentage off base price per retailer',
        '  Category-level override (optional)',
        'Price resolution',
        '  Priority 1: negotiated product price',
        '  Priority 2: retailer discount / margin',
        '  Priority 3: catalogue base price',
        'Resolved price shown live in storefront, cart, order and invoice',
    ]],
    ['STOREFRONT, CART & CHECKOUT', 170, [
        'Product listing',
        '  Search',
        '  Category & availability filter',
        '  Sort & pagination',
        'Product detail page',
        '  Retailer-specific price',
        '  Stock / availability badge',
        '  Quantity selector',
        'Cart',
        '  Add to cart',
        '  Update quantity',
        '  Remove line',
        '  Live subtotal & total',
        'Checkout',
        '  Confirm shipping address',
        '  Order review',
        '  Submit order for approval',
    ]],
    ['ORDER MANAGEMENT & APPROVAL', 190, [
        'Order lifecycle',
        '  Pending -> Approved / Rejected',
        '  Confirmed -> Processing -> Shipped -> Delivered',
        'Retailer order view',
        '  Order history & search',
        '  Order detail (items, quantities, prices, totals)',
        '  Status, tracking and invoice links',
        'FM admin order desk',
        '  List / filter / search orders',
        '  Review order detail',
        '  Approve order',
        '  Reject order with reason',
        '  Manual status change',
        'Approval notifications to retailer and FM',
    ]],
    ['INVOICING', 90, [
        'Generate invoice from the order / cart',
        '  Line items, quantity, unit price',
        '  Subtotal, shipping, discount, tax, total',
        '  Order reference & dates',
        'Invoice web view',
        'Invoice PDF download',
    ]],
    ['SHIPPING INTEGRATION & RULE ENGINE (FLOSHIP + DHL EXPRESS)', 240, [
        'Carrier abstraction layer',
        '  Floship integration',
        '    Create shipment',
        '    Retrieve rates',
        '    Retrieve tracking',
        '  DHL Express (MyDHL API) integration',
        '    Create shipment',
        '    Retrieve rates',
        '    Retrieve tracking',
        '  Unified shipment model stored in the platform',
        'Shipping rule engine (FM-configurable, no code)',
        '  Rule conditions: product / destination / weight / quantity',
        '  Provider selection by rule priority',
        '  Active / inactive toggle per rule',
        '  Enable or disable a carrier globally',
        'Automatic provider selection on order confirmation',
        'Manual per-order provider override by FM',
        'Architecture ready for a future third carrier (separate scope)',
    ]],
    ['SHIPMENT TRACKING', 90, [
        'Tracking record',
        '  Carrier & tracking number',
        '  Status, ship date, estimated delivery',
        'Updates via carrier webhooks where available',
        'Scheduled polling fallback',
        'Tracking visible in the retailer order view',
    ]],
    ['MESSAGING (PER ORDER)', 70, [
        'Conversation thread attached to each order',
        'Retailer <-> FM messages',
        'Sender, timestamp, read / unread state',
        'New-message notification',
    ]],
    ['NOTIFICATIONS (IN-APP + EMAIL)', 90, [
        'Order placed, approved, rejected, confirmed',
        'Shipped, tracking updated, delivered',
        'New message, invoice generated',
        'In-app notification centre',
        'Templated email delivery',
    ]],
    ['ADMIN DASHBOARD', 80, [
        'Retailers, products and pricing management',
        'Orders and approval queue',
        'Shipping rules and carrier toggles',
        'Invoices',
        'Conversations and notification log',
    ]],
];

const run = async () => {
    try {
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected.');

        // Build the flat 2-space-indented scope tree. No per-module prices —
        // the project carries a single fixed price (see lineItems below).
        const scopeItems: string[] = [];
        for (const [name, , children] of MODULES) {
            scopeItems.push(name);
            for (const c of children) scopeItems.push(`  ${c}`); // shift children one level under the module
        }

        const clientRequirements = [
            // NOTE: "existing e-commerce URL + platform" dropped — we have both
            // (https://www.furlanmarri.com/, running on Shopify).
            'Product data decision: enter products manually in the new platform (base scope), OR a one-time import from your Shopify store (add-on — needs Shopify Admin API access / a private-app token)',
            'If the Shopify import is chosen: confirm which product fields and images to bring over, and whether stock should be synced (continuous sync is outside base scope)',
            'Current B2B price list plus example retailer prices, discount and margin structures; any minimum order quantities or product restrictions',
            'Confirm the price resolution priority (negotiated price -> retailer discount -> base price)',
            'Floship: account access, API documentation, sandbox + production credentials, webhook configuration; which Floship services are used; whether orders auto-create shipments; how tracking updates arrive',
            'DHL Express: account plus MyDHL API credentials (test + production), shipping account number; which DHL services; whether rates are calculated via DHL; whether labels are generated; tracking sync method',
            'The actual rules for choosing Floship vs DHL (by destination, product, weight, etc.) and any exceptions',
            'Invoicing: a sample invoice / template, your Swiss VAT number and how VAT should appear (including cross-border / export orders), invoice numbering format, invoice currency, and whether the invoice is generated before or after order approval',
            'Confirm messaging is per-order only (base scope) vs also general retailer <-> FM messaging',
            'Confirm the notification events required; email + in-app only in base scope (no SMS / WhatsApp / push); confirm the transactional email sender address (e.g. no-reply@furlanmarri.com) and provide DNS access for SPF / DKIM; branded email template if you have one',
            'Branding assets: logo files, brand colours, fonts, brand guidelines, and any existing UI / Figma files (the portal will follow the look of furlanmarri.com)',
            'Hosting & deployment: preferred hosting / existing cloud accounts, domain or subdomain for the portal, staging + production environments, email infrastructure, database hosting',
            'All credentials and assets delivered within the first 5 working days; the 40-day timeline assumes prompt responses and working third-party APIs',
            'Confirm whether online payment is required. Base scope assumes an invoice / credit-account B2B workflow with no online payment gateway; payment-gateway integration is separate scope',
        ];

        const keyTerms = [
            'Fixed price USD 2,000. Timeline 40 working days from kickoff and receipt of all credentials and assets.',
            'Shipping providers: this scope covers integration of the two carriers named by FM — Floship and DHL Express — behind a single shipping layer. FM does not write code to use them. FM controls, from the admin panel: (a) which carrier a given order uses, through shipping rules based on product, destination, weight, quantity and priority; (b) a per-order manual override of the chosen carrier; and (c) an active on / off switch per carrier and per rule. The layer is built so a third carrier can be added later as additional scope, without rebuilding the order flow. Adding brand-new integration types beyond shipping is not included.',
            'Product data is FM-managed in the platform unless a Shopify import is supplied, in which case a one-time import is included.',
            'Base scope is an invoice / credit-account workflow — no online payment.',
            "Timeline depends on FM providing working Floship and DHL API access; carrier-side delays or undocumented APIs are outside WebBriks' control and pause the delivery clock.",
            'WebBriks provides 90 days of free bug / issue support on delivered features, starting from the delivery / handover date.',
            'Any item listed under Not Included, or any new request, is quoted and approved separately.',
            'Payment milestones: 50% advance to start, 50% on final delivery and production deployment.',
        ];

        const workflow = [
            'Days 1-4 — Setup & design: requirements lock, schema design, repo + environments, UI direction from furlanmarri.com',
            'Days 5-12 — Auth, retailers, catalogue: login / RBAC / Google sign-in, retailer profiles, admin product management',
            'Days 13-19 — Pricing engine, storefront, cart: per-retailer price resolution, storefront with personalised prices, cart & checkout',
            'Days 20-26 — Orders & approval, invoicing: order lifecycle, FM approve / reject, invoice generation + PDF',
            'Days 27-33 — Shipping layer & rules: Floship + DHL integration, rule engine, manual override, shipment creation',
            'Days 34-37 — Tracking, messaging, notifications: webhook + poll tracking sync, per-order chat, in-app / email notifications',
            'Days 38-40 — QA, deployment, handover: end-to-end testing, production deploy, documentation & walkthrough',
        ];

        const updated = await QuotationService.updateQuotation(QUOTATION_ID, {
            keyTerms,
            workflow,
            client: {
                contactName: 'Camille Reix',
                companyName: 'Furlan Marri SA',
                address: 'Rue du Nant 25, 1207 Geneva, Switzerland',
                email: 'camille@furlanmarri.com',
                phone: '+41 79 559 08 95',
            },
            clientRequirements,
            services: [
                {
                    category: 'web-development',
                    scopeDescription:
                        'Bespoke B2B ordering platform — retailer storefront and FM admin. All modules below are delivered together for a single fixed project price of USD 2,000.',
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
                    basePrice: 0,
                    lineItems: [
                        {
                            title: 'B2B Ordering Platform — Complete Design & Development',
                            price: 2000,
                            billingCycle: 'one-time',
                        },
                    ],
                    discount: 0,
                    taxRate: 0,
                },
            ],
            paymentMilestones: [
                { label: '50% Upfront Deposit (Project Kickoff)', percentage: 50 },
                { label: '50% Final Delivery & Handover', percentage: 50 },
            ],
        } as any);

        console.log('\n✅ Rewritten.');
        console.log(`Number:  ${updated.quotationNumber}`);
        console.log(`Grand:   ${updated.totals?.grandTotal} ${updated.currency}`);
        console.log(`Scope lines: ${scopeItems.length}`);
        process.exit(0);
    } catch (err) {
        console.error('Rewrite failed:', err);
        process.exit(1);
    }
};

run();

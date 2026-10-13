/**
 * Seeds the quotation catalog (Service → Platform → Package → Feature) from the
 * five Webbriks price-plan PDFs:
 *   - LARAVEL BASED E-COMMERCE WEBSITE.pdf
 *   - Shopify Based E-commerce Website.pdf
 *   - Custom Coading Website.pdf            (Next.js / Node.js)
 *   - Marketing.pdf
 *   - Product Photography, Videography & Ad Creative Services.pdf
 *
 * Idempotent: everything is upserted by its natural key, so re-running only
 * refreshes the content and never duplicates. Records are linked by ObjectId.
 *
 * Run from server/:  node --import tsx src/scripts/seed-catalog.ts
 */
import mongoose, { Types } from 'mongoose';
import envConfig from '../config/env.config.js';
import CatalogService from '../models/catalog-service.model.js';
import CatalogPlatform from '../models/catalog-platform.model.js';
import CatalogPackage from '../models/catalog-package.model.js';
import CatalogFeature from '../models/catalog-feature.model.js';

type Groups = Record<string, string[]>; // group heading -> feature names

const FREE_SUPPORT = [
    'Existing feature bug fixing',
    'Minor text correction',
    'Small UI alignment correction',
    'Existing functionality troubleshooting',
    'Tracking configuration error correction',
    'Existing responsive issues',
    'Existing checkout/order bug',
];
const ADDITIONAL_CHARGES = [
    'New feature development',
    'New page design',
    'Major UI/UX redesign',
    'New API integration',
    'Additional tracking implementation',
    'New custom modules',
    'Major workflow modification',
];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ───────────────────────────── platforms ─────────────────────────────
const PLATFORMS = [
    { slug: 'laravel', name: 'Laravel', logo: 'laravel', color: '#FF2D20', description: 'Modern & scalable PHP framework', sortOrder: 1 },
    { slug: 'next-js-node-js', name: 'Next.js / Node.js', logo: 'nextdotjs', logoSecondary: 'nodedotjs', color: 'currentColor', description: 'React-based modern stack', sortOrder: 2 },
    { slug: 'shopify', name: 'Shopify', logo: 'shopify', color: '#7AB55C', description: 'E-commerce platform for online stores', sortOrder: 3 },
    { slug: 'other', name: 'Other', logo: '', color: 'currentColor', description: 'Custom technology (requirement based)', sortOrder: 4 },
];

// ───────────────────────────── feature groups (from the PDFs) ─────────────────────────────
const LARAVEL_STARTER_ONLY = [
    "Template-based design — choose a design from Webbriks' curated ready-made templates",
    'Website setup & customization based on the selected template',
    '1 courier API integration',
    'Basic fraud detection',
    'Basic inventory management',
];
const LARAVEL_STARTER: Groups = {
    'Design & Development': [
        LARAVEL_STARTER_ONLY[0]!,
        LARAVEL_STARTER_ONLY[1]!,
        'Brand color, logo, banner & content configuration',
        'Mobile, tablet & desktop responsive layout',
        'Laravel + MySQL based website',
        'Standard performance optimization',
    ],
    'E-Commerce & Management': [
        'Product, category & brand management',
        'Product variations (color, size)',
        'Shopping cart & checkout',
        'Customer registration & login',
        'Wishlist & product reviews',
        'COD & manual payment options',
        'Secure admin dashboard',
        'Order & customer management',
        LARAVEL_STARTER_ONLY[4]!,
        'Coupon & discount management',
        'Basic sales & order reports',
    ],
    'Courier, Tracking & Support': [
        LARAVEL_STARTER_ONLY[2]!,
        LARAVEL_STARTER_ONLY[3]!,
        'Meta Pixel + GA4 + GTM setup',
        '1 year Hostinger VPS (50GB KVM) hosting + domain',
        '12 months technical support',
    ],
};
const LARAVEL_PRO_ONLY: Groups = {
    'Business Pro — Core': [
        'Fully custom UI/UX design (Figma design, custom homepage, product page, category page, checkout experience & dedicated responsive design)',
        'Advanced fraud detection (customer order history, repeat cancellation, suspicious orders & rule-based risk indicators)',
        '1-click courier integration (one-click booking, bulk order processing, label printing & delivery status tracking)',
        'Messenger & WhatsApp automation (order confirmation, status notifications, predefined replies & workflows)',
        'Meta Ads report in admin panel (campaign spend, purchase results & reported ROAS)',
        'Advanced inventory & product management (low-stock alerts, stock movement history, advanced filtering, bundles & upsell)',
        'Advanced conversion tracking (Meta Conversion API, GA4 enhanced e-commerce, TikTok Pixel & abandoned cart tracking)',
    ],
    'Additional Business Pro Features': [
        'Online payment gateway integration',
        'SMS gateway integration',
        'Up to 2 courier API integrations',
        'Advanced coupon & discount rules',
        'Customer segmentation & purchase history',
        'Advanced sales & performance dashboard',
        'Limited staff role management',
        '1 custom campaign landing page',
    ],
};

const SHOPIFY_STARTER_ONLY = [
    'Webbriks-approved free theme selection',
    'Selected theme customization',
    'Basic fraud indicators / manual order review',
    'Basic Shopify analytics',
    'Up to 30 initial product uploads',
];
const SHOPIFY_STARTER: Groups = {
    'Store Design & Setup': [
        'Shopify store creation & initial configuration',
        SHOPIFY_STARTER_ONLY[0]!,
        SHOPIFY_STARTER_ONLY[1]!,
        'Logo, colors, fonts & banner setup',
        'Mobile, tablet & desktop responsive layout',
        'Homepage, About Us, Contact, FAQ & policy pages',
        'Navigation menu & footer customization',
        'Basic homepage sections & featured collections',
    ],
    'E-Commerce Functionality': [
        'Product & collection management',
        'Product variants (size, color)',
        'Product search & filtering (theme-supported)',
        'Shopping cart & checkout',
        'Customer account setup',
        'Inventory & stock management',
        'Coupon / discount codes',
        'COD & manual payment configuration',
        'Delivery charge & shipping zone setup',
        'Order status & fulfillment management',
    ],
    'Fraud, Marketing & Tracking': [
        SHOPIFY_STARTER_ONLY[2]!,
        'Meta Pixel configuration',
        'GA4 + GTM setup',
        SHOPIFY_STARTER_ONLY[3]!,
        'Facebook & Instagram sales channel configuration (where eligible)',
    ],
    'Additional Benefits': [
        'Custom domain connection',
        'Shopify-managed SSL & hosting',
        SHOPIFY_STARTER_ONLY[4]!,
        'Basic SEO configuration',
        'Store management training',
        '12 months technical support',
    ],
};
const SHOPIFY_PRO_ONLY: Groups = {
    'Business Pro — Core': [
        'Custom UI/UX & Shopify theme development (Figma-based custom design, premium homepage, product & collection page design, conversion-focused layout, custom Shopify theme sections)',
        'Advanced fraud detection setup (supported fraud-prevention app / rules, suspicious order flags, repeat customer history & risk review workflow)',
        '1-click courier integration (Steadfast, Pathao, RedX etc. via Shopify-compatible app, where the provider can be connected)',
        'Messenger & WhatsApp automation (supported apps / approved APIs: order confirmation, shipping updates, support replies)',
        'Advanced conversion tracking (Meta Pixel + supported Conversion API, GA4 enhanced e-commerce, TikTok Pixel & event testing)',
        'Conversion optimization features (product bundles, upsell / cross-sell, advanced discount setup, reviews & wishlist)',
    ],
    'Additional Business Pro Benefits': [
        'Advanced product search & filtering',
        'Custom product page sections',
        'Advanced collection page design',
        'Up to 100 initial product uploads',
        'Up to 2 supported courier integrations',
        'SMS gateway setup (compatible provider)',
        'Abandoned checkout recovery configuration',
        'Customer segmentation & marketing lists',
        '1 custom campaign landing page',
        'Advanced Shopify analytics setup',
        'Basic technical SEO configuration',
        'Performance & image optimization',
    ],
};

const NEXT_STARTER_ONLY = [
    'Basic fraud detection (order history & repeat-cancellation flags)',
    '1 courier API integration',
    'Custom UI/UX design',
    'Basic inventory / stock tracking',
];
const NEXT_CORE: string[] = [
    'Latest technology: Next.js, Node.js, Express.js, MariaDB',
    'Fully responsive website',
    'Fast & optimized performance',
    'Secure admin dashboard',
    'Advanced website security foundation',
    'SSL / HTTPS integration',
    'Meta Pixel, GA4 & GTM',
    'Facebook page optimization',
    'Professional logo & cover photo',
    'Domain — 1 year',
    'VPS hosting (50GB KVM-1 from Hostinger) — 1 year',
    'Domain ownership & access: client',
    '12 months technical support',
    'Basic admin training',
];
const NEXT_STARTER: Groups = {
    'E-Commerce & Store Management': [
        'Fully custom homepage & essential pages',
        'Product, category & brand management',
        'Product variants (color, size)',
        'Shopping cart & checkout',
        'Customer registration & login',
        'Wishlist & customer review system',
        'COD & manual payment options',
        'Order management & order status',
        NEXT_STARTER_ONLY[3]!,
        'Coupon & discount management',
    ],
    'Courier & Fraud Management': [
        NEXT_STARTER_ONLY[0]!,
        NEXT_STARTER_ONLY[1]!,
        'Courier booking & status view from admin',
        'Basic shipping charge configuration',
        'District-based delivery charges',
    ],
    'Marketing & Analytics': [
        'Meta browser pixel',
        'Google Analytics 4 & GTM',
        'Standard e-commerce event tracking',
        'Basic sales & order dashboard',
    ],
    'Additional Benefits': [NEXT_STARTER_ONLY[2]!, '1-year hosting + domain', 'Facebook page optimization', 'Logo & cover photo', '12 months technical support'],
    'Core Benefits': NEXT_CORE,
};
const NEXT_PRO_ONLY: Groups = {
    'Business Pro — Core': [
        'Advanced fraud detection (order history, repeat-cancellation behavior, suspicious order flags & rule-based risk scoring)',
        '1-click courier integration (one-click & bulk booking, consignment ID, shipping label & courier status sync)',
        'Messenger & WhatsApp automation (order confirmation, status update, welcome message, support quick replies & predefined flows)',
        'Meta Ads report in admin panel (ad spend, campaign performance, purchase results & reported ROAS)',
        'Advanced sales & inventory (low-stock alerts, stock movement history, product sales reports, on-hand / reserved stock summary)',
        'Advanced marketing & conversion tracking (Meta Conversion API, GA4 enhanced events, TikTok Pixel, upsell & cross-sell, abandoned cart tracking)',
        'Customer CRM & segmentation (purchase history, basic lifetime value reporting, VIP / repeat segments & customer notes)',
    ],
    'Additional Business Pro Features': [
        'Premium custom UI/UX design',
        'Advanced product filtering & search',
        'Advanced coupon & discount rules',
        'Product bundle & cross-sell offers',
        'Online payment gateway integration',
        'SMS gateway integration',
        'Up to 2 courier API integrations',
        'Courier shipping label printing',
        'Basic automated abandoned cart reminders',
        'Advanced sales & performance dashboard',
        'Staff access roles (limited RBAC)',
        '1 custom marketing landing page',
    ],
};
const NEXT_CUSTOM: Groups = {
    'Advanced Inventory & Warehouse': [
        'Multi-warehouse inventory management',
        'Real-time stock synchronization',
        'Warehouse-to-warehouse transfer slips',
        'Automated low-stock & reorder alerts',
        'On-hand, committed & on-hold stock tracking',
        'Multi-store management',
    ],
    'POS & Retail Management': [
        'Barcode POS checkout system',
        'Multi-terminal POS',
        'Split payment (cash, card, MFS)',
        'Thermal receipt printing (58mm / 80mm)',
        'Online & offline stock synchronization',
    ],
    'Advanced AI & Automation': [
        'AI sales chatbot for Messenger / WhatsApp',
        'Bangla AI order verification calls',
        'AI-powered abandoned cart recovery',
        'Vision AI product recognition',
        'AI content generation',
        'AI landing page builder',
    ],
    'Enterprise Finance & CRM': [
        'Balance sheet & profit/loss reporting',
        'Flexible P&L date modes',
        'Accounts receivable / payable',
        'Expense & petty cash ledger',
        'Customer credit & due tracking',
        'Advanced customer segmentation',
        'Loyalty & reward points',
    ],
    'Custom Integrations & Security': [
        'Shopify / WooCommerce synchronization',
        'ERP / accounting / POS integration',
        'Phone OTP verification',
        'Advanced COD rules',
        'Custom role-based access control',
        'Audit logs & advanced reports',
        'Open REST API & custom webhooks',
        'HR, attendance & payroll modules',
        'Multi-language & multi-currency',
    ],
    'Core Benefits': NEXT_CORE,
};

const MARKETING: Groups = {
    'Marketing Research & Strategic Planning': [
        'Product & business analysis',
        'Customer & audience analysis',
        'Competitor & market analysis',
        'Strategic marketing plan',
    ],
    'Meta Ads (Facebook & Instagram)': [
        'Sales & conversion campaign planning',
        'Campaign creation & configuration',
        'Audience research & targeting',
        'Remarketing / retargeting strategy',
        'Ad creative testing & A/B testing',
        'Budget allocation & optimization',
        'Performance monitoring',
    ],
    'Google Ads Management': [
        'Search campaign planning & setup',
        'Shopping / Performance Max where applicable',
        'Keyword & search intent research',
        'Search terms & negative keyword optimization',
        'Conversion tracking review',
        'Bid & budget optimization',
        'Campaign performance monitoring',
    ],
    'Performance Optimization': ['Regular optimization on cost per sale, CPA, ROAS, conversion rate, CTR, CPC & campaign revenue'],
    'Advertising Creative Strategy & Direction': [
        'Product-specific creative angles',
        'Marketing hooks & key messages',
        'Customer pain point & solution angles',
        'Product benefits & USP communication',
        'Offer & promotion ideas',
        'Recommended video / static / carousel formats',
        'Creative testing recommendations',
    ],
    'Facebook & Instagram Social Media Management': [
        '8–12 posts per month (static, carousel, reels & informative posts)',
        'Monthly Facebook & Instagram content strategy',
        'Monthly content calendar preparation',
        'Content topic & post idea planning',
        'Complete post copywriting & captions',
        'Scriptwriting for planned reels',
        'Static post & carousel design',
        'Reels creation / editing from client-provided footage or available assets',
        'Product-focused, informative & promotional content',
        'Facebook & Instagram post scheduling',
        'Publishing on both platforms',
        'Monthly content performance review',
    ],
};

const PHOTO: Groups = {
    'Standard Production & Delivery': [
        '4 professionally edited photographs per product from different angles',
        'Professional image editing & necessary retouching',
        'Color adjustments & visual polish',
        'Delivery of final edited files in the agreed format',
    ],
};
const REEL: Groups = {
    'Standard Production & Delivery': [
        'Concept, shot planning, lighting & setup (standard scope)',
        'Professional video editing, color & visual polish',
        'Delivery of final edited files in the agreed format',
    ],
};
const PRODUCTION_EXCLUSIONS = [
    'Model or talent fees',
    'Outdoor shooting expenses, transportation / conveyance & location-related costs',
    'Specific, unusual or client-requested props (client-supplied or charged separately)',
    'Additional production requirements, special locations, complex setups or services outside the agreed scope',
];
const PRODUCTION_WORKFLOW =
    'Workflow: requirement discussion → product handover → planning & production → post-production → final delivery. All prices are indicative; the final quotation depends on scope and complexity. Volume-based custom quotes are available for larger quantities.';

// ───────────────────────────── seeding helpers ─────────────────────────────
const upsert = async <T>(model: mongoose.Model<any>, filter: object, set: object): Promise<T & { _id: Types.ObjectId }> =>
    (await model.findOneAndUpdate(filter, { $set: set }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean()) as never;

const run = async () => {
    await mongoose.connect(envConfig.mongo_uri as string);
    console.log('Connected.');

    const plat: Record<string, Types.ObjectId> = {};
    for (const p of PLATFORMS) plat[p.slug] = (await upsert<unknown>(CatalogPlatform, { slug: p.slug }, { ...p, isActive: true }))._id;

    const svc: Record<string, Types.ObjectId> = {};
    const SERVICES = [
        { slug: 'website-development', name: 'Website Development', icon: 'website', quotationCategory: 'web-development', pricingMode: 'package', platforms: ['laravel', 'next-js-node-js', 'other'], description: 'Modern, high-performing websites for your business.', sortOrder: 1 },
        { slug: 'e-commerce-shopify', name: 'E-commerce (Shopify)', icon: 'ecommerce', quotationCategory: 'web-development', pricingMode: 'package', platforms: ['shopify'], description: 'Scale your online business with Shopify solutions.', sortOrder: 2 },
        { slug: 'performance-marketing', name: 'Performance Marketing', icon: 'marketing', quotationCategory: 'marketing', pricingMode: 'package', platforms: [], description: 'Drive traffic and grow your business.', sortOrder: 3 },
        { slug: 'product-photography', name: 'Product Photography', icon: 'photography', quotationCategory: 'photo-editing', pricingMode: 'unit', platforms: [], description: 'Professional product photoshoots.', sortOrder: 4 },
        { slug: 'product-reels-video', name: 'Product Reels / Video', icon: 'reels', quotationCategory: 'video-editing', pricingMode: 'unit', platforms: [], description: 'Engaging reels & video content for your brand.', sortOrder: 5 },
        { slug: 'photo-video-editing', name: 'Photo / Video Editing', icon: 'editing', quotationCategory: 'photo-editing', pricingMode: 'unit', platforms: [], description: 'Professional editing for your content.', sortOrder: 6 },
        { slug: 'mobile-app-development', name: 'Mobile App Development', icon: 'mobile', quotationCategory: 'web-development', pricingMode: 'package', platforms: [], description: 'iOS & Android app development.', sortOrder: 7 },
        { slug: 'web-application-custom', name: 'Web Application (Custom)', icon: 'webapp', quotationCategory: 'web-development', pricingMode: 'package', platforms: [], description: 'Custom web applications for complex business needs.', sortOrder: 8 },
    ] as const;
    for (const s of SERVICES) {
        const { platforms, ...rest } = s;
        svc[s.slug] = (await upsert<unknown>(CatalogService, { slug: s.slug }, { ...rest, platformIds: platforms.map((p) => plat[p]), isActive: true }))._id;
    }

    /** Upserts a feature and returns its id (feature identity = service + platform + kind + name). */
    const feature = async (serviceSlug: string, platformSlug: string | null, group: string, name: string, sortOrder: number) =>
        (
            await upsert<unknown>(
                CatalogFeature,
                { serviceId: svc[serviceSlug], platformId: platformSlug ? plat[platformSlug] : null, kind: 'included', name },
                { group, sortOrder, isActive: true, price: 0 },
            )
        )._id;

    const features = async (serviceSlug: string, platformSlug: string | null, groups: Groups, startAt = 0) => {
        const ids: Types.ObjectId[] = [];
        let i = startAt;
        for (const [group, names] of Object.entries(groups)) for (const n of names) ids.push(await feature(serviceSlug, platformSlug, group, n, i++));
        return ids;
    };

    type PkgInput = {
        service: string;
        platform?: string;
        name: string;
        badge?: string;
        description?: string;
        price: number | null;
        priceMax?: number | null;
        billingCycle?: string;
        unitLabel?: string;
        bullets?: string[];
        featureIds?: Types.ObjectId[];
        supportPeriod?: string;
        bestFor?: string;
        notes?: string[];
        supportInclusions?: string[];
        additionalCharges?: string[];
        sortOrder: number;
    };
    const pkg = async (p: PkgInput) => {
        const slug = slugify(p.name);
        const { service, platform, ...rest } = p;
        await upsert(
            CatalogPackage,
            { serviceId: svc[service], platformId: platform ? plat[platform] : null, slug },
            { ...rest, featureIds: [...new Map((rest.featureIds ?? []).map((i) => [String(i), i])).values()], slug, serviceId: svc[service], platformId: platform ? plat[platform] : null, billingCycle: p.billingCycle ?? 'one-time', isActive: true },
        );
    };
    const without = (all: Types.ObjectId[], all2: Groups, drop: string[]) => {
        const names = Object.values(all2).flat();
        return all.filter((_, i) => !drop.includes(names[i]!));
    };

    // ── Laravel e-commerce ──
    {
        const starter = await features('website-development', 'laravel', LARAVEL_STARTER);
        const proOnly = await features('website-development', 'laravel', LARAVEL_PRO_ONLY, 100);
        await pkg({
            service: 'website-development', platform: 'laravel', name: 'Starter', price: 30000, sortOrder: 1,
            description: 'Start selling online with a complete, budget-friendly e-commerce website.',
            bullets: ['Template-based design', 'Laravel + MySQL website', 'Cart, checkout & admin dashboard', '1 courier API integration', '12 months technical support'],
            featureIds: starter, supportPeriod: '12 Months',
            notes: ["Design policy: this package does not include a custom UI/UX or Figma design process. The client selects one design from Webbriks' template collection; the website is built with their logo, colors, banner and required content."],
        });
        await pkg({
            service: 'website-development', platform: 'laravel', name: 'Business Pro', badge: 'Best Value', price: 60000, sortOrder: 2,
            description: 'A fully customized e-commerce experience with powerful business automation.',
            bullets: ['Fully custom UI/UX (Figma)', 'Advanced fraud detection', '1-click courier integration', 'Messenger & WhatsApp automation', '12 months technical support'],
            featureIds: [...without(starter, LARAVEL_STARTER, LARAVEL_STARTER_ONLY), ...proOnly], supportPeriod: '12 Months',
            bestFor: 'Growing e-commerce brands, established online stores and businesses with high order volume that need advanced marketing and automation.',
        });
    }

    // ── Next.js / Node.js custom website ──
    {
        const starter = await features('website-development', 'next-js-node-js', NEXT_STARTER);
        const proOnly = await features('website-development', 'next-js-node-js', NEXT_PRO_ONLY, 100);
        const custom = await features('website-development', 'next-js-node-js', NEXT_CUSTOM, 200);
        const common = { service: 'website-development', platform: 'next-js-node-js', supportPeriod: '12 Months', supportInclusions: FREE_SUPPORT, additionalCharges: ADDITIONAL_CHARGES };
        await pkg({
            ...common, name: 'Starter', price: 60000, sortOrder: 1,
            description: 'A complete online store to start your e-commerce journey.',
            bullets: ['Fully custom UI/UX design', 'Cart, checkout & order management', '1 courier API integration', '1-year hosting + domain', '12 months technical support'],
            featureIds: starter,
            bestFor: 'New e-commerce entrepreneurs, small fashion brands and businesses moving from Facebook to their own website.',
        });
        await pkg({
            ...common, name: 'Business Pro', badge: 'Most Popular', price: 95000, sortOrder: 2,
            description: 'Everything you need to run, automate & grow your e-commerce business.',
            bullets: ['Premium custom UI/UX design', 'Advanced fraud detection', '1-click courier integration', 'Messenger & WhatsApp automation', 'Customer CRM & segmentation'],
            featureIds: [...without(starter, NEXT_STARTER, NEXT_STARTER_ONLY), ...proOnly],
        });
        await pkg({
            ...common, name: 'Custom Solution', price: null, sortOrder: 3,
            description: 'Built around your business — enterprise e-commerce, ERP, POS, AI & business automation.',
            bullets: ['Multi-warehouse & multi-store', 'POS & retail management', 'AI & automation', 'Enterprise finance & CRM', 'Custom integrations & security'],
            featureIds: custom,
            bestFor: 'Large businesses, retail chains, multi-branch operations and organizations that need special workflows and integrations.',
        });
    }

    // ── Other platform / mobile / web-app: custom quote only ──
    await pkg({ service: 'website-development', platform: 'other', name: 'Custom', price: null, sortOrder: 1, description: 'Tailored solution for unique requirements.', bullets: ['Fully customized features', 'Scalable architecture', 'Dedicated support', 'Flexible revisions'] });
    await pkg({ service: 'mobile-app-development', name: 'Custom', price: null, sortOrder: 1, description: 'Tailored solution for unique requirements.', bullets: ['iOS & Android', 'Scalable architecture', 'Dedicated support', 'Flexible revisions'] });
    await pkg({ service: 'web-application-custom', name: 'Custom', price: null, sortOrder: 1, description: 'Tailored solution for unique requirements.', bullets: ['Fully customized features', 'Scalable architecture', 'Dedicated support', 'Flexible revisions'] });

    // ── Shopify ──
    {
        const starter = await features('e-commerce-shopify', 'shopify', SHOPIFY_STARTER);
        const proOnly = await features('e-commerce-shopify', 'shopify', SHOPIFY_PRO_ONLY, 100);
        const common = { service: 'e-commerce-shopify', platform: 'shopify', supportPeriod: '12 Months', supportInclusions: FREE_SUPPORT, additionalCharges: ADDITIONAL_CHARGES };
        await pkg({
            ...common, name: 'Shopify Starter', price: 30000, sortOrder: 1,
            description: 'Start selling online with a professional Shopify store (for new & small businesses).',
            bullets: ['Webbriks-approved free theme', 'Theme customization & branding', 'Cart, checkout & product variants', 'Up to 30 initial product uploads', '12 months technical support'],
            featureIds: starter,
            bestFor: 'New entrepreneurs, Facebook sellers, small fashion brands & startups.',
            notes: ["Design policy: no separate custom UI/UX or Figma design in this package. The client is shown Webbriks' selected Shopify themes; branding and content customization follow the theme they choose."],
        });
        await pkg({
            ...common, name: 'Shopify Business Pro', badge: 'Most Popular', price: 60000, sortOrder: 2,
            description: 'A custom-designed Shopify store with smarter operations & advanced marketing tools.',
            bullets: ['Custom UI/UX & Shopify theme development', 'Advanced fraud detection setup', '1-click courier integration', 'Messenger & WhatsApp automation', 'Up to 100 initial product uploads'],
            featureIds: [...without(starter, SHOPIFY_STARTER, SHOPIFY_STARTER_ONLY), ...proOnly],
        });
    }

    // ── Performance marketing (monthly) ──
    {
        const ids = await features('performance-marketing', null, MARKETING);
        const common = {
            service: 'performance-marketing', billingCycle: 'monthly', featureIds: ids, additionalCharges: ['Advertising budget (not included)', 'Ad creative production — scriptwriting, product photography, video shooting, editing, models'],
            bullets: ['Marketing research & strategy', 'Meta Ads & Google Ads management', 'Creative strategy & direction', '8–12 social posts per month', 'Monthly content performance review'],
            notes: ['Advertising budget is not included.', "Creatives can be produced by the client's own team following Webbriks' creative direction, or by Webbriks' Creative Production Team hired separately (separate budget applies)."],
        };
        await pkg({ ...common, name: 'Starter Package', price: 15000, sortOrder: 1, description: 'Monthly ad spend below ৳5 lakh.' });
        await pkg({ ...common, name: 'Growth Package', price: 25000, sortOrder: 2, description: 'Monthly ad spend above ৳5 lakh.' });
    }

    // ── Product photography / reels / video (per-unit rates) ──
    await pkg({
        service: 'product-photography', name: 'Product Photography', price: 300, priceMax: 600, billingCycle: 'per-image', unitLabel: 'product', sortOrder: 1,
        description: 'BDT 300–600 per product — simpler products near 300–400, complex or time-intensive ones near 500–600.',
        bullets: ['4 edited photographs per product (different angles)', 'Image editing & retouching included', 'Final edited files delivered'],
        featureIds: await features('product-photography', null, PHOTO),
        notes: [PRODUCTION_WORKFLOW], additionalCharges: PRODUCTION_EXCLUSIONS,
    });
    const reelFeatures = await features('product-reels-video', null, REEL);
    await pkg({
        service: 'product-reels-video', name: 'Short-Form Product Reel', price: 600, priceMax: 1000, billingCycle: 'per-video', unitLabel: 'reel', sortOrder: 1,
        description: 'BDT 600–1,000 per reel — 1 edited reel, 15–30 seconds.',
        bullets: ['1 edited reel (15–30 seconds)', 'Editing & color polish included', 'Final edited files delivered'],
        featureIds: reelFeatures, notes: [PRODUCTION_WORKFLOW], additionalCharges: PRODUCTION_EXCLUSIONS,
    });
    await pkg({
        service: 'product-reels-video', name: 'Product Explainer / Ad Creative Video', price: 3000, priceMax: 6000, billingCycle: 'per-video', unitLabel: 'video', sortOrder: 2,
        description: 'BDT 3,000–6,000 per video — typically 30–60 seconds (up to ~70–80 seconds when agreed).',
        bullets: ['1 edited explainer / ad video (30–60 seconds)', 'Scripting & creative direction as scoped', 'Final edited files delivered'],
        featureIds: reelFeatures, notes: [PRODUCTION_WORKFLOW], additionalCharges: PRODUCTION_EXCLUSIONS,
    });
    await pkg({ service: 'photo-video-editing', name: 'Photo Editing', price: null, billingCycle: 'per-image', unitLabel: 'image', sortOrder: 1, description: 'Priced per image — enter the agreed rate.', bullets: ['Professional retouching', 'Color correction', 'Final edited files delivered'] });
    await pkg({ service: 'photo-video-editing', name: 'Video Editing', price: null, billingCycle: 'per-video', unitLabel: 'video', sortOrder: 2, description: 'Priced per video — enter the agreed rate.', bullets: ['Cutting & post-production', 'Color grading', 'Final edited files delivered'] });

    const [s, pl, pk, f] = await Promise.all([
        CatalogService.countDocuments(), CatalogPlatform.countDocuments(), CatalogPackage.countDocuments(), CatalogFeature.countDocuments(),
    ]);
    console.log(`Catalog ready: ${s} services, ${pl} platforms, ${pk} packages, ${f} features.`);
};

run()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());

import express, {
    type Application,
    type Response,
    type Request,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import envConfig from "./config/env.config.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { requireAuth } from "./middlewares/auth.middleware.js";
import { requestContextMiddleware } from "./middlewares/requestContext.middleware.js";
import router from "./routes/index.js";
import "./models/user.model.js";
import { stripeWebhook, paypalWebhook } from "./controllers/webhook.controller.js";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.js";

const { trusted_origins, client_url } = envConfig;

function buildCorsAllowedOrigins(): Set<string> {
    const set = new Set<string>();
    for (const o of trusted_origins.split(",").map((s) => s.trim()).filter(Boolean)) {
        set.add(o);
    }
    if (client_url?.trim()) set.add(client_url.trim());
    return set;
}

const corsAllowedOrigins = buildCorsAllowedOrigins();

const app: Application = express();

// Correlation IDs + request logging (must be early, also covers webhooks)
app.use(requestContextMiddleware);

app.use(
    cors({
        /**
         * Local browsers (localhost / 127.0.0.1, any port): always allow.
         * Otherwise `NODE_ENV=production` on a dev machine would block the SPA
         * on :3000 talking to the API on :5000 and `fetch` shows only "Failed to fetch".
         */
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (corsAllowedOrigins.has(origin)) {
                return callback(null, true);
            }
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
                return callback(null, true);
            }
            callback(null, false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
        exposedHeaders: ["Content-Disposition"],
    }),
);

app.all("/api/auth/{*any}", toNodeHandler(auth));

// SECURITY: Add security headers (cross-origin policy so SPA on another port can read API bodies)
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
);

// SECURITY: Global rate limiter
const globalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});
app.use(globalLimiter);

// ⚠️ WEBHOOKS MUST BE BEFORE express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/api/webhooks/paypal', express.json(), paypalWebhook);



app.use(express.json());

app.use(
    "/api",
    (req: Request, res: Response, next: any) => {
        // Allow public access to invitation validation and acceptance
        const isPublicInvitationRoute =
            (req.method === "GET" &&
                /^\/invitations\/[^/]+\/validate$/.test(req.path)) ||
            (req.method === "POST" &&
                /^\/invitations\/[^/]+\/accept$/.test(req.path));

        // Allow public access to metadata type routes
        const isPublicMetadataRoute =
            req.method === "GET" &&
            /^\/metadata\/type\/(department|designation)$/.test(req.path);

        // Allow public access to career routes
        const isPublicCareerRoute =
            (req.method === "GET" &&
                /^\/careers\/positions\/public/.test(req.path)) ||
            (req.method === "POST" &&
                req.path === "/careers/applications/public");

        // Allow public access to read invoice data (for payment portal)
        const isPublicInvoiceRoute =
            req.method === "GET" && /^\/invoices\/public\//.test(req.path);

        // Allow public access to quotation token routes (payment portal)
        const isPublicQuotationTokenRoute =
            (req.method === "GET" && /^\/quotations\/client\/[^/]+$/.test(req.path)) ||
            (req.method === "POST" && /^\/quotations\/client\/[^/]+\/accept$/.test(req.path)) ||
            (req.method === "POST" && /^\/quotations\/client\/[^/]+\/changes$/.test(req.path));

        // Allow public access to quotation payment token routes (payment portal)
        const isPublicQuotationPaymentTokenRoute =
            (req.method === "GET" && /^\/quotation-payments\/client\/[^/]+\/status$/.test(req.path)) ||
            (req.method === "POST" && /^\/quotation-payments\/client\/[^/]+\/(intent|capture|confirm)$/.test(req.path));

        // Public: Puppeteer PDF by quotation id (no session required)
        const isPublicQuotationPdfPuppeteerRoute =
            req.method === "GET" && /^\/quotations\/[^/]+\/pdf\/puppeteer$/.test(req.path);

        if (
            isPublicInvitationRoute ||
            isPublicMetadataRoute ||
            isPublicCareerRoute ||
            isPublicInvoiceRoute ||
            isPublicQuotationTokenRoute ||
            isPublicQuotationPaymentTokenRoute ||
            isPublicQuotationPdfPuppeteerRoute
        ) {
            return next();
        }

        return requireAuth(req, res, next);
    },
    router,
);

app.get("/", (_req: Request, res: Response) => {
    res.send("Agency SaaS API Running!");
});

// Centralized error handler
app.use(globalErrorHandler);

export default app;

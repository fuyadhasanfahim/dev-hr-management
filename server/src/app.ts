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
import router from "./routes/index.js";
import { stripeWebhook, paypalWebhook } from "./controllers/webhook.controller.js";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.js";

const { trusted_origins } = envConfig;

const app: Application = express();

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const origins = trusted_origins.split(",");
            if (origins.includes(origin)) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    }),
);

app.all("/api/auth/{*any}", toNodeHandler(auth));

// SECURITY: Add security headers
app.use(helmet());

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

        if (
            isPublicInvitationRoute ||
            isPublicMetadataRoute ||
            isPublicCareerRoute ||
            isPublicInvoiceRoute
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

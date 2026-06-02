import { GoogleGenAI } from '@google/genai';
import ServiceModel from '../models/service.model.js';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';

const SYSTEM_PROMPT = `You are the AI assistant for Web Briks LLC, a digital agency. Be friendly, concise (2-3 sentences max).

Services: Web Design, Web Development, Website Maintenance, SEO, Custom Solutions.
Pricing: Flexible (fixed, hourly, milestone). Don't quote specific prices — suggest requesting a quote.
Process: Consultation → Quotation → Design/Dev → Review → Launch & Support.
Don't promise timelines. Redirect off-topic questions politely.

CONSULTATION BOOKING:
When a customer wants a consultation/quote, collect their Name, Email, and Phone number one by one naturally.
Once you have all three plus a project description, set action to "book_consultation" and include their info in consultationData.

Respond ONLY with valid JSON (no markdown, no code fences):
{"reply":"your message","action":"continue","actionReason":"","consultationData":null}

Actions:
- "continue" (default)
- "create_ticket" (technical issues, bugs, complaints)
- "connect_live_support" (customer asks for human, billing disputes)
- "book_consultation" (when you have name + email + phone + project description)

For "book_consultation", set consultationData:
{"name":"John","email":"john@example.com","phone":"+1234567890","projectDescription":"Brief description","projectType":"Web Design"}

projectType must be one of: Web Design, Web Development, Website Maintenance, SEO, Custom Solutions.`;

interface ChatHistoryMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

interface ConsultationData {
    name: string;
    email: string;
    phone: string;
    projectDescription: string;
    projectType?: string;
}

interface AIChatResponse {
    reply: string;
    action: 'continue' | 'create_ticket' | 'connect_live_support' | 'book_consultation';
    actionReason?: string;
    consultationData?: ConsultationData | null;
}

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
    if (!ai) {
        const apiKey = envConfig.gemini_api_key;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
}

// Cache services context for 5 minutes
let servicesCache: { data: string; expires: number } | null = null;

async function getServicesContext(): Promise<string> {
    if (servicesCache && Date.now() < servicesCache.expires) {
        return servicesCache.data;
    }
    try {
        const services = await ServiceModel.find({ isActive: true })
            .select('name category pricingModel basePrice currency')
            .lean();
        if (services.length === 0) {
            servicesCache = { data: '', expires: Date.now() + 5 * 60 * 1000 };
            return '';
        }
        let ctx = '\nActive services: ';
        ctx += services.map((s) => `${s.name} (${s.category}, ${s.pricingModel}, $${s.basePrice} ${s.currency})`).join('; ');
        servicesCache = { data: ctx, expires: Date.now() + 5 * 60 * 1000 };
        return ctx;
    } catch {
        logger.warn('Failed to fetch services for AI context');
        return '';
    }
}

export async function processAIChat(
    userMessage: string,
    history: ChatHistoryMessage[],
): Promise<AIChatResponse> {
    const genAI = getAI();

    const servicesContext = await getServicesContext();
    const systemInstruction = SYSTEM_PROMPT + servicesContext;

    // Only send last 10 messages to keep context small and fast
    const recentHistory = history.slice(-10).map((msg) => ({
        role: msg.role,
        parts: msg.parts,
    }));

    let responseText = '';
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const chat = genAI.chats.create({
                model: 'gemini-3.5-flash',
                config: {
                    systemInstruction,
                    maxOutputTokens: 1024,
                    temperature: 0.5,
                },
                history: recentHistory,
            });

            const result = await chat.sendMessage({ message: userMessage });
            responseText = (result.text ?? '').trim();
            break;
        } catch (err: any) {
            const status = err.status ?? err.statusCode ?? 0;
            logger.error(`Gemini API attempt ${attempt + 1} failed: [${status}] ${err.message}`);
            const retryableStatus = [429, 500, 502, 503, 504].includes(status);
            const retryableMessage = /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|quota|INTERNAL|rate.limit|capacity/i.test(err.message);
            const isRetryable = retryableStatus || retryableMessage || err.name === 'APIConnectionError' || err.name === 'APIConnectionTimeoutError';
            if (!isRetryable || attempt === 2) throw err;
            const delay = 1000 * Math.pow(2, attempt);
            logger.warn(`Retryable error (status=${status}), retrying in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    try {
        const cleaned = responseText
            .replace(/^```json?\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
        const parsed = JSON.parse(cleaned) as AIChatResponse;

        if (!parsed.reply || !parsed.action) {
            throw new Error('Invalid AI response structure');
        }

        const validActions = ['continue', 'create_ticket', 'connect_live_support', 'book_consultation'];
        if (!validActions.includes(parsed.action)) {
            parsed.action = 'continue';
        }

        return parsed;
    } catch {
        return {
            reply: responseText || "I'm sorry, could you try rephrasing?",
            action: 'continue',
        };
    }
}

export async function getWebBriksInfo(): Promise<{
    about: string;
    services: any[];
    pricing: string;
    process: string[];
    supportOptions: string[];
}> {
    const services = await ServiceModel.find({ isActive: true }).lean();

    return {
        about: 'Web Briks LLC is a full-service digital agency specializing in web design, web development, website maintenance, SEO, and custom digital solutions.',
        services: services.map((s) => ({
            name: s.name,
            category: s.category,
            pricingModel: s.pricingModel,
            basePrice: s.basePrice,
            currency: s.currency,
            description: s.description,
        })),
        pricing: 'We offer flexible pricing: Fixed price, Hourly rates, and Milestone-based billing.',
        process: [
            'Consultation → Quotation → Design/Dev → Review → Launch & Support',
        ],
        supportOptions: [
            'Live Chat', 'Support Tickets', 'AI Assistant',
        ],
    };
}

export default {
    processAIChat,
    getWebBriksInfo,
};

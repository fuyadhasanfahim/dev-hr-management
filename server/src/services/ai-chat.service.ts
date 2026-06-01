import { GoogleGenAI } from '@google/genai';
import ServiceModel from '../models/service.model.js';
import { logger } from '../lib/logger.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const WEBBRIKS_CONTEXT = `
You are the AI support assistant for **Web Briks LLC**, a professional digital agency.
You help website visitors with questions about our services, pricing, and processes.
You are friendly, professional, and concise.

## About Web Briks LLC
Web Briks LLC is a full-service digital agency that helps businesses grow online.
We specialize in web design, web development, website maintenance, SEO, and custom digital solutions.
We serve clients globally and pride ourselves on delivering high-quality, affordable services.

## Our Core Services

### 1. Web Design
- Custom website design (UI/UX)
- Landing page design
- E-commerce store design
- Responsive & mobile-first design
- Redesign & modernization of existing websites
- Figma/Adobe XD mockups and prototyping

### 2. Web Development
- Custom website development (React, Next.js, WordPress, Shopify)
- Full-stack web application development
- E-commerce development (Shopify, WooCommerce)
- API development and integration
- CMS development
- Progressive Web Apps (PWA)

### 3. Website Maintenance
- Regular updates & security patches
- Performance monitoring & optimization
- Content updates
- Bug fixes & troubleshooting
- Backup management
- Uptime monitoring

### 4. SEO (Search Engine Optimization)
- On-page SEO optimization
- Off-page SEO & link building
- Technical SEO audit
- Keyword research & strategy
- Local SEO
- SEO content writing
- Google Analytics & Search Console setup

### 5. Custom Services
- Custom software solutions
- Third-party API integrations
- Database design & management
- Cloud hosting setup & management
- Consultation & strategy

## Pricing
- We offer flexible pricing: **Fixed price**, **Hourly rates**, and **Milestone-based** billing.
- Pricing depends on the scope and complexity of the project.
- We provide free quotations — customers can request a quote for any service.
- For maintenance, we offer monthly retainer packages.

## Process
1. **Consultation** — We discuss your needs and goals.
2. **Quotation** — We provide a detailed quote with timeline.
3. **Design/Development** — Our team works on your project with regular updates.
4. **Review & Feedback** — You review the work and provide feedback.
5. **Launch & Support** — We launch and provide ongoing support.

## Support Options
- **Live Chat** — Talk to a human support agent in real-time.
- **Support Tickets** — Submit a ticket and get a response via email.
- **Email** — Reach us at our support email.

## Important Guidelines for the AI:
- Answer questions about our services, pricing model, and process clearly.
- If a customer wants to get a price quote, suggest they request a quotation through our system.
- If a customer has a technical issue with an existing project, offer to create a support ticket.
- If a customer wants to speak with a human, offer to connect them to live support.
- Do NOT make up specific prices — say pricing depends on project scope and suggest getting a quote.
- Do NOT promise delivery timelines — say it depends on the project and a quote will include timeline.
- Keep responses concise (2-4 sentences when possible).
- If a question is outside your knowledge (not about Web Briks services), politely redirect.
`;

interface ChatHistoryMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

interface AIChatResponse {
    reply: string;
    action: 'continue' | 'create_ticket' | 'connect_live_support';
    actionReason?: string;
}

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
    if (!ai) {
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    }
    return ai;
}

async function getServicesContext(): Promise<string> {
    try {
        const services = await ServiceModel.find({ isActive: true }).lean();
        if (services.length === 0) return '';

        let ctx = '\n## Currently Active Services (from database):\n';
        for (const svc of services) {
            ctx += `- **${svc.name}** (${svc.category}) — ${svc.pricingModel} pricing, base price: $${svc.basePrice} ${svc.currency}`;
            if (svc.description) ctx += ` — ${svc.description}`;
            ctx += '\n';
        }
        return ctx;
    } catch (err) {
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

    const systemInstruction = `${WEBBRIKS_CONTEXT}${servicesContext}

## Response Format
You MUST respond with valid JSON only. No markdown, no code fences, no extra text.
The JSON must have exactly these fields:
{
  "reply": "Your response message to the customer",
  "action": "continue | create_ticket | connect_live_support",
  "actionReason": "Brief reason if action is not continue"
}

## When to use each action:
- **continue**: Default. Keep chatting, answer questions, provide info.
- **create_ticket**: When the customer has a specific technical issue, bug report, complaint, or needs follow-up that requires tracking. Also use when the customer explicitly asks to create a ticket.
- **connect_live_support**: When the customer explicitly asks to talk to a human, or when the conversation requires complex negotiation, billing disputes, or sensitive matters that AI cannot handle well.

Always set action to "continue" unless there is a clear reason to escalate.`;

    const chatContents = history.map((msg) => ({
        role: msg.role,
        parts: msg.parts,
    }));

    const chat = genAI.chats.create({
        model: 'gemini-3.5-flash',
        config: { systemInstruction },
        history: chatContents,
    });

    const result = await chat.sendMessage({ message: userMessage });
    const responseText = (result.text ?? '').trim();

    try {
        const cleaned = responseText
            .replace(/^```json?\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
        const parsed = JSON.parse(cleaned) as AIChatResponse;

        if (!parsed.reply || !parsed.action) {
            throw new Error('Invalid AI response structure');
        }

        if (
            !['continue', 'create_ticket', 'connect_live_support'].includes(
                parsed.action,
            )
        ) {
            parsed.action = 'continue';
        }

        return parsed;
    } catch {
        return {
            reply:
                responseText ||
                "I'm sorry, I couldn't process that. Could you try rephrasing?",
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
        pricing:
            'We offer flexible pricing: Fixed price, Hourly rates, and Milestone-based billing. Pricing depends on the scope and complexity of the project.',
        process: [
            'Consultation — We discuss your needs and goals',
            'Quotation — We provide a detailed quote with timeline',
            'Design/Development — Our team works on your project with regular updates',
            'Review & Feedback — You review the work and provide feedback',
            'Launch & Support — We launch and provide ongoing support',
        ],
        supportOptions: [
            'Live Chat — Talk to a human support agent in real-time',
            'Support Tickets — Submit a ticket and get a response via email',
            'AI Assistant — Get instant answers about our services',
        ],
    };
}

export default {
    processAIChat,
    getWebBriksInfo,
};

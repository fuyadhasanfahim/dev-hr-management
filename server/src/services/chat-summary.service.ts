import { GoogleGenAI } from '@google/genai';
import ChatSessionModel from '../models/chat-session.model.js';
import ChatMessageModel from '../models/chat-message.model.js';
import { sendMail } from '../lib/nodemailer.js';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';

const SUMMARY_SYSTEM_PROMPT =
    'Summarize this customer support conversation in 3-5 sentences: what the customer needed, what was discussed, and the outcome/resolution. Plain text, no markdown, neutral tone.';

// Lazy Gemini client (mirrors ai-chat.service.ts getAI()).
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** "YYYY-MM-DD HH:MM:SS" (server local time). */
function formatTimestamp(d: Date): string {
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
}

function escapeHtml(str: string): string {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Email-facing sender label: "You" for the visitor, agent name for staff. */
function emailSenderLabel(senderModel: string, agentName: string): string {
    if (senderModel === 'Staff') return agentName || 'Support';
    if (senderModel === 'System') return 'System';
    return 'You';
}

/** AI-facing sender label (clearer than "You" for the model). */
function aiSenderLabel(senderModel: string, agentName: string): string {
    if (senderModel === 'Staff') return agentName || 'Support';
    if (senderModel === 'System') return 'System';
    return 'Customer';
}

interface TranscriptMessage {
    senderModel: string;
    senderName?: string;
    content: string;
    createdAt: Date;
}

// ─── summary ──────────────────────────────────────────────────────────────────

/**
 * Generates a short AI summary of a support conversation transcript.
 * Best-effort: never throws — returns a safe fallback on any failure.
 */
export async function generateChatSummary(transcript: string): Promise<string> {
    try {
        if (!transcript.trim()) return 'Summary unavailable.';

        const genAI = getAI();
        const chat = genAI.chats.create({
            model: 'gemini-3.5-flash',
            config: {
                systemInstruction: SUMMARY_SYSTEM_PROMPT,
                maxOutputTokens: 256,
                temperature: 0.3,
            },
        });

        const result = await chat.sendMessage({ message: transcript });
        const text = (result.text ?? '').trim();
        return text || 'Summary unavailable.';
    } catch (err: any) {
        logger.error(`[Chat Summary] Failed to generate summary: ${err.message}`);
        return 'Summary unavailable.';
    }
}

// ─── email html ───────────────────────────────────────────────────────────────

/**
 * Builds the resolution-summary email HTML (inline styles, no external CSS).
 */
export function buildResolutionEmailHtml(args: {
    visitorName?: string;
    agentName: string;
    resolvedAt: Date;
    summary: string;
    messages: TranscriptMessage[];
}): string {
    const { visitorName, agentName, resolvedAt, summary, messages } = args;

    const greetingName = escapeHtml(visitorName?.trim() || 'there');
    const resolvedReadable = resolvedAt.toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'long',
    });

    const transcriptRows = messages
        .map((m) => {
            const ts = formatTimestamp(new Date(m.createdAt));
            const who = escapeHtml(emailSenderLabel(m.senderModel, agentName));
            const body = escapeHtml(m.content);
            const isSystem = m.senderModel === 'System';
            return (
                `<tr>` +
                `<td style="padding:6px 10px;vertical-align:top;white-space:nowrap;font-family:'Courier New',monospace;font-size:12px;color:#94a3b8;">[${ts}]</td>` +
                `<td style="padding:6px 10px;vertical-align:top;font-size:13px;color:${isSystem ? '#64748b' : '#0f172a'};">` +
                `<strong style="color:${isSystem ? '#64748b' : '#1e293b'};">${who}:</strong> ${isSystem ? `<em>${body}</em>` : body}` +
                `</td>` +
                `</tr>`
            );
        })
        .join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6A25E0,#390CA4);padding:20px 24px;">
        <h1 style="margin:0;font-size:18px;color:#ffffff;font-weight:700;">Web Briks Support</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#e9d5ff;">Conversation resolved</p>
      </div>

      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Hi ${greetingName},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155;">
          Your support conversation was marked as resolved by
          <strong>${escapeHtml(agentName)}</strong> on
          <strong>${escapeHtml(resolvedReadable)}</strong>.
        </p>

        <div style="margin:0 0 20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#6A25E0;">Summary</h2>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(summary)}</p>
        </div>

        <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#6A25E0;">Full Transcript</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          ${transcriptRows || '<tr><td style="padding:10px;font-size:13px;color:#94a3b8;">No messages.</td></tr>'}
        </table>
      </div>

      <div style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
          This is an automated record of your conversation, sent for your reference.
          Please keep it for your records. — Web Briks LLC
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── orchestration ────────────────────────────────────────────────────────────

/**
 * Sends a one-off resolution-summary email to the visitor of a closed session.
 * Best-effort and fully non-throwing — any failure is logged and swallowed.
 */
export async function sendResolutionEmail(
    sessionId: string,
    agentName: string,
): Promise<void> {
    try {
        const session = (await ChatSessionModel.findOne({ sessionId })
            .populate('clientId', 'name email')
            .populate('guestId', 'name email')) as any;

        if (!session) {
            logger.warn(`[Resolution Email] Session not found: ${sessionId}`);
            return;
        }

        const visitor = session.clientId ?? session.guestId;
        const visitorEmail: string | undefined = visitor?.email;
        const visitorName: string | undefined = visitor?.name;

        if (!visitorEmail) {
            logger.info(
                `[Resolution Email] No resolvable email for session ${sessionId} — skipping.`,
            );
            return;
        }

        const messages = (await ChatMessageModel.find({ sessionId: session._id }).sort({
            createdAt: 1,
        })) as any[];

        const resolvedAt = new Date();

        // Plain-text transcript for the AI summary.
        const aiTranscript = messages
            .map(
                (m) =>
                    `[${formatTimestamp(new Date(m.createdAt))}] ${aiSenderLabel(
                        m.senderModel,
                        agentName,
                    )}: ${m.content}`,
            )
            .join('\n');

        const summary = await generateChatSummary(aiTranscript);

        const html = buildResolutionEmailHtml({
            visitorName,
            agentName,
            resolvedAt,
            summary,
            messages: messages.map((m) => ({
                senderModel: m.senderModel,
                senderName: m.senderName,
                content: m.content,
                createdAt: m.createdAt,
            })),
        });

        const subjectDate = resolvedAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        await sendMail({
            to: visitorEmail,
            subject: `Your Web Briks support conversation (resolved ${subjectDate})`,
            body: html,
        });

        logger.info(
            `[Resolution Email] Sent to ${visitorEmail} for session ${sessionId}.`,
        );
    } catch (err: any) {
        logger.error(
            `[Resolution Email] Failed for session ${sessionId}: ${err.message}`,
        );
    }
}

export default {
    generateChatSummary,
    buildResolutionEmailHtml,
    sendResolutionEmail,
};

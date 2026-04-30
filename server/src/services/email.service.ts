import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import { OrderExportEmail } from '../templates/OrderExportEmail.js';
import { VerificationEmail } from '../templates/VerificationEmail.js';
import { ResetPasswordEmail } from '../templates/ResetPasswordEmail.js';
import { InvitationEmail } from '../templates/InvitationEmail.js';
import { ApplicationStatusEmail } from '../templates/ApplicationStatusEmail.js';
import { OrderStatusUpdateEmail } from '../templates/OrderStatusUpdateEmail.js';
import { AdminPaymentEmail } from '../templates/AdminPaymentEmail.js';
import { QuotationEmail, type PaymentPhaseEmailInfo, type QuotationMilestoneEmailInfo } from '../templates/QuotationEmail.js';
import { QuotationPaymentReceiptEmail } from '../templates/QuotationPaymentReceiptEmail.js';
import { QuotationPaymentAdminEmail } from '../templates/QuotationPaymentAdminEmail.js';
import * as React from 'react';
import envConfig from '../config/env.config.js';

const transporter = nodemailer.createTransport({
    host: envConfig.smtp_host,
    port: envConfig.smtp_port,
    secure: envConfig.smtp_secure === 'true',
    auth: {
        user: envConfig.smtp_user,
        pass: envConfig.smtp_pass,
    },
    tls: {
        rejectUnauthorized: false,
    },
});

interface SendInvoiceData {
    to: string;
    clientName: string;
    month: string;
    year: string;
    invoiceUrl?: string;
    attachment: {
        filename: string;
        content: Buffer;
        contentType: string;
    };
}

const sendInvoiceEmail = async (data: SendInvoiceData) => {
    try {
        const emailHtml = await render(
            React.createElement(OrderExportEmail, {
                clientName: data.clientName as string,
                month: data.month as string,
                year: data.year as string,
                invoiceUrl: data.invoiceUrl as string,
            }),
        );

        const mailOptions = {
            from: 'Invoice | WebBriks',
            to: data.to,
            subject: `Invoice for ${data.month} ${data.year} - WebBriks`,
            html: emailHtml,
            attachments: [
                {
                    filename: data.attachment.filename,
                    content: data.attachment.content,
                    contentType: data.attachment.contentType,
                },
            ],
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending invoice email:', error);
        throw error;
    }
};

interface SendPinResetData {
    to: string;
    staffName: string;
    resetUrl: string;
}

const sendPinResetEmail = async (data: SendPinResetData) => {
    try {
        const { PinResetEmail } = await import('../templates/PinResetEmail.js');
        const emailHtml = await render(
            React.createElement(PinResetEmail, {
                staffName: data.staffName,
                resetUrl: data.resetUrl,
            }),
        );

        const mailOptions = {
            from: 'HR Management | WebBriks',
            to: data.to,
            subject: 'Reset your Salary PIN - WebBriks',
            html: emailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending PIN reset email:', error);
        throw error;
    }
};

interface SendOrderStatusData {
    to: string;
    clientName: string;
    orderName: string;
    status: string;
    message: string;
    paymentLink?: string | undefined;
}

const sendOrderStatusEmail = async (data: SendOrderStatusData) => {
    try {
        const emailHtml = await render(
            React.createElement(OrderStatusUpdateEmail, {
                clientName: data.clientName,
                orderName: data.orderName,
                status: data.status,
                message: data.message,
                paymentLink: data.paymentLink,
            }),
        );

        const mailOptions = {
            from: 'HR Management | WebBriks',
            to: data.to,
            subject: `Order Update: ${data.orderName} (${data.status})`,
            html: emailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending order status email:', error);
        throw error;
    }
};

interface SendVerificationData {
    to: string;
    userName: string;
    verificationUrl: string;
}

const sendVerificationEmail = async (data: SendVerificationData) => {
    try {
        const emailHtml = await render(
            React.createElement(VerificationEmail, {
                userName: data.userName,
                verificationUrl: data.verificationUrl,
            }),
        );

        const mailOptions = {
            from: 'HR Management | WebBriks',
            to: data.to,
            subject: 'Verify Your Email - WebBriks',
            html: emailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
    }
};

interface SendResetPasswordData {
    to: string;
    userName: string;
    resetPasswordUrl: string;
}

const sendResetPasswordEmail = async (data: SendResetPasswordData) => {
    try {
        const emailHtml = await render(
            React.createElement(ResetPasswordEmail, {
                userName: data.userName,
                resetPasswordUrl: data.resetPasswordUrl,
            }),
        );

        const mailOptions = {
            from: 'HR Management | WebBriks',
            to: data.to,
            subject: 'Reset Your Password - WebBriks',
            html: emailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending reset password email:', error);
        throw error;
    }
};

interface SendInvitationData {
    to: string;
    designation: string;
    department: string;
    salary: number;
    signupUrl: string;
    isReminder?: boolean;
}

const sendInvitationEmail = async (data: SendInvitationData) => {
    try {
        const emailHtml = await render(
            React.createElement(InvitationEmail, {
                designation: data.designation,
                department: data.department,
                salary: data.salary,
                signupUrl: data.signupUrl,
                isReminder: data.isReminder || false,
            }),
        );

        const mailOptions = {
            from: 'HR Management | WebBriks',
            to: data.to,
            subject: data.isReminder
                ? 'Reminder: Complete Your Registration - WebBriks'
                : "You're Invited to Join Our Team - WebBriks",
            html: emailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending invitation email:', error);
        throw error;
    }
};

interface SendQuotationEmailData {
    to: string;
    clientName: string;
    quotationTitle: string;
    quotationNumber: string;
    clientLink: string;
    validUntil?: string;
    /** Formatted grand total, e.g. "$1,250.00". Always shown when provided. */
    totalAmountFormatted?: string;
    milestones?: QuotationMilestoneEmailInfo[];
    hasPdfAttachment?: boolean;
    /** Present when resending to a client who has already accepted — triggers reminder mode. */
    paymentPhases?: PaymentPhaseEmailInfo[];
    /** Formatted remaining amount, e.g. "$500.00" */
    remainingAmountFormatted?: string;
    attachment?: {
        filename: string;
        content: Buffer;
        contentType: string;
    };
}

const sendQuotationEmail = async (data: SendQuotationEmailData) => {
    try {
        const emailHtml = await render(
            React.createElement(QuotationEmail, {
                clientName: data.clientName,
                quotationTitle: data.quotationTitle,
                quotationNumber: data.quotationNumber,
                clientLink: data.clientLink,
                ...(data.validUntil ? { validUntil: data.validUntil } : {}),
                ...(data.totalAmountFormatted
                    ? { totalAmountFormatted: data.totalAmountFormatted }
                    : {}),
                ...(data.milestones ? { milestones: data.milestones } : {}),
                ...(data.hasPdfAttachment ? { hasPdfAttachment: true } : {}),
                ...(data.paymentPhases ? { paymentPhases: data.paymentPhases } : {}),
                ...(data.remainingAmountFormatted
                    ? { remainingAmountFormatted: data.remainingAmountFormatted }
                    : {}),
            }),
        );

        const isReminder = Boolean(data.paymentPhases && data.paymentPhases.length > 0);
        const mailOptions = {
            from: 'Quotation | WebBriks',
            to: data.to,
            subject: isReminder
                ? `Payment reminder — Quotation ${data.quotationNumber} (${data.remainingAmountFormatted ?? 'balance'} remaining)`
                : `Quotation ${data.quotationNumber} — ${data.quotationTitle}`,
            html: emailHtml,
            ...(data.attachment
                ? {
                      attachments: [
                          {
                              filename: data.attachment.filename,
                              content: data.attachment.content,
                              contentType: data.attachment.contentType,
                          },
                      ],
                  }
                : {}),
        };

        const info = await transporter.sendMail(mailOptions);
        // Helpful runtime signal for delivery troubleshooting.
        // (Do not include full html or attachment bytes in logs.)
        console.log('[email] quotation sent', {
            to: data.to,
            messageId: (info as any)?.messageId,
            accepted: (info as any)?.accepted,
            hasAttachment: Boolean(data.attachment),
            attachmentBytes: data.attachment?.content?.length,
        });
        return info;
    } catch (error) {
        console.error('Error sending quotation email:', error);
        throw error;
    }
};

interface SendApplicationStatusData {
    to: string;
    applicantName: string;
    positionTitle: string;
    status: any;
}

const sendApplicationStatusEmail = async (data: SendApplicationStatusData) => {
    try {
        const emailHtml = await render(
            React.createElement(ApplicationStatusEmail, {
                applicantName: data.applicantName,
                positionTitle: data.positionTitle,
                status: data.status,
            }),
        );

        const mailOptions = {
            from: 'HR Management | WebBriks',
            to: data.to,
            subject: 'Application Update - WebBriks',
            html: emailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending application status email:', error);
        throw error;
    }
};

interface SendAdminPaymentData {
    to: string;
    clientName: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    earningsUrl: string;
}

const sendAdminPaymentEmail = async (data: SendAdminPaymentData) => {
    try {
        const emailHtml = await render(
            React.createElement(AdminPaymentEmail, {
                clientName: data.clientName,
                invoiceNumber: data.invoiceNumber,
                amount: data.amount,
                currency: data.currency,
                earningsUrl: data.earningsUrl,
            }),
        );

        const mailOptions = {
            from: 'Payment - HR Management | WebBriks',
            to: data.to,
            subject: `Payment Received from ${data.clientName}`,
            html: emailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Error sending admin payment notification:', error);
        throw error;
    }
};

interface SendQuotationPaymentReceiptData {
    to: string;
    clientName: string;
    quotationNumber: string;
    phase: string;
    amountCents: number;
    currency: string;
    referenceId: string;
    provider: string;
    paidAt: Date;
}

const sendQuotationPaymentReceiptEmail = async (data: SendQuotationPaymentReceiptData) => {
    const emailHtml = await render(
        React.createElement(QuotationPaymentReceiptEmail, {
            clientName: data.clientName,
            quotationNumber: data.quotationNumber,
            phase: data.phase,
            amountCents: data.amountCents,
            currency: data.currency,
            referenceId: data.referenceId,
            provider: data.provider,
            paidAt: data.paidAt,
        }),
    );

    const mailOptions = {
        from: 'Payment receipt | WebBriks',
        to: data.to,
        subject: `Payment receipt — ${data.quotationNumber} (${data.phase})`,
        html: emailHtml,
    };

    return await transporter.sendMail(mailOptions);
};

interface SendQuotationPaymentAdminData {
    to: string;
    clientName: string;
    quotationNumber: string;
    phase: string;
    amountCents: number;
    currency: string;
    referenceId: string;
    provider: string;
    paidAt: Date;
}

const sendQuotationPaymentAdminEmail = async (data: SendQuotationPaymentAdminData) => {
    const emailHtml = await render(
        React.createElement(QuotationPaymentAdminEmail, {
            clientName: data.clientName,
            quotationNumber: data.quotationNumber,
            phase: data.phase,
            amountCents: data.amountCents,
            currency: data.currency,
            referenceId: data.referenceId,
            provider: data.provider,
            paidAt: data.paidAt,
            ordersUrl: `${envConfig.client_url}/orders`,
        }),
    );

    const mailOptions = {
        from: 'Payment received | WebBriks',
        to: data.to,
        subject: `Payment received — ${data.quotationNumber} (${data.phase})`,
        html: emailHtml,
    };

    return await transporter.sendMail(mailOptions);
};

// ─── Meeting Emails ───────────────────────────────────────────────────────────

interface SendMeetingInviteData {
    to: string;
    clientName: string;
    meetingTitle: string;
    scheduledAt: string;
    durationMinutes: number;
    meetLink: string;
    description: string;
}

const sendMeetingInviteEmail = async (data: SendMeetingInviteData) => {
    const meetSection = data.meetLink
        ? `<p style="margin:16px 0"><a href="${data.meetLink}" style="background:#1a73e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Join Google Meet</a></p><p style="font-size:13px;color:#666">Or paste: ${data.meetLink}</p>`
        : '';

    const html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
            <div style="background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
                <h2 style="color:#1e293b;margin:0 0 8px">📅 Meeting Scheduled</h2>
                <p style="color:#64748b;margin:0 0 24px">You have a meeting with WebBriks</p>
                <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
                    <tr><td style="padding:8px 0;color:#64748b;width:120px">Title</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${data.meetingTitle}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Client</td><td style="padding:8px 0;color:#1e293b">${data.clientName}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">When</td><td style="padding:8px 0;color:#1e293b">${data.scheduledAt}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Duration</td><td style="padding:8px 0;color:#1e293b">${data.durationMinutes} minutes</td></tr>
                    ${data.description ? `<tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Details</td><td style="padding:8px 0;color:#1e293b">${data.description}</td></tr>` : ''}
                </table>
                ${meetSection}
            </div>
        </div>`;

    return await transporter.sendMail({
        from: 'Meetings | WebBriks',
        to: data.to,
        subject: `Meeting: ${data.meetingTitle} — ${data.scheduledAt}`,
        html,
    });
};

interface SendMeetingReminderData {
    to: string;
    clientName: string;
    meetingTitle: string;
    scheduledAt: string;
    meetLink: string;
}

const sendMeetingReminderEmail = async (data: SendMeetingReminderData) => {
    const meetSection = data.meetLink
        ? `<p style="margin:16px 0"><a href="${data.meetLink}" style="background:#1a73e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Join Google Meet Now</a></p>`
        : '';

    const html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fffbeb;border-radius:12px">
            <div style="background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
                <h2 style="color:#92400e;margin:0 0 8px">⏰ Meeting Reminder — 30 Minutes</h2>
                <p style="color:#64748b;margin:0 0 24px">Your meeting is starting soon!</p>
                <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
                    <tr><td style="padding:8px 0;color:#64748b;width:120px">Title</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${data.meetingTitle}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Client</td><td style="padding:8px 0;color:#1e293b">${data.clientName}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">When</td><td style="padding:8px 0;color:#1e293b">${data.scheduledAt}</td></tr>
                </table>
                ${meetSection}
            </div>
        </div>`;

    return await transporter.sendMail({
        from: 'Meetings | WebBriks',
        to: data.to,
        subject: `⏰ Reminder: ${data.meetingTitle} starts in 30 minutes`,
        html,
    });
};

interface SendMeetingCancellationData {
    to: string;
    clientName: string;
    meetingTitle: string;
    scheduledAt: string;
}

const sendMeetingCancellationEmail = async (data: SendMeetingCancellationData) => {
    const html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fef2f2;border-radius:12px">
            <div style="background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
                <h2 style="color:#991b1b;margin:0 0 8px">❌ Meeting Cancelled</h2>
                <p style="color:#64748b;margin:0 0 24px">The following meeting has been cancelled.</p>
                <table style="width:100%;border-collapse:collapse">
                    <tr><td style="padding:8px 0;color:#64748b;width:120px">Title</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${data.meetingTitle}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Client</td><td style="padding:8px 0;color:#1e293b">${data.clientName}</td></tr>
                    <tr><td style="padding:8px 0;color:#64748b">Was scheduled</td><td style="padding:8px 0;color:#1e293b">${data.scheduledAt}</td></tr>
                </table>
            </div>
        </div>`;

    return await transporter.sendMail({
        from: 'Meetings | WebBriks',
        to: data.to,
        subject: `Meeting Cancelled: ${data.meetingTitle}`,
        html,
    });
};

export default {
    sendInvoiceEmail,
    sendPinResetEmail,
    sendOrderStatusEmail,
    sendVerificationEmail,
    sendResetPasswordEmail,
    sendInvitationEmail,
    sendQuotationEmail,
    sendApplicationStatusEmail,
    sendAdminPaymentEmail,
    sendQuotationPaymentReceiptEmail,
    sendQuotationPaymentAdminEmail,
    sendMeetingInviteEmail,
    sendMeetingReminderEmail,
    sendMeetingCancellationEmail,
};


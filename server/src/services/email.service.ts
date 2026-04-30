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
};

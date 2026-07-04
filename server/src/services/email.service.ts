import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import { OrderExportEmail } from '../templates/OrderExportEmail.js';
import { VerificationEmail } from '../templates/VerificationEmail.js';
import { ResetPasswordEmail } from '../templates/ResetPasswordEmail.js';
import { InvitationEmail } from '../templates/InvitationEmail.js';
import { ApplicationStatusEmail } from '../templates/ApplicationStatusEmail.js';
import { OrderStatusUpdateEmail } from '../templates/OrderStatusUpdateEmail.js';
import { QuotationEmail, type QuotationMilestoneEmailInfo } from '../templates/QuotationEmail.js';
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
}

const sendOrderStatusEmail = async (data: SendOrderStatusData) => {
    try {
        const emailHtml = await render(
            React.createElement(OrderStatusUpdateEmail, {
                clientName: data.clientName,
                orderName: data.orderName,
                status: data.status,
                message: data.message,
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
    clientLink?: string;
    validUntil?: string;
    /** Formatted grand total, e.g. "$1,250.00". Always shown when provided. */
    totalAmountFormatted?: string;
    milestones?: QuotationMilestoneEmailInfo[];
    hasPdfAttachment?: boolean;
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
                ...(data.clientLink ? { clientLink: data.clientLink } : {}),
                ...(data.validUntil ? { validUntil: data.validUntil } : {}),
                ...(data.totalAmountFormatted
                    ? { totalAmountFormatted: data.totalAmountFormatted }
                    : {}),
                ...(data.milestones ? { milestones: data.milestones } : {}),
                ...(data.hasPdfAttachment ? { hasPdfAttachment: true } : {}),
            }),
        );

        const mailOptions = {
            from: 'Quotation | WebBriks',
            to: data.to,
            subject: `Quotation ${data.quotationNumber} — ${data.quotationTitle}`,
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


// ─── Meeting Emails ───────────────────────────────────────────────────────────

import { MeetingInviteEmail } from '../templates/MeetingInviteEmail.js';
import { MeetingReminderEmail } from '../templates/MeetingReminderEmail.js';
import { MeetingCancellationEmail } from '../templates/MeetingCancellationEmail.js';

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
    try {
        const emailHtml = await render(
            React.createElement(MeetingInviteEmail, {
                clientName: data.clientName,
                meetingTitle: data.meetingTitle,
                scheduledAt: data.scheduledAt,
                durationMinutes: data.durationMinutes,
                meetLink: data.meetLink,
                description: data.description,
            }),
        );

        return await transporter.sendMail({
            from: 'Meetings | WebBriks',
            to: data.to,
            subject: `Meeting Scheduled: ${data.meetingTitle} — ${data.scheduledAt}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Error sending meeting invite email:', error);
        throw error;
    }
};

interface SendMeetingReminderData {
    to: string;
    clientName: string;
    meetingTitle: string;
    scheduledAt: string;
    durationMinutes: number;
    meetLink: string;
}

const sendMeetingReminderEmail = async (data: SendMeetingReminderData) => {
    try {
        const emailHtml = await render(
            React.createElement(MeetingReminderEmail, {
                clientName: data.clientName,
                meetingTitle: data.meetingTitle,
                scheduledAt: data.scheduledAt,
                durationMinutes: data.durationMinutes,
                meetLink: data.meetLink,
            }),
        );

        return await transporter.sendMail({
            from: 'Meetings | WebBriks',
            to: data.to,
            subject: `⏰ Reminder: ${data.meetingTitle} starts soon`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Error sending meeting reminder email:', error);
        throw error;
    }
};

interface SendMeetingCancellationData {
    to: string;
    clientName: string;
    meetingTitle: string;
    scheduledAt: string;
    isAdmin?: boolean;
}

const sendMeetingCancellationEmail = async (data: SendMeetingCancellationData) => {
    try {
        const emailHtml = await render(
            React.createElement(MeetingCancellationEmail, {
                clientName: data.clientName,
                meetingTitle: data.meetingTitle,
                scheduledAt: data.scheduledAt,
                isAdmin: data.isAdmin || false,
            }),
        );

        return await transporter.sendMail({
            from: 'Meetings | WebBriks',
            to: data.to,
            subject: data.isAdmin 
                ? `Notice: Meeting Cancelled by Client/System - ${data.meetingTitle}`
                : `Meeting Cancelled: ${data.meetingTitle}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Error sending meeting cancellation email:', error);
        throw error;
    }
};

interface SendSupportOtpData {
    to: string;
    guestName: string;
    otp: string;
}

const sendSupportOtpEmail = async (data: SendSupportOtpData) => {
    try {
        const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5ea; border-radius: 12px;">
                <h2 style="color: #009999; margin-top: 0;">Verify Your Support Session</h2>
                <p>Hi ${data.guestName},</p>
                <p>You requested to initiate a support chat or create a ticket with Dev-HR.</p>
                <p>Use the following 6-digit One-Time Password (OTP) to verify your email address:</p>
                <div style="background-color: #f2f2f7; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; border-radius: 8px; margin: 20px 0; color: #1c1c1e;">
                    ${data.otp}
                </div>
                <p style="color: #8e8e93; font-size: 13px;">This OTP is valid for 10 minutes. If you did not make this request, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e5e5ea; margin: 20px 0;" />
                <p style="font-size: 12px; color: #8e8e93; margin-bottom: 0;">Web Briks LLC</p>
            </div>
        `;

        const mailOptions = {
            from: 'Support | WebBriks',
            to: data.to,
            subject: 'Support OTP Code - WebBriks',
            html: emailHtml,
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending support OTP email:', error);
        throw error;
    }
};

interface SendConsultationScheduledData {
    to: string;
    clientName: string;
    scheduledAt: Date;
    meetingLink?: string;
}

const sendConsultationScheduledEmail = async (data: SendConsultationScheduledData) => {
    try {
        const dateStr = new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        }).format(new Date(data.scheduledAt));

        const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5ea; border-radius: 12px;">
                <h2 style="color: #6A25E0; margin-top: 0;">Your Consultation is Scheduled!</h2>
                <p>Hi ${data.clientName},</p>
                <p>Thank you for your interest in Web Briks LLC! We've scheduled your free consultation.</p>
                <div style="background-color: #f2f2f7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0; font-weight: bold;">Date & Time:</p>
                    <p style="margin: 5px 0; font-size: 16px;">${dateStr}</p>
                </div>
                ${data.meetingLink ? `
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${data.meetingLink}" style="display: inline-block; background: linear-gradient(134deg, #9C46F4, #6A25E0); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Join Meeting</a>
                </div>
                ` : ''}
                <p>During the consultation, we'll discuss your project requirements, timeline, and provide a custom quote.</p>
                <p>If you need to reschedule, please reply to this email.</p>
                <hr style="border: 0; border-top: 1px solid #e5e5ea; margin: 20px 0;" />
                <p style="font-size: 12px; color: #8e8e93; margin-bottom: 0;">Web Briks LLC — Global Creative Agency</p>
            </div>
        `;

        return await transporter.sendMail({
            from: 'Consultations | WebBriks',
            to: data.to,
            subject: `Your Consultation is Scheduled — ${dateStr}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Error sending consultation scheduled email:', error);
        throw error;
    }
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
    sendMeetingInviteEmail,
    sendMeetingReminderEmail,
    sendMeetingCancellationEmail,
    sendSupportOtpEmail,
    sendConsultationScheduledEmail,
};



import {
    Html,
    Body,
    Head,
    Hr,
    Container,
    Preview,
    Section,
    Text,
    Img,
    Button,
    Row,
    Column,
} from '@react-email/components';
// @ts-ignore
import * as React from 'react';

export interface PaymentPhaseEmailInfo {
    /** Display label, e.g. "Upfront" */
    label: string;
    /** "50%" */
    percentageLabel: string;
    /** "$500.00" */
    amountFormatted: string;
    /** 'paid' | 'next' | 'locked' */
    state: 'paid' | 'next' | 'locked';
}

export interface QuotationMilestoneEmailInfo {
    label: string;
    percentageLabel: string;
    amountFormatted: string;
    note?: string;
}

interface QuotationEmailProps {
    clientName: string;
    quotationTitle: string;
    quotationNumber: string;
    /**
     * Secure link the client uses to review the quotation. Rendered as a CTA
     * only — never as bare text — to avoid the "shady raw URL" feel.
     */
    clientLink: string;
    validUntil?: string;
    /** Formatted grand total, e.g. "$1,250.00". Always shown when provided. */
    totalAmountFormatted?: string;
    /** Initial email (non-reminder) only: show milestone breakdown. */
    milestones?: QuotationMilestoneEmailInfo[];
    /** When a PDF is attached, show a short callout. */
    hasPdfAttachment?: boolean;
    /**
     * When set, the email switches to payment-reminder mode.
     * Populated when re-sending the payment link to a client who has already
     * accepted the quotation but hasn't finished paying.
     */
    paymentPhases?: PaymentPhaseEmailInfo[];
    /** Formatted remaining amount, e.g. "$500.00" */
    remainingAmountFormatted?: string;
}

export const QuotationEmail = ({
    clientName,
    quotationTitle,
    quotationNumber,
    clientLink,
    validUntil,
    totalAmountFormatted,
    milestones,
    hasPdfAttachment,
    paymentPhases,
    remainingAmountFormatted,
}: QuotationEmailProps) => {
    const isReminder = Boolean(paymentPhases && paymentPhases.length > 0);

    const previewText = isReminder
        ? `Payment reminder — ${remainingAmountFormatted ?? 'balance'} remaining on quotation ${quotationNumber}`
        : `Quotation ${quotationNumber} is ready to review`;

    const logoUrl =
        'https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png';

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Img
                            src={logoUrl}
                            width="120"
                            height="56"
                            alt="Web Briks"
                            style={logo}
                        />
                    </Section>

                    <Section style={content}>
                        <Text style={eyebrow}>
                            {isReminder
                                ? 'Payment reminder'
                                : 'Quotation ready'}
                        </Text>
                        <Text style={heading}>
                            {isReminder
                                ? 'Continue your project payment'
                                : 'Your quotation is ready to review'}
                        </Text>

                        <Text style={paragraph}>
                            Hi {clientName || 'there'},
                        </Text>

                        {isReminder ? (
                            <Text style={paragraph}>
                                This is a friendly reminder that the payment for
                                your project <strong>{quotationTitle}</strong>{' '}
                                (quotation <strong>{quotationNumber}</strong>)
                                is not yet complete. Use the secure link below
                                to continue with the next milestone.
                            </Text>
                        ) : (
                            <Text style={paragraph}>
                                We&apos;ve prepared your quotation{' '}
                                <strong>{quotationNumber}</strong> for{' '}
                                <strong>{quotationTitle}</strong>. Tap{' '}
                                <em>Review quotation</em> below to view the full
                                proposal — project overview, scope of work,
                                pricing, and payment milestones — in one secure
                                place.
                            </Text>
                        )}

                        {!isReminder && hasPdfAttachment ? (
                            <Section style={pdfCallout}>
                                <Text style={pdfCalloutText}>
                                    A PDF copy of your quotation is attached for
                                    easy sharing and printing.
                                </Text>
                            </Section>
                        ) : null}

                        {/* Summary card */}
                        <Section style={summaryCard}>
                            <Row>
                                <Column>
                                    <Text style={summaryLabel}>Quotation</Text>
                                    <Text style={summaryValue}>
                                        {quotationNumber}
                                    </Text>
                                </Column>
                                {totalAmountFormatted ? (
                                    <Column align="right">
                                        <Text style={summaryLabel}>
                                            {isReminder
                                                ? 'Project total'
                                                : 'Total'}
                                        </Text>
                                        <Text style={summaryValue}>
                                            {totalAmountFormatted}
                                        </Text>
                                    </Column>
                                ) : null}
                            </Row>
                            {(isReminder && remainingAmountFormatted) ||
                            validUntil ? (
                                <>
                                    <Hr style={summaryDivider} />
                                    <Row>
                                        {isReminder &&
                                        remainingAmountFormatted ? (
                                            <Column>
                                                <Text style={summaryLabel}>
                                                    Remaining
                                                </Text>
                                                <Text
                                                    style={summaryValueAccent}
                                                >
                                                    {remainingAmountFormatted}
                                                </Text>
                                            </Column>
                                        ) : (
                                            <Column>
                                                <Text style={summaryLabel}>
                                                    Project
                                                </Text>
                                                <Text style={summaryValueMuted}>
                                                    {quotationTitle}
                                                </Text>
                                            </Column>
                                        )}
                                        {validUntil && !isReminder ? (
                                            <Column align="right">
                                                <Text style={summaryLabel}>
                                                    Valid until
                                                </Text>
                                                <Text style={summaryValueMuted}>
                                                    {validUntil}
                                                </Text>
                                            </Column>
                                        ) : null}
                                    </Row>
                                </>
                            ) : null}
                        </Section>

                        {/* Payment phase table — reminder mode only */}
                        {isReminder &&
                        paymentPhases &&
                        paymentPhases.length > 0 ? (
                            <Section style={phaseTable}>
                                <Text style={phaseTableHeading}>
                                    Payment milestones
                                </Text>

                                {paymentPhases.map((ph) => (
                                    <Section
                                        key={ph.label}
                                        style={phaseRowStyle(ph.state)}
                                    >
                                        <Row>
                                            <Column>
                                                <Text style={phaseCell}>
                                                    {ph.state === 'paid'
                                                        ? '✅'
                                                        : ph.state === 'next'
                                                          ? '⏳'
                                                          : '🔒'}{' '}
                                                    <strong>{ph.label}</strong>{' '}
                                                    ({ph.percentageLabel}) —{' '}
                                                    {ph.amountFormatted}
                                                </Text>
                                            </Column>
                                            <Column align="right">
                                                <Text
                                                    style={phaseStatusStyle(
                                                        ph.state,
                                                    )}
                                                >
                                                    {ph.state === 'paid'
                                                        ? 'Paid'
                                                        : ph.state === 'next'
                                                          ? 'Due next'
                                                          : 'Locked'}
                                                </Text>
                                            </Column>
                                        </Row>
                                    </Section>
                                ))}
                            </Section>
                        ) : null}

                        {/* Milestones table — initial email only */}
                        {!isReminder && milestones && milestones.length > 0 ? (
                            <Section style={phaseTable}>
                                <Text style={phaseTableHeading}>
                                    Payment milestones
                                </Text>
                                {milestones.map((m, idx) => (
                                    <Section
                                        key={`${m.label}-${idx}`}
                                        style={{
                                            padding: '10px 0',
                                            borderBottom:
                                                idx === milestones.length - 1
                                                    ? '0px solid transparent'
                                                    : '1px solid #e2e8f0',
                                        }}
                                    >
                                        <Row>
                                            <Column>
                                                <Text style={phaseCell}>
                                                    <strong>{m.label}</strong> (
                                                    {m.percentageLabel}) —{' '}
                                                    {m.amountFormatted}
                                                </Text>
                                                {m.note ? (
                                                    <Text
                                                        style={{
                                                            ...phaseCell,
                                                            color: '#64748b',
                                                            fontSize: '12px',
                                                            marginTop: '4px',
                                                        }}
                                                    >
                                                        {m.note}
                                                    </Text>
                                                ) : null}
                                            </Column>
                                        </Row>
                                    </Section>
                                ))}
                            </Section>
                        ) : null}

                        <Section style={btnContainer}>
                            <Button style={button} href={clientLink}>
                                {isReminder
                                    ? 'Continue payment →'
                                    : 'Review quotation →'}
                            </Button>
                        </Section>

                        <Text style={tinyMuted}>
                            This is a secure, single-use link tied to your
                            account. Please don&apos;t share it with anyone
                            outside your team.
                        </Text>

                        <Hr style={hr} />

                        <Text style={footerText}>
                            Questions? Just reply to this email — we&apos;re
                            happy to help.
                            <br />
                            <strong>Web Briks LLC</strong>
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default QuotationEmail;

// ─── Styles ───────────────────────────────────────────────────────────────────

const main = {
    backgroundColor: '#f4f5f7',
    fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '40px 0',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '40px',
    borderRadius: '20px',
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
    maxWidth: '600px',
};

const header = {
    marginBottom: '28px',
};

const logo = {
    display: 'block',
    height: '56px',
    width: 'auto',
};

const content = {
    paddingBottom: '8px',
};

const eyebrow = {
    fontSize: '11px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: '#0f766e',
    fontWeight: '700',
    marginTop: '0',
    marginBottom: '8px',
};

const heading = {
    fontSize: '26px',
    fontWeight: '700',
    color: '#0f172a',
    marginTop: '0',
    marginBottom: '20px',
    letterSpacing: '-0.5px',
    lineHeight: '32px',
};

const paragraph = {
    fontSize: '16px',
    lineHeight: '26px',
    color: '#334155',
    marginBottom: '16px',
};

const tinyMuted = {
    fontSize: '12px',
    lineHeight: '18px',
    color: '#94a3b8',
    marginTop: '4px',
    marginBottom: '0',
};

const btnContainer = {
    textAlign: 'center' as const,
    margin: '28px 0 14px',
};

const button = {
    backgroundColor: '#0d9488',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '14px 36px',
    boxShadow: '0 6px 14px rgba(13, 148, 136, 0.25)',
};

const hr = {
    borderColor: '#e2e8f0',
    margin: '28px 0 20px',
};

const pdfCallout = {
    backgroundColor: '#ecfeff',
    border: '1px solid #a5f3fc',
    borderRadius: '14px',
    padding: '12px 14px',
    marginBottom: '18px',
};

const pdfCalloutText = {
    fontSize: '13px',
    lineHeight: '20px',
    color: '#0f766e',
    margin: '0',
    fontWeight: '600',
};

const footerText = {
    fontSize: '14px',
    lineHeight: '22px',
    color: '#475569',
};

// ─── Summary card styles ─────────────────────────────────────────────────────

const summaryCard = {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '18px',
    marginBottom: '20px',
};

const summaryLabel = {
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
    fontWeight: '600',
    margin: '0 0 4px',
};

const summaryValue = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0f172a',
    margin: '0',
};

const summaryValueAccent = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#b45309',
    margin: '0',
};

const summaryValueMuted = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#475569',
    margin: '0',
};

const summaryDivider = {
    borderColor: '#e2e8f0',
    margin: '14px 0',
};

// ─── Phase table styles ───────────────────────────────────────────────────────

const phaseTable = {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '16px',
    marginBottom: '20px',
};

const phaseTableHeading = {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '12px',
    marginTop: '0',
};

function phaseRowStyle(state: 'paid' | 'next' | 'locked') {
    return {
        padding: '10px 0',
        borderBottom: '1px solid #e2e8f0',
        opacity: state === 'locked' ? 0.6 : 1,
    };
}

const phaseCell = {
    fontSize: '14px',
    color: '#1e293b',
    margin: '0',
};

function phaseStatusStyle(state: 'paid' | 'next' | 'locked') {
    const colorMap = { paid: '#16a34a', next: '#d97706', locked: '#94a3b8' };
    return {
        fontSize: '12px',
        fontWeight: '700',
        color: colorMap[state],
        margin: '0',
        textAlign: 'right' as const,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
    };
}

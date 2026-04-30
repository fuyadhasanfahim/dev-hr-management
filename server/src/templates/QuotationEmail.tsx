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

interface QuotationEmailProps {
    clientName: string;
    quotationTitle: string;
    quotationNumber: string;
    clientLink: string;
    validUntil?: string;
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
    paymentPhases,
    remainingAmountFormatted,
}: QuotationEmailProps) => {
    const isReminder = Boolean(paymentPhases && paymentPhases.length > 0);

    const previewText = isReminder
        ? `Payment reminder — ${remainingAmountFormatted ?? 'balance'} remaining on quotation ${quotationNumber}`
        : `Quotation ${quotationNumber} is ready to review`;

    const logoUrl =
        'https://res.cloudinary.com/dny7zfbg9/image/upload/v1755954483/mqontecf1xao7znsh6cx.png';

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
                            alt="Web Briks Logo"
                            style={logo}
                        />
                    </Section>

                    <Section style={content}>
                        <Text style={heading}>
                            {isReminder ? 'Payment reminder' : 'Your quotation is ready'}
                        </Text>

                        <Text style={paragraph}>Hi {clientName || 'there'},</Text>

                        {isReminder ? (
                            <Text style={paragraph}>
                                This is a friendly reminder that your payment for quotation{' '}
                                <strong>{quotationNumber}</strong> —{' '}
                                <strong>{quotationTitle}</strong> is not yet complete.
                            </Text>
                        ) : (
                            <Text style={paragraph}>
                                We've prepared your quotation <strong>{quotationNumber}</strong>{' '}
                                for <strong>{quotationTitle}</strong>.
                            </Text>
                        )}

                        {validUntil && !isReminder ? (
                            <Text style={muted}>
                                Valid until: <strong>{validUntil}</strong>
                            </Text>
                        ) : null}

                        {/* Payment phase table — reminder mode only */}
                        {isReminder && paymentPhases && paymentPhases.length > 0 ? (
                            <Section style={phaseTable}>
                                <Text style={phaseTableHeading}>Payment milestones</Text>

                                {paymentPhases.map((ph) => (
                                    <Section key={ph.label} style={phaseRowStyle(ph.state)}>
                                        <Text style={phaseCell}>
                                            {ph.state === 'paid'  ? '✅'
                                            : ph.state === 'next' ? '⏳'
                                            :                       '🔒'}{' '}
                                            <strong>{ph.label}</strong> ({ph.percentageLabel}) —{' '}
                                            {ph.amountFormatted}
                                        </Text>
                                        <Text style={phaseStatusStyle(ph.state)}>
                                            {ph.state === 'paid'  ? 'Paid'
                                            : ph.state === 'next' ? 'Due next'
                                            :                       'Locked'}
                                        </Text>
                                    </Section>
                                ))}

                                {remainingAmountFormatted ? (
                                    <Section style={remainingRow}>
                                        <Text style={remainingLabel}>
                                            Remaining balance:{' '}
                                            <strong>{remainingAmountFormatted}</strong>
                                        </Text>
                                    </Section>
                                ) : null}
                            </Section>
                        ) : null}

                        <Section style={btnContainer}>
                            <Button style={button} href={clientLink}>
                                {isReminder ? 'Complete payment' : 'View quotation'}
                            </Button>
                        </Section>

                        <Text style={small}>
                            If the button doesn't work, copy and paste this link into your browser:
                            <br />
                            {clientLink}
                        </Text>

                        <Hr style={hr} />

                        <Text style={footerText}>
                            Best regards,
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
    backgroundColor: '#f2f2f7',
    fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '40px 0',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '40px',
    borderRadius: '24px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
    maxWidth: '600px',
};

const header = {
    marginBottom: '32px',
};

const logo = {
    display: 'block',
    height: '56px',
    width: 'auto',
};

const content = {
    paddingBottom: '16px',
};

const heading = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: '24px',
    letterSpacing: '-0.5px',
};

const paragraph = {
    fontSize: '17px',
    lineHeight: '26px',
    color: '#3a3a3c',
    marginBottom: '16px',
};

const muted = {
    fontSize: '14px',
    lineHeight: '22px',
    color: '#6b7280',
    marginBottom: '24px',
};

const btnContainer = {
    textAlign: 'center' as const,
    margin: '28px 0 22px',
};

const button = {
    backgroundColor: '#009999',
    borderRadius: '9999px',
    color: '#ffffff',
    fontSize: '17px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '14px 32px',
    boxShadow: '0 4px 12px rgba(0, 153, 153, 0.25)',
};

const small = {
    fontSize: '13px',
    lineHeight: '20px',
    color: '#6b7280',
    marginBottom: '0',
    wordBreak: 'break-word' as const,
};

const hr = {
    borderColor: '#e5e5ea',
    margin: '28px 0 20px',
};

const footerText = {
    fontSize: '15px',
    lineHeight: '24px',
    color: '#3a3a3c',
};

// ─── Phase table styles ───────────────────────────────────────────────────────

const phaseTable = {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
};

const phaseTableHeading = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '12px',
    marginTop: '0',
};

function phaseRowStyle(state: 'paid' | 'next' | 'locked') {
    return {
        display: 'flex' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        padding: '8px 0',
        borderBottom: '1px solid #e5e7eb',
        opacity: state === 'locked' ? 0.55 : 1,
    };
}

const phaseCell = {
    fontSize: '15px',
    color: '#1c1c1e',
    margin: '0',
};

function phaseStatusStyle(state: 'paid' | 'next' | 'locked') {
    const colorMap = { paid: '#16a34a', next: '#d97706', locked: '#9ca3af' };
    return {
        fontSize: '13px',
        fontWeight: '600',
        color: colorMap[state],
        margin: '0',
        minWidth: '70px',
        textAlign: 'right' as const,
    };
}

const remainingRow = {
    paddingTop: '12px',
    marginTop: '4px',
};

const remainingLabel = {
    fontSize: '15px',
    color: '#1c1c1e',
    margin: '0',
};

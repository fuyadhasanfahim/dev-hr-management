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
    Row,
    Column,
    Link,
} from '@react-email/components';
// @ts-ignore
import * as React from 'react';
import { COMPANY_LOGO_URL, COMPANY_SOCIAL_LINKS } from '../constants/company.js';

/**
 * Simple online-payment confirmation receipt — sent to the internal team
 * when a client pays an invoice online (Stripe/PayPal). Deliberately kept
 * separate from ReceiptEmail.tsx (the staff-facing, fuller receipt for
 * manually-recorded payments): this one is a quick "money landed" notice,
 * not a client-facing document.
 */
interface PaymentReceiptEmailProps {
    clientName: string;
    projectTitle: string;
    quotationNumber?: string;
    amountFormatted: string;
    /** Gateway transaction reference — Stripe PaymentIntent id / PayPal capture id. */
    paymentId: string;
    via: 'stripe' | 'paypal';
    paymentDateFormatted: string;
}

export const PaymentReceiptEmail = ({
    clientName,
    projectTitle,
    quotationNumber,
    amountFormatted,
    paymentId,
    via,
    paymentDateFormatted,
}: PaymentReceiptEmailProps) => {
    const previewText = `Online payment received — ${amountFormatted} for ${projectTitle}`;
    const viaLabel = via === 'stripe' ? 'Card (Stripe)' : 'PayPal';

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Img
                            src={COMPANY_LOGO_URL}
                            width="120"
                            height="56"
                            alt="Web Briks"
                            style={logo}
                        />
                    </Section>

                    <Section style={content}>
                        <Text style={eyebrow}>Payment received</Text>
                        <Text style={heading}>A client just paid online</Text>

                        <Text style={paragraph}>
                            <strong>{clientName}</strong> paid{' '}
                            <strong>{amountFormatted}</strong> for{' '}
                            <strong>{projectTitle}</strong> via {viaLabel}.
                        </Text>

                        <Section style={summaryCard}>
                            <Row>
                                <Column>
                                    <Text style={summaryLabel}>Payment ID</Text>
                                    <Text style={summaryValue}>{paymentId}</Text>
                                </Column>
                                <Column align="right">
                                    <Text style={summaryLabel}>Amount</Text>
                                    <Text style={summaryValue}>{amountFormatted}</Text>
                                </Column>
                            </Row>
                            <Hr style={summaryDivider} />
                            <Row>
                                <Column>
                                    <Text style={summaryLabel}>
                                        {quotationNumber ? 'Quotation' : 'Project'}
                                    </Text>
                                    <Text style={summaryValueMuted}>
                                        {quotationNumber || projectTitle}
                                    </Text>
                                </Column>
                                <Column align="right">
                                    <Text style={summaryLabel}>Date</Text>
                                    <Text style={summaryValueMuted}>
                                        {paymentDateFormatted}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

                        <Hr style={hr} />

                        <Text style={footerText}>
                            <strong>Web Briks LLC</strong>
                            <br />
                            <Link href={COMPANY_SOCIAL_LINKS.facebook} style={socialLink}>
                                Facebook
                            </Link>
                            {'  ·  '}
                            <Link href={COMPANY_SOCIAL_LINKS.linkedin} style={socialLink}>
                                LinkedIn
                            </Link>
                            {'  ·  '}
                            <Link href={COMPANY_SOCIAL_LINKS.instagram} style={socialLink}>
                                Instagram
                            </Link>
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default PaymentReceiptEmail;

// ─── Styles (mirrors ReceiptEmail.tsx / QuotationEmail.tsx) ─────────────────

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

const hr = {
    borderColor: '#e2e8f0',
    margin: '28px 0 20px',
};

const footerText = {
    fontSize: '14px',
    lineHeight: '22px',
    color: '#475569',
};

const socialLink = {
    color: '#0f766e',
    fontWeight: '600',
    textDecoration: 'none',
};

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

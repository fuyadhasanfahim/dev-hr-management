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
} from '@react-email/components';
// @ts-ignore
import * as React from 'react';

interface ReceiptEmailProps {
    clientName: string;
    receiptNumber: string;
    projectTitle: string;
    /** Formatted amount received in THIS receipt, e.g. "$500.00". */
    amountFormatted: string;
    /** Formatted remaining balance, e.g. "$500.00". */
    remainingFormatted: string;
    paymentDateFormatted?: string;
    milestoneLabel?: string;
    /** When a PDF is attached, show a short callout. */
    hasPdfAttachment?: boolean;
}

export const ReceiptEmail = ({
    clientName,
    receiptNumber,
    projectTitle,
    amountFormatted,
    remainingFormatted,
    paymentDateFormatted,
    milestoneLabel,
    hasPdfAttachment,
}: ReceiptEmailProps) => {
    const isFullyPaid = remainingFormatted === '' || /^(\$?0(\.00)?|Tk 0(\.00)?)$/i.test(remainingFormatted.trim());

    const previewText = `Payment received — receipt ${receiptNumber} for ${projectTitle}`;

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
                        <Text style={eyebrow}>Payment received</Text>
                        <Text style={heading}>Thank you for your payment</Text>

                        <Text style={paragraph}>Hi {clientName || 'there'},</Text>

                        <Text style={paragraph}>
                            We&apos;ve received your payment of{' '}
                            <strong>{amountFormatted}</strong> for{' '}
                            <strong>{projectTitle}</strong>
                            {milestoneLabel ? (
                                <>
                                    {' '}towards the <strong>{milestoneLabel}</strong>{' '}
                                    stage
                                </>
                            ) : null}
                            . This email confirms receipt{' '}
                            <strong>{receiptNumber}</strong>
                            {paymentDateFormatted ? (
                                <> dated {paymentDateFormatted}</>
                            ) : null}
                            .
                        </Text>

                        {hasPdfAttachment ? (
                            <Section style={pdfCallout}>
                                <Text style={pdfCalloutText}>
                                    A PDF copy of your receipt is attached for
                                    your records.
                                </Text>
                            </Section>
                        ) : null}

                        <Section style={summaryCard}>
                            <Row>
                                <Column>
                                    <Text style={summaryLabel}>Receipt</Text>
                                    <Text style={summaryValue}>
                                        {receiptNumber}
                                    </Text>
                                </Column>
                                <Column align="right">
                                    <Text style={summaryLabel}>
                                        Amount paid
                                    </Text>
                                    <Text style={summaryValue}>
                                        {amountFormatted}
                                    </Text>
                                </Column>
                            </Row>
                            <Hr style={summaryDivider} />
                            <Row>
                                <Column>
                                    <Text style={summaryLabel}>Project</Text>
                                    <Text style={summaryValueMuted}>
                                        {projectTitle}
                                    </Text>
                                </Column>
                                <Column align="right">
                                    <Text style={summaryLabel}>
                                        {isFullyPaid
                                            ? 'Status'
                                            : 'Remaining balance'}
                                    </Text>
                                    <Text
                                        style={
                                            isFullyPaid
                                                ? summaryValuePaid
                                                : summaryValueAccent
                                        }
                                    >
                                        {isFullyPaid
                                            ? 'Paid in full'
                                            : remainingFormatted}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

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

export default ReceiptEmail;

// ─── Styles (mirrors QuotationEmail.tsx) ─────────────────────────────────────

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

const summaryValuePaid = {
    fontSize: '18px',
    fontWeight: '700',
    color: '#16a34a',
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

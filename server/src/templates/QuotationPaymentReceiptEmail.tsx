import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Preview,
    Section,
    Text,
} from '@react-email/components';
// @ts-ignore
import * as React from 'react';

export function QuotationPaymentReceiptEmail({
    clientName = 'Valued client',
    quotationNumber,
    phase,
    amountCents,
    currency,
    referenceId,
    provider,
    paidAt,
}: {
    clientName?: string;
    quotationNumber: string;
    phase: string;
    amountCents: number;
    currency: string;
    referenceId: string;
    provider: string;
    paidAt: Date;
}) {
    const fmtAmount = (() => {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: String(currency || 'USD').toUpperCase(),
            }).format((amountCents || 0) / 100);
        } catch {
            return `${(amountCents || 0) / 100} ${currency || ''}`.trim();
        }
    })();

    const phaseLabel =
        phase === 'upfront' ? 'Upfront' : phase === 'delivery' ? 'Delivery' : phase === 'final' ? 'Final' : phase;

    const formattedDate = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    }).format(new Date(paidAt));

    const logoUrl =
        'https://res.cloudinary.com/dny7zfbg9/image/upload/v1755954483/mqontecf1xao7znsh6cx.png';

    return (
        <Html>
            <Head />
            <Preview>{`Receipt — ${quotationNumber} (${phaseLabel})`}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Img src={logoUrl} width="120" height="56" alt="Web Briks" style={logo} />
                    </Section>

                    <Section style={card}>
                        <div style={accentBar} />
                        <Section style={content}>
                            <Heading style={title}>Payment receipt</Heading>
                            <Text style={text}>Hi {clientName},</Text>
                            <Text style={text}>
                                We’ve received your payment for <strong>{quotationNumber}</strong>.
                            </Text>

                            <Section style={receiptBox}>
                                <Text style={row}>
                                    <span style={label}>Stage:</span>{' '}
                                    <span style={value}>{phaseLabel}</span>
                                </Text>
                                <Hr style={divider} />
                                <Text style={row}>
                                    <span style={label}>Amount:</span>{' '}
                                    <span style={value}>{fmtAmount}</span>
                                </Text>
                                <Hr style={divider} />
                                <Text style={row}>
                                    <span style={label}>Method:</span>{' '}
                                    <span style={value}>{String(provider || '').toUpperCase()}</span>
                                </Text>
                                <Hr style={divider} />
                                <Text style={row}>
                                    <span style={label}>Reference ID:</span>{' '}
                                    <span style={value}>{referenceId}</span>
                                </Text>
                                <Hr style={divider} />
                                <Text style={row}>
                                    <span style={label}>Paid at:</span>{' '}
                                    <span style={value}>{formattedDate}</span>
                                </Text>
                            </Section>

                            <Text style={footerText}>
                                Keep this email as your receipt. If anything looks off, reply to this email and we’ll
                                help right away.
                            </Text>
                        </Section>
                    </Section>

                    <Text style={bottomFooter}>
                        &copy; {new Date().getFullYear()} Web Briks LLC. All rights reserved.
                    </Text>
                </Container>
            </Body>
        </Html>
    );
}

const main = {
    backgroundColor: '#F9FAFB',
    fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '40px 0',
};

const container = {
    margin: '0 auto',
    maxWidth: '560px',
    padding: '0 20px',
};

const header = {
    padding: '0 0 22px',
    textAlign: 'center' as const,
};

const logo = { margin: '0 auto' };

const card = {
    backgroundColor: '#ffffff',
    border: '1px solid #E5E7EB',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
};

const accentBar = {
    backgroundColor: '#0d9488',
    height: '6px',
    width: '100%',
};

const content = { padding: '28px 32px' };

const title = {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0f172a',
    margin: '0 0 18px',
    textAlign: 'center' as const,
};

const text = {
    fontSize: '15px',
    lineHeight: '24px',
    color: '#334155',
    margin: '0 0 14px',
};

const receiptBox = {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '18px',
    margin: '22px 0',
};

const row = { margin: '0', padding: '10px 0', fontSize: '14px' };
const label = { color: '#64748b', fontWeight: '600', display: 'inline-block', width: '110px' };
const value = { color: '#0f172a', fontWeight: '700' };
const divider = { borderColor: '#e2e8f0', margin: '0' };

const footerText = {
    fontSize: '13px',
    lineHeight: '20px',
    color: '#64748b',
    margin: '0',
    textAlign: 'center' as const,
};

const bottomFooter = {
    margin: '24px 0 0',
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center' as const,
};


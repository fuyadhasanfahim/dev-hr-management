import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
} from '@react-email/components';
// @ts-ignore
import * as React from 'react';

export function QuotationPaymentAdminEmail({
    clientName,
    quotationNumber,
    phase,
    amountCents,
    currency,
    referenceId,
    provider,
    paidAt,
    ordersUrl,
}: {
    clientName: string;
    quotationNumber: string;
    phase: string;
    amountCents: number;
    currency: string;
    referenceId: string;
    provider: string;
    paidAt: Date;
    ordersUrl: string;
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
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(paidAt));

    return (
        <Html>
            <Head />
            <Preview>{`Payment received — ${quotationNumber} (${phaseLabel})`}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={card}>
                        <Heading style={title}>Payment received</Heading>
                        <Text style={text}>
                            <strong>{clientName}</strong> paid <strong>{fmtAmount}</strong> for{' '}
                            <strong>{quotationNumber}</strong> — <strong>{phaseLabel}</strong>.
                        </Text>

                        <Section style={box}>
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

                        <Text style={tiny}>
                            View the order pipeline here:{' '}
                            <Link href={ordersUrl} style={link}>
                                Orders
                            </Link>
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

const main = {
    backgroundColor: '#F8FAFC',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '36px 0',
};

const container = { margin: '0 auto', maxWidth: '560px', padding: '0 20px' };

const card = {
    backgroundColor: '#ffffff',
    border: '1px solid #E5E7EB',
    borderRadius: '16px',
    padding: '24px 28px',
};

const title = {
    fontSize: '18px',
    fontWeight: '800',
    color: '#0f172a',
    margin: '0 0 12px',
};

const text = { fontSize: '14px', lineHeight: '22px', color: '#334155', margin: '0 0 14px' };

const box = {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    margin: '14px 0',
};

const row = { margin: '0', padding: '10px 0', fontSize: '13px' };
const label = { color: '#64748b', fontWeight: '700', display: 'inline-block', width: '110px' };
const value = { color: '#0f172a', fontWeight: '700' };
const divider = { borderColor: '#e2e8f0', margin: '0' };

const tiny = { fontSize: '12px', color: '#64748b', margin: '0' };
const link = { color: '#0d9488', textDecoration: 'underline' };


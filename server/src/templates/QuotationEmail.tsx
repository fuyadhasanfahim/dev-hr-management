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

interface QuotationEmailProps {
    clientName: string;
    quotationTitle: string;
    quotationNumber: string;
    clientLink: string;
    validUntil?: string;
}

export const QuotationEmail = ({
    clientName,
    quotationTitle,
    quotationNumber,
    clientLink,
    validUntil,
}: QuotationEmailProps) => {
    const previewText = `Quotation ${quotationNumber} is ready to review`;
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
                        <Text style={heading}>Your quotation is ready</Text>

                        <Text style={paragraph}>Hi {clientName || 'there'},</Text>

                        <Text style={paragraph}>
                            We’ve prepared your quotation <strong>{quotationNumber}</strong> for{' '}
                            <strong>{quotationTitle}</strong>.
                        </Text>

                        {validUntil ? (
                            <Text style={muted}>
                                Valid until: <strong>{validUntil}</strong>
                            </Text>
                        ) : null}

                        <Section style={btnContainer}>
                            <Button style={button} href={clientLink}>
                                View quotation
                            </Button>
                        </Section>

                        <Text style={small}>
                            If the button doesn’t work, copy and paste this link into your browser:
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


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
    Link,
} from '@react-email/components';
// @ts-ignore
import * as React from 'react';

interface MeetingCancellationEmailProps {
    clientName: string;
    meetingTitle: string;
    scheduledAt: string;
}

export const MeetingCancellationEmail = ({
    clientName,
    meetingTitle,
    scheduledAt,
}: MeetingCancellationEmailProps) => {
    const previewText = `Meeting Cancelled: ${meetingTitle}`;
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
                        <Text style={heading}>❌ Meeting Cancelled</Text>

                        <Text style={paragraph}>
                            Hi {clientName},<br />
                            The following scheduled meeting has been cancelled.
                        </Text>

                        <Section style={detailsSection}>
                            <Text style={detailsItem}>
                                <strong>Title:</strong> {meetingTitle}
                            </Text>
                            <Text style={detailsItem}>
                                <strong>Originally scheduled for:</strong> {scheduledAt}
                            </Text>
                        </Section>

                        <Hr style={hr} />

                        <Text style={footerText}>
                            Best regards,
                            <br />
                            <strong>Web Briks LLC</strong>
                        </Text>
                    </Section>

                    <Section style={footer}>
                        <Text style={footerLegal}>
                            1209 Mountain Road PL NE, STE R, Albuquerque, NM
                            87110, US
                        </Text>
                        <Link
                            href="mailto:info@webbriks.com"
                            style={footerLink}
                        >
                            info@webbriks.com
                        </Link>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default MeetingCancellationEmail;

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
    marginBottom: '24px',
};

const detailsSection = {
    backgroundColor: '#f8f9fa',
    padding: '16px 24px',
    borderRadius: '12px',
    marginBottom: '24px',
};

const detailsItem = {
    fontSize: '15px',
    lineHeight: '24px',
    color: '#3a3a3c',
    margin: '8px 0',
};

const hr = {
    borderColor: '#e5e5ea',
    margin: '32px 0 24px',
};

const footerText = {
    fontSize: '15px',
    lineHeight: '24px',
    color: '#3a3a3c',
};

const footer = {
    marginTop: '32px',
    textAlign: 'center' as const,
};

const footerLegal = {
    fontSize: '13px',
    color: '#8e8e93',
    marginBottom: '8px',
};

const footerLink = {
    fontSize: '13px',
    color: '#009999',
    textDecoration: 'none',
};

'use client';

/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Document, Page, Text, View, Image, Link } from '@react-pdf/renderer';
import { styles } from './styles';
import { QuotationData, IPaymentMilestone } from '@/types/quotation.type';
import { format } from 'date-fns';
import { formatMoney } from '@/lib/money';

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildPaymentLink(data: QuotationData) {
    const base =
        process.env.NEXT_PUBLIC_PAYMENT_URL!;
    if (!data.secureToken) return null;
    return `${base.replace(/\/$/, '')}/quotation/${data.secureToken}`;
}

function compactList(parts: Array<string | undefined | null>) {
    return parts.map((x) => (x || '').trim()).filter(Boolean);
}

// ─── Main component ───────────────────────────────────────────────────────────

interface QuotationPDFProps {
    data: QuotationData;
}

type LineItem = {
    name: string;
    qty: number;
    rate: number;
    total: number;
};

const TableHeader = () => (
    <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.colNo]}>No.</Text>
        <Text style={[styles.tableHeaderText, styles.colName]}>Service</Text>
        <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
        <Text style={[styles.tableHeaderText, styles.colRate]}>Rate</Text>
        <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
    </View>
);

const TableRow = ({
    item,
    index,
    currency,
}: {
    item: LineItem;
    index: number;
    currency: string;
}) => (
    <View
        style={[styles.tableRow, index % 2 !== 0 ? styles.tableRowEven : {}]}
        wrap={false}
    >
        <Text style={[styles.tableCell, styles.colNo]}>{index + 1}</Text>
        <Text style={[styles.tableCell, styles.colName]}>{item.name}</Text>
        <Text style={[styles.tableCell, styles.colQty]}>{item.qty}</Text>
        <Text style={[styles.tableCell, styles.colRate]}>
            {item.rate > 0 ? formatMoney(item.rate, currency) : '—'}
        </Text>
        <Text style={[styles.tableCell, styles.colTotal]}>
            {item.total > 0 ? formatMoney(item.total, currency) : '—'}
        </Text>
    </View>
);

export const QuotationPDF = ({ data }: QuotationPDFProps) => {
    const {
        totals,
        pricing,
        techStack,
        phases,
        additionalServices,
        workflow,
        details,
        client,
        company,
    } = data;

    const currency = data.currency || 'BDT';
    const payLink = buildPaymentLink(data);
    const logoUrl =
        company.logo ||
        'https://res.cloudinary.com/dny7zfbg9/image/upload/v1755954483/mqontecf1xao7znsh6cx.png';
    const sigUrl =
        process.env.NEXT_PUBLIC_COMPANY_SIGNATURE_URL ||
        'https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png';

    const issueDate = details?.date
        ? format(new Date(details.date), 'PPP')
        : format(new Date(), 'PPP');

    const baseTitle =
        data.serviceType === 'web-development'
            ? 'Web Design & Development'
            : 'Service';

    // Services table line items: main project + each phase summary + add-ons
    const phaseRows: LineItem[] = (phases || []).map((p, idx) => ({
        name: `Phase ${idx + 1}: ${p.title}${
            p.items?.length ? ` (${p.items.length} deliverables)` : ''
        }`,
        qty: 1,
        rate: 0,
        total: 0,
    }));

    const addOnRows: LineItem[] = (additionalServices || []).map((s) => ({
        name: `${s.title} (${s.billingCycle})`,
        qty: 1,
        rate: s.price ?? 0,
        total: s.price ?? 0,
    }));

    const items: LineItem[] = [
        {
            name: details?.title
                ? `${baseTitle} — ${details.title}`
                : baseTitle,
            qty: 1,
            rate: pricing?.basePrice ?? 0,
            total: pricing?.basePrice ?? 0,
        },
        ...phaseRows,
        ...addOnRows,
    ];

    const techTags = compactList([
        techStack?.frontend,
        techStack?.backend,
        techStack?.database,
        ...(techStack?.tools || []),
    ]);

    const workflowSteps = (workflow || [])
        .map((s) => (s || '').trim())
        .filter(Boolean);

    const pricingSubtotal = totals?.subtotal ?? 0;
    const pricingTax = totals?.taxAmount ?? 0;
    const pricingTotal = totals?.grandTotal ?? 0;
    const discountAmount =
        pricing?.discount && pricingSubtotal
            ? (pricingSubtotal * pricing.discount) / 100
            : 0;

    // Use stored milestones; fallback to a sensible default if none configured.
    const milestones: IPaymentMilestone[] =
        data.paymentMilestones && data.paymentMilestones.length
            ? data.paymentMilestones
            : [
                  { label: 'Upfront on acceptance', percentage: 50 },
                  { label: 'After delivery handover', percentage: 30 },
                  { label: 'Final approval / clearance', percentage: 20 },
              ];

    const firstMilestone = milestones[0];
    const ctaPrimary = firstMilestone
        ? `ACCEPT & PAY ${firstMilestone.percentage}%`
        : 'ACCEPT QUOTATION';

    const footerText = [
        company?.name ? `${company.name}` : 'Company',
        company?.email ? `— ${company.email}` : null,
        company?.website ? `— ${company.website}` : null,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Top Bar */}
                <View style={styles.topBar} fixed />

                {/* Header (only on first page) */}
                <View style={styles.headerContainer}>
                    <View style={styles.logoContainer}>
                        <Image src={{ uri: logoUrl }} style={styles.logo} />
                    </View>
                    <View style={styles.headerDetailsContainer}>
                        <Text style={styles.headerTitle}>QUOTATION</Text>
                        <View style={styles.titleUnderline} />
                        <Text style={styles.headerDetailText}>
                            Quotation No: {data.quotationNumber || 'TBD'}
                        </Text>
                        <Text style={styles.headerDetailText}>
                            Date: {issueDate}
                        </Text>
                        <Text style={styles.headerDetailText}>
                            Valid Until:{' '}
                            {details?.validUntil
                                ? format(new Date(details.validUntil), 'PPP')
                                : '—'}
                        </Text>
                    </View>
                </View>

                {/* Bill From / To */}
                <View style={styles.addressContainer} wrap={false}>
                    <View style={styles.addressBox}>
                        <View
                            style={[styles.accentBar, styles.billFromAccent]}
                        />
                        <View
                            style={[styles.addressContent, styles.billFromBox]}
                        >
                            <Text
                                style={[styles.boxTitle, styles.billFromText]}
                            >
                                BILL FROM
                            </Text>
                            <Text style={[styles.boxText, styles.billFromText]}>
                                {company?.name || 'Company'}
                            </Text>
                            {company?.address ? (
                                <Text
                                    style={[
                                        styles.boxText,
                                        styles.billFromText,
                                    ]}
                                >
                                    {company.address}
                                </Text>
                            ) : null}
                            {company?.email ? (
                                <Text
                                    style={[
                                        styles.boxText,
                                        styles.billFromText,
                                    ]}
                                >
                                    {company.email}
                                </Text>
                            ) : null}
                            {company?.phone ? (
                                <Text
                                    style={[
                                        styles.boxText,
                                        styles.billFromText,
                                    ]}
                                >
                                    {company.phone}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.addressBox}>
                        <View style={[styles.accentBar, styles.billToAccent]} />
                        <View style={[styles.addressContent, styles.billToBox]}>
                            <Text style={[styles.boxTitle, styles.billToText]}>
                                BILL TO
                            </Text>
                            <Text style={[styles.boxText, styles.billToText]}>
                                {client.contactName}
                            </Text>
                            {client.companyName ? (
                                <Text
                                    style={[styles.boxText, styles.billToText]}
                                >
                                    {client.companyName}
                                </Text>
                            ) : null}
                            {client.address ? (
                                <Text
                                    style={[styles.boxText, styles.billToText]}
                                >
                                    {client.address}
                                </Text>
                            ) : null}
                            {client.email ? (
                                <Text
                                    style={[styles.boxText, styles.billToText]}
                                >
                                    {client.email}
                                </Text>
                            ) : null}
                            {client.phone ? (
                                <Text
                                    style={[styles.boxText, styles.billToText]}
                                >
                                    {client.phone}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* Project Title */}
                <Text style={styles.sectionTitle}>Project</Text>
                <View style={styles.sectionBox} wrap={false}>
                    <Text style={styles.projectTitle}>
                        {details?.title || 'Project'}
                    </Text>
                    <View style={styles.projectMetaRow}>
                        <View style={styles.metaBadge}>
                            <Text style={styles.metaBadgeText}>
                                {data.serviceType === 'web-development'
                                    ? 'WEB'
                                    : 'SERVICE'}
                            </Text>
                        </View>
                        {client.companyName ? (
                            <View style={styles.metaBadge}>
                                <Text style={styles.metaBadgeText}>
                                    {client.companyName}
                                </Text>
                            </View>
                        ) : null}
                        {data.status ? (
                            <View style={styles.metaBadge}>
                                <Text style={styles.metaBadgeText}>
                                    {data.status.toUpperCase()}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {/* Project Overview */}
                {data.overview ? (
                    <>
                        <Text style={styles.sectionTitle}>Overview</Text>
                        <View style={styles.sectionBox} wrap={false}>
                            <Text style={styles.sectionText}>
                                {data.overview}
                            </Text>
                        </View>
                    </>
                ) : null}

                {/* Detailed Project Scope (full lists, no truncation) */}
                {phases?.length ? (
                    <>
                        <Text style={styles.sectionTitle}>Project scope</Text>
                        {phases.map((phase, idx) => (
                            <View
                                key={`${idx}-${phase.title}`}
                                style={styles.scopeCard}
                                // Allow breaking inside a phase to avoid orphaned headers
                                wrap
                            >
                                <View
                                    style={styles.scopeHeaderRow}
                                    wrap={false}
                                >
                                    <Text style={styles.scopeTitle}>
                                        Phase {idx + 1}: {phase.title}
                                    </Text>
                                    <View style={styles.scopeCountBadge}>
                                        <Text
                                            style={styles.scopeCountBadgeText}
                                        >
                                            {phase.items?.length || 0} items
                                        </Text>
                                    </View>
                                </View>

                                {phase.description ? (
                                    <Text style={styles.sectionSubText}>
                                        {phase.description}
                                    </Text>
                                ) : null}

                                {(phase.items || []).map((item, i) => (
                                    <View
                                        key={i}
                                        style={styles.bulletRow}
                                        wrap={false}
                                    >
                                        <View style={styles.bulletDot} />
                                        <Text style={styles.bulletText}>
                                            {item}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </>
                ) : null}

                {/* Services Table */}
                <Text style={styles.sectionTitle}>Services</Text>
                <View style={styles.tableContainer}>
                    {/* Keep the header attached to the first row to prevent orphaned headers */}
                    <View wrap={false}>
                        <TableHeader />
                        {items[0] ? (
                            <TableRow
                                item={items[0]}
                                index={0}
                                currency={currency}
                            />
                        ) : null}
                    </View>
                    {items.slice(1).map((item, idx) => (
                        <TableRow
                            key={`${idx + 1}-${item.name}`}
                            item={item}
                            index={idx + 1}
                            currency={currency}
                        />
                    ))}
                </View>

                {/* Technology Stack */}
                {techTags.length ? (
                    <>
                        <Text style={styles.sectionTitle}>
                            Technology stack
                        </Text>
                        <View style={styles.sectionBox} wrap>
                            <View style={styles.tagsWrap}>
                                {techTags.map((t) => (
                                    <View key={t} style={styles.tag}>
                                        <Text style={styles.tagText}>{t}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </>
                ) : null}

                {/* Workflow */}
                {workflowSteps.length ? (
                    <>
                        <Text style={styles.sectionTitle}>Workflow</Text>
                        <View style={styles.sectionBox} wrap>
                            <View style={styles.workflowInline}>
                                {workflowSteps.map((step, i) => (
                                    <React.Fragment key={`${i}-${step}`}>
                                        <View style={styles.workflowStep}>
                                            <Text
                                                style={styles.workflowStepText}
                                            >
                                                {i + 1}. {step}
                                            </Text>
                                        </View>
                                        {i < workflowSteps.length - 1 ? (
                                            <Text style={styles.workflowArrow}>
                                                →
                                            </Text>
                                        ) : null}
                                    </React.Fragment>
                                ))}
                            </View>
                        </View>
                    </>
                ) : null}

                {/* Pricing Breakdown */}
                <Text style={styles.sectionTitle}>Pricing</Text>
                <View style={styles.pricingBox} wrap={false}>
                    <View style={styles.pricingHeader}>
                        <Text style={styles.pricingHeaderText}>
                            Pricing breakdown
                        </Text>
                    </View>
                    <View style={styles.pricingBody}>
                        <View style={styles.pricingRow}>
                            <Text style={styles.pricingLabel}>Subtotal</Text>
                            <Text style={styles.pricingValue}>
                                {formatMoney(pricingSubtotal, currency)}
                            </Text>
                        </View>
                        {pricing?.taxRate ? (
                            <View style={styles.pricingRow}>
                                <Text style={styles.pricingLabel}>
                                    Tax ({pricing.taxRate}%)
                                </Text>
                                <Text style={styles.pricingValue}>
                                    {formatMoney(pricingTax, currency)}
                                </Text>
                            </View>
                        ) : null}
                        {pricing?.discount ? (
                            <View style={styles.pricingRowLast}>
                                <Text style={styles.pricingLabel}>
                                    Discount ({pricing.discount}%)
                                </Text>
                                <Text style={styles.pricingValue}>
                                    −{formatMoney(discountAmount, currency)}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.pricingRowLast}>
                                <Text style={styles.pricingLabel}>
                                    Discount
                                </Text>
                                <Text style={styles.pricingValue}>
                                    {formatMoney(0, currency)}
                                </Text>
                            </View>
                        )}
                        <View style={styles.pricingTotalRow}>
                            <Text style={styles.pricingTotalLabel}>Total</Text>
                            <Text style={styles.pricingTotalValue}>
                                {formatMoney(pricingTotal, currency)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Payment Terms (dynamic milestones) */}
                <Text style={styles.sectionTitle}>Payment terms</Text>
                <View style={styles.paymentPlanBox} wrap={false}>
                    <View style={styles.paymentPlanHeader}>
                        <Text style={styles.paymentPlanHeaderText}>
                            Milestone payment plan
                        </Text>
                    </View>
                    {milestones.map((m, idx) => {
                        const isLast = idx === milestones.length - 1;
                        const amount =
                            (pricingTotal * (m.percentage || 0)) / 100;
                        return (
                            <View
                                key={`${idx}-${m.label}`}
                                style={
                                    isLast
                                        ? styles.paymentMilestoneRowLast
                                        : styles.paymentMilestoneRow
                                }
                            >
                                <Text style={styles.paymentMilestoneLabel}>
                                    {m.percentage}% — {m.label}
                                </Text>
                                <Text style={styles.paymentMilestoneValue}>
                                    {formatMoney(amount, currency)}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Trust */}
                <View style={styles.trustBand} wrap={false}>
                    <Text style={styles.trustTitle}>Why partner with us</Text>
                    <Text style={styles.trustText}>
                        We combine product strategy, modern engineering and
                        reliable delivery to scale your business with
                        confidence. This proposal reflects a phased, accountable
                        delivery approach with transparent pricing.
                    </Text>
                </View>

                {/* Pay Now Section */}
                <View style={styles.payNowSection} wrap={false}>
                    <View style={styles.payNowTextContainer}>
                        <Text style={styles.payNowHeading}>
                            SECURE ONLINE PAYMENT
                        </Text>
                        <Text style={styles.payNowDescription}>
                            Use the secure online portal to review and accept
                            this quotation, then proceed to the first milestone
                            payment.
                        </Text>
                        {firstMilestone ? (
                            <Text style={styles.payNowDescription}>
                                On acceptance: {firstMilestone.percentage}% (
                                {formatMoney(
                                    (pricingTotal * firstMilestone.percentage) /
                                        100,
                                    currency,
                                )}
                                ) — {firstMilestone.label}.
                            </Text>
                        ) : null}
                    </View>
                    <View style={styles.payNowButtonContainer}>
                        {payLink ? (
                            <>
                                <Link
                                    src={payLink}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <View style={styles.payNowButton}>
                                        <Text style={styles.payNowText}>
                                            {ctaPrimary}
                                        </Text>
                                    </View>
                                </Link>
                                <Link
                                    src={payLink}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <View style={styles.payNowSecondaryButton}>
                                        <Text
                                            style={styles.payNowSecondaryText}
                                        >
                                            VIEW FULL QUOTATION
                                        </Text>
                                    </View>
                                </Link>
                            </>
                        ) : (
                            <View style={styles.payNowButton}>
                                <Text style={styles.payNowText}>
                                    LINK PENDING
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Signature */}
                <View style={styles.signatureSection} wrap={false}>
                    <View style={styles.signatureRow}>
                        <View style={styles.signatureBlock}>
                            <Image
                                src={{ uri: sigUrl }}
                                style={styles.signatureImage}
                            />
                            <View style={styles.signatureLine} />
                            <Text style={styles.signatureName}>
                                Md. Ashaduzzaman
                            </Text>
                            <Text style={styles.signatureRole}>
                                Founder &amp; CEO, {company?.name || 'Company'}
                            </Text>
                        </View>
                        <View style={styles.signatureBlock}>
                            <View style={{ height: 42 }} />
                            <View style={styles.signatureLine} />
                            <Text style={styles.signatureName}>
                                {client.contactName}
                            </Text>
                            <Text style={styles.signatureRole}>
                                Client signature
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>{footerText}</Text>
                </View>

                {/* Page Numbers */}
                <Text
                    style={styles.pageNumber}
                    render={({ pageNumber, totalPages }) =>
                        `Page ${pageNumber} of ${totalPages}`
                    }
                    fixed
                />
            </Page>
        </Document>
    );
};

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
    const base = process.env.NEXT_PUBLIC_PAYMENT_URL!;
    if (!data.secureToken) return null;
    return `${base.replace(/\/$/, '')}/quotation/${data.secureToken}`;
}

function compactList(parts: Array<string | undefined | null>) {
    return parts.map((x) => (x || '').trim()).filter(Boolean);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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

// ─── Main component ──────────────────────────────────────────────────────────

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
        'https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png';
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

    // ── Build line items ──────────────────────────────────────────────────────
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

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>
                {/* ── Header ─────────────────────────────────────────────── */}
                <View style={styles.headerContainer} wrap={false}>
                    <View style={styles.logoContainer}>
                        <Image src={{ uri: logoUrl }} style={styles.logo} />
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.headerTitle}>QUOTATION</Text>
                        <View style={styles.titleAccent} />
                        <Text style={styles.headerMeta}>
                            Ref:{' '}
                            <Text style={styles.headerMetaStrong}>
                                {data.quotationNumber || 'TBD'}
                            </Text>
                        </Text>
                        <Text style={styles.headerMeta}>
                            Date:{' '}
                            <Text style={styles.headerMetaStrong}>
                                {issueDate}
                            </Text>
                        </Text>
                        <Text style={styles.headerMeta}>
                            Valid until:{' '}
                            <Text style={styles.headerMetaStrong}>
                                {details?.validUntil
                                    ? format(
                                          new Date(details.validUntil),
                                          'PPP',
                                      )
                                    : '—'}
                            </Text>
                        </Text>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* ── Billing ─────────────────────────────────────────────── */}
                <View style={styles.billingRow} wrap={false}>
                    <View style={styles.billingCol}>
                        <Text style={styles.billingLabel}>Bill From</Text>
                        <Text style={styles.billingName}>
                            {company?.name || 'Company'}
                        </Text>
                        {company?.address ? (
                            <Text style={styles.billingText}>
                                {company.address}
                            </Text>
                        ) : null}
                        {company?.email ? (
                            <Text style={styles.billingText}>
                                {company.email}
                            </Text>
                        ) : null}
                        {company?.phone ? (
                            <Text style={styles.billingText}>
                                {company.phone}
                            </Text>
                        ) : null}
                    </View>
                    <View style={styles.billingColRight}>
                        <Text style={styles.billingLabel}>Bill To</Text>
                        <Text style={styles.billingName}>
                            {client.contactName}
                        </Text>
                        {client.companyName ? (
                            <Text style={styles.billingText}>
                                {client.companyName}
                            </Text>
                        ) : null}
                        {client.address ? (
                            <Text style={styles.billingText}>
                                {client.address}
                            </Text>
                        ) : null}
                        {client.email ? (
                            <Text style={styles.billingText}>
                                {client.email}
                            </Text>
                        ) : null}
                        {client.phone ? (
                            <Text style={styles.billingText}>
                                {client.phone}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* ── Project ─────────────────────────────────────────────── */}
                <Text style={styles.sectionTitle}>Project</Text>
                <View style={styles.card} wrap={false}>
                    <Text style={styles.projectTitle}>
                        {details?.title || 'Project'}
                    </Text>
                    <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {data.serviceType === 'web-development'
                                    ? 'WEB'
                                    : 'SERVICE'}
                            </Text>
                        </View>
                        {client.companyName ? (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {client.companyName}
                                </Text>
                            </View>
                        ) : null}
                        {data.status ? (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {data.status.toUpperCase()}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {/* ── Overview ────────────────────────────────────────────── */}
                {data.overview ? (
                    <>
                        <Text style={styles.sectionTitle}>Overview</Text>
                        <View style={styles.cardSoft}>
                            <Text style={styles.bodyText}>{data.overview}</Text>
                        </View>
                    </>
                ) : null}

                {/* ── Project Scope ───────────────────────────────────────── */}
                {phases?.length ? (
                    <>
                        <Text style={styles.sectionTitle}>Project Scope</Text>
                        {phases.map((phase, idx) => (
                            <View
                                key={`${idx}-${phase.title}`}
                                style={styles.scopeCard}
                                wrap
                            >
                                <View style={styles.scopeHeader} wrap={false}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.scopeTitle}>
                                            Phase {idx + 1}: {phase.title}
                                        </Text>
                                        {(phase.startDate || phase.endDate) && (
                                            <Text style={{ fontSize: 7.5, color: '#64748b', fontFamily: 'Helvetica-Oblique', marginLeft: 6 }}>
                                                ({(() => {
                                                    try {
                                                        return phase.startDate ? format(new Date(phase.startDate), 'PPP') : 'TBD';
                                                    } catch {
                                                        return phase.startDate || 'TBD';
                                                    }
                                                })()} — {(() => {
                                                    try {
                                                        return phase.endDate ? format(new Date(phase.endDate), 'PPP') : 'TBD';
                                                    } catch {
                                                        return phase.endDate || 'TBD';
                                                    }
                                                })()})
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={styles.scopeCount}>
                                        {phase.items?.length || 0} items
                                    </Text>
                                </View>

                                {phase.description ? (
                                    <Text style={styles.scopeDesc}>
                                        {phase.description}
                                    </Text>
                                ) : null}

                                {(phase.items || []).map((item, i) => (
                                    <View
                                        key={i}
                                        style={styles.bulletRow}
                                        wrap={false}
                                    >
                                        <Text style={styles.bulletDot}>•</Text>
                                        <Text style={styles.bulletText}>
                                            {item}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </>
                ) : null}

                {/* ── Services table ──────────────────────────────────────── */}
                <Text style={styles.sectionTitle}>Services</Text>
                <View style={styles.tableWrap} wrap>
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

                {/* ── Tech stack ──────────────────────────────────────────── */}
                {techTags.length ? (
                    <>
                        <Text style={styles.sectionTitle}>
                            Technology Stack
                        </Text>
                        <View style={styles.card} wrap>
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

                {/* ── Workflow ────────────────────────────────────────────── */}
                {workflowSteps.length ? (
                    <>
                        <Text style={styles.sectionTitle}>Workflow</Text>
                        <View style={styles.card} wrap>
                            <View style={styles.workflowRow}>
                                {workflowSteps.map((step, i) => (
                                    <React.Fragment key={`${i}-${step}`}>
                                        <View style={styles.workflowStep}>
                                            <View style={styles.workflowNum}>
                                                <Text
                                                    style={
                                                        styles.workflowNumText
                                                    }
                                                >
                                                    {i + 1}
                                                </Text>
                                            </View>
                                            <Text style={styles.workflowText}>
                                                {step}
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

                {/* ── Pricing ────────────────────────────────────────────── */}
                <View wrap={false}>
                    <Text style={styles.sectionTitle}>Pricing</Text>
                    <View style={styles.pricingCard}>
                        <View style={styles.pricingHeaderBar}>
                            <Text style={styles.pricingHeaderText}>
                                Pricing Breakdown
                            </Text>
                        </View>
                        <View style={styles.pricingBody}>
                            <View style={styles.pricingRow}>
                                <Text style={styles.pricingLabel}>
                                    Subtotal
                                </Text>
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
                                    <Text
                                        style={[
                                            styles.pricingValue,
                                            styles.pricingDiscount,
                                        ]}
                                    >
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
                                <Text style={styles.pricingTotalLabel}>
                                    Grand Total
                                </Text>
                                <Text style={styles.pricingTotalValue}>
                                    {formatMoney(pricingTotal, currency)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── Payment Milestones ──────────────────────────────────── */}
                <Text style={styles.sectionTitle}>Payment Terms</Text>
                <View style={styles.milestoneCard} wrap={false}>
                    {milestones.map((m, idx) => {
                        const isLast = idx === milestones.length - 1;
                        const amount =
                            (pricingTotal * (m.percentage || 0)) / 100;
                        return (
                            <View
                                key={`${idx}-${m.label}`}
                                style={
                                    isLast
                                        ? styles.milestoneRowLast
                                        : styles.milestoneRow
                                }
                                wrap={false}
                            >
                                <Text style={styles.milestoneBadge}>
                                    {m.percentage}%
                                </Text>
                                <Text style={styles.milestoneLabel}>
                                    {m.label}
                                </Text>
                                <Text style={styles.milestoneAmount}>
                                    {formatMoney(amount, currency)}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* ── Trust band ──────────────────────────────────────────── */}
                <View style={styles.trustBand} wrap={false}>
                    <Text style={styles.trustTitle}>Why partner with us</Text>
                    <Text style={styles.trustText}>
                        We combine product strategy, modern engineering and
                        reliable delivery to scale your business with
                        confidence. This proposal reflects a phased, accountable
                        delivery approach with transparent pricing.
                    </Text>
                </View>

                {/* ── CTA ─────────────────────────────────────────────────── */}
                <View style={styles.ctaSection} wrap={false}>
                    <View style={styles.ctaLeft}>
                        <Text style={styles.ctaHeading}>
                            SECURE ONLINE PAYMENT
                        </Text>
                        <Text style={styles.ctaDesc}>
                            Use the secure online portal to review and accept
                            this quotation, then proceed to the first milestone
                            payment.
                        </Text>
                        {firstMilestone ? (
                            <Text style={styles.ctaDesc}>
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
                    <View style={styles.ctaRight}>
                        {payLink ? (
                            <>
                                <Link
                                    src={payLink}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <View style={styles.ctaButton}>
                                        <Text style={styles.ctaButtonText}>
                                            {ctaPrimary}
                                        </Text>
                                    </View>
                                </Link>
                                <Link
                                    src={payLink}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <View style={styles.ctaSecondary}>
                                        <Text style={styles.ctaSecondaryText}>
                                            VIEW FULL QUOTATION
                                        </Text>
                                    </View>
                                </Link>
                            </>
                        ) : (
                            <View style={styles.ctaButton}>
                                <Text style={styles.ctaButtonText}>
                                    LINK PENDING
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* ── Signature ────────────────────────────────────────────── */}
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
                            <View style={{ height: 36 }} />
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

                {/* ── Footer ──────────────────────────────────────────────── */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>{footerText}</Text>
                </View>

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

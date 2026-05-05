import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

type Money = { subtotal?: number; taxAmount?: number; grandTotal?: number };

function safeText(v: unknown) {
    return String(v ?? '').trim();
}

function fmtMoney(amount: unknown, currency: string) {
    const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : Number(amount || 0);
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
    } catch {
        return `${n} ${currency}`;
    }
}

const TEAL = '#0d9488';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_100 = '#f1f5f9';
const SLATE_50 = '#f8fafc';

const styles = StyleSheet.create({
    page: {
        paddingTop: 36,
        paddingBottom: 64,
        paddingHorizontal: 36,
        fontSize: 10.5,
        fontFamily: 'Helvetica',
        color: SLATE_900,
        lineHeight: 1.45,
    },

    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
    eyebrow: {
        fontSize: 9,
        color: TEAL,
        fontFamily: 'Helvetica-Bold',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    title: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 6, color: SLATE_900 },
    subtitle: { fontSize: 11, color: SLATE_500 },
    meta: { fontSize: 10, color: SLATE_700 },
    metaStrong: { fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    metaBlock: { textAlign: 'right' },

    divider: { height: 1, backgroundColor: SLATE_100, marginVertical: 14 },

    sectionTitle: {
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 8,
        color: SLATE_900,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    section: { marginBottom: 16 },

    card: {
        borderWidth: 1,
        borderColor: SLATE_100,
        borderRadius: 6,
        padding: 12,
        backgroundColor: '#ffffff',
    },
    softCard: {
        borderWidth: 1,
        borderColor: SLATE_100,
        borderRadius: 6,
        padding: 12,
        backgroundColor: SLATE_50,
    },

    body: { fontSize: 10.5, color: SLATE_700, lineHeight: 1.55 },
    muted: { color: SLATE_500 },

    listItem: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    bullet: {
        width: 9,
        color: TEAL,
        fontFamily: 'Helvetica-Bold',
    },

    twoCol: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },

    pricingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    pricingLabel: { color: SLATE_700 },
    pricingValue: { color: SLATE_900, fontFamily: 'Helvetica-Bold' },
    pricingTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: SLATE_100,
    },
    pricingTotalLabel: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_900,
    },
    pricingTotalValue: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        color: TEAL,
    },

    milestoneRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_100,
    },
    milestoneRowLast: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    milestoneIndex: {
        backgroundColor: TEAL,
        color: '#ffffff',
        fontFamily: 'Helvetica-Bold',
        fontSize: 9,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 3,
        marginRight: 8,
    },
    milestoneLabel: { fontSize: 10.5, color: SLATE_900, fontFamily: 'Helvetica-Bold' },
    milestoneNote: { fontSize: 9, color: SLATE_500, marginTop: 2 },
    milestonePercentage: { fontSize: 11, color: TEAL, fontFamily: 'Helvetica-Bold' },
    milestoneAmount: { fontSize: 9.5, color: SLATE_700, marginLeft: 8 },

    phaseHeading: {
        fontSize: 11,
        color: SLATE_900,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 4,
    },
    phaseSub: {
        fontSize: 9.5,
        color: SLATE_500,
        marginBottom: 6,
    },

    techPill: {
        backgroundColor: SLATE_100,
        color: SLATE_700,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 3,
        fontSize: 9,
        marginRight: 4,
        marginBottom: 4,
    },
    pillsRow: { flexDirection: 'row', flexWrap: 'wrap' },

    footer: {
        position: 'absolute',
        bottom: 24,
        left: 36,
        right: 36,
        fontSize: 9,
        color: SLATE_500,
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: SLATE_100,
        paddingTop: 8,
    },
});

interface IPaymentMilestone {
    label: string;
    percentage: number;
    note?: string;
}

interface IPhase {
    title?: string;
    description?: string;
    items?: string[];
    startDate?: string;
    endDate?: string;
}

interface IAdditionalService {
    title: string;
    price: number;
    billingCycle?: string;
    description?: string;
}

export function QuotationPdf({
    quotation,
    clientName,
    currency,
}: {
    quotation: any;
    clientName: string;
    currency: string;
}) {
    const qTitle = safeText(quotation?.details?.title || 'Quotation');
    const qNumber = safeText(quotation?.quotationNumber || '');
    const overview = safeText(quotation?.overview || '');
    const totals: Money = quotation?.totals || {};
    const issueDate = safeText(quotation?.details?.date || '');
    const validUntil = safeText(quotation?.details?.validUntil || '');

    const tools: string[] = Array.isArray(quotation?.techStack?.tools)
        ? quotation.techStack.tools
        : [];
    const frontend = safeText(quotation?.techStack?.frontend || '');
    const backend = safeText(quotation?.techStack?.backend || '');
    const database = safeText(quotation?.techStack?.database || '');
    const workflow: string[] = Array.isArray(quotation?.workflow)
        ? quotation.workflow.filter(Boolean)
        : [];

    const phases: IPhase[] = Array.isArray(quotation?.phases) ? quotation.phases : [];
    const additionalServices: IAdditionalService[] = Array.isArray(
        quotation?.additionalServices,
    )
        ? quotation.additionalServices
        : [];
    const milestones: IPaymentMilestone[] = Array.isArray(
        quotation?.paymentMilestones,
    )
        ? quotation.paymentMilestones
        : [];

    const pricing = quotation?.pricing || {};
    const basePrice = Number(pricing.basePrice || 0);
    const additionalServicesTotal = additionalServices.reduce(
        (s, x) => s + Number(x.price || 0),
        0,
    );
    const subtotalBeforeDiscount = basePrice + additionalServicesTotal;
    const discountRate = Number(pricing.discount || 0);
    const taxRate = Number(pricing.taxRate || 0);
    const discountAmount = (subtotalBeforeDiscount * discountRate) / 100;
    const grandTotal = Number(totals.grandTotal ?? 0);

    const formatDate = (raw: string) => {
        if (!raw) return '—';
        const d = new Date(raw);
        if (!Number.isFinite(d.getTime())) return raw;
        try {
            return new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            }).format(d);
        } catch {
            return raw;
        }
    };

    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>
                {/* HEADER */}
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.eyebrow}>Quotation</Text>
                        <Text style={styles.title}>{qTitle}</Text>
                        <Text style={styles.subtitle}>
                            For{' '}
                            <Text style={{ fontFamily: 'Helvetica-Bold', color: SLATE_900 }}>
                                {clientName}
                            </Text>
                        </Text>
                    </View>
                    <View style={styles.metaBlock}>
                        {qNumber ? (
                            <Text style={styles.meta}>
                                Ref. <Text style={styles.metaStrong}>{qNumber}</Text>
                            </Text>
                        ) : null}
                        {issueDate ? (
                            <Text style={[styles.meta, { marginTop: 3 }]}>
                                Issued{' '}
                                <Text style={styles.metaStrong}>{formatDate(issueDate)}</Text>
                            </Text>
                        ) : null}
                        {validUntil ? (
                            <Text style={[styles.meta, { marginTop: 3 }]}>
                                Valid until{' '}
                                <Text style={styles.metaStrong}>{formatDate(validUntil)}</Text>
                            </Text>
                        ) : null}
                        <View
                            style={{
                                marginTop: 10,
                                backgroundColor: SLATE_50,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: SLATE_100,
                            }}
                        >
                            <Text style={[styles.eyebrow, { color: SLATE_500, marginBottom: 2 }]}>
                                Project Total
                            </Text>
                            <Text
                                style={{
                                    fontSize: 16,
                                    color: TEAL,
                                    fontFamily: 'Helvetica-Bold',
                                }}
                            >
                                {fmtMoney(grandTotal, currency)}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* OVERVIEW */}
                {overview ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Overview</Text>
                        <View style={styles.softCard}>
                            <Text style={styles.body}>{overview}</Text>
                        </View>
                    </View>
                ) : null}

                {/* SCOPE OF WORK */}
                {(frontend || backend || database || tools.length || workflow.length) ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Scope of Work</Text>
                        <View style={styles.card}>
                            {frontend || backend || database ? (
                                <View style={{ marginBottom: 10 }}>
                                    <Text style={[styles.body, styles.muted, { marginBottom: 4 }]}>
                                        Technology
                                    </Text>
                                    <View style={styles.pillsRow}>
                                        {frontend ? <Text style={styles.techPill}>{frontend}</Text> : null}
                                        {backend ? <Text style={styles.techPill}>{backend}</Text> : null}
                                        {database ? <Text style={styles.techPill}>{database}</Text> : null}
                                        {tools.map((t, i) => (
                                            <Text key={`tool-${i}`} style={styles.techPill}>
                                                {safeText(t)}
                                            </Text>
                                        ))}
                                    </View>
                                </View>
                            ) : tools.length ? (
                                <View style={{ marginBottom: 10 }}>
                                    <Text style={[styles.body, styles.muted, { marginBottom: 4 }]}>
                                        Tooling
                                    </Text>
                                    <View style={styles.pillsRow}>
                                        {tools.map((t, i) => (
                                            <Text key={`tool-${i}`} style={styles.techPill}>
                                                {safeText(t)}
                                            </Text>
                                        ))}
                                    </View>
                                </View>
                            ) : null}

                            {workflow.length ? (
                                <View>
                                    <Text style={[styles.body, styles.muted, { marginBottom: 4 }]}>
                                        Workflow
                                    </Text>
                                    {workflow.map((step, i) => (
                                        <View key={`wf-${i}`} style={styles.listItem}>
                                            <Text style={styles.bullet}>{i + 1}.</Text>
                                            <Text style={[styles.body, { flex: 1 }]}>
                                                {safeText(step)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    </View>
                ) : null}

                {/* PHASES / DELIVERABLES */}
                {phases.length ? (
                    <View style={styles.section} wrap>
                        <Text style={styles.sectionTitle}>Project Phases & Deliverables</Text>
                        {phases.map((p, idx) => (
                            <View
                                key={`phase-${idx}`}
                                style={[styles.card, { marginBottom: 8 }]}
                                wrap
                            >
                                <View wrap={false}>
                                    <Text style={styles.phaseHeading}>
                                        Phase {idx + 1}: {safeText(p?.title || 'Untitled')}
                                    </Text>
                                    {(p?.startDate || p?.endDate) ? (
                                        <Text style={styles.phaseSub}>
                                            {p?.startDate ? formatDate(safeText(p.startDate)) : 'TBD'}
                                            {' → '}
                                            {p?.endDate ? formatDate(safeText(p.endDate)) : 'TBD'}
                                        </Text>
                                    ) : null}
                                    {p?.description ? (
                                        <Text style={[styles.body, { marginBottom: 6 }]}>
                                            {safeText(p.description)}
                                        </Text>
                                    ) : null}
                                </View>
                                {Array.isArray(p?.items) && p.items.length ? (
                                    <View>
                                        {p.items.map((it, i2) => (
                                            <View key={`item-${idx}-${i2}`} style={styles.listItem} wrap={false}>
                                                <Text style={styles.bullet}>•</Text>
                                                <Text style={[styles.body, { flex: 1 }]}>
                                                    {safeText(it)}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        ))}
                    </View>
                ) : null}

                {/* PRICING BREAKDOWN */}
                <View style={styles.section} wrap>
                    <Text style={styles.sectionTitle}>Pricing Breakdown</Text>
                    <View style={styles.card} wrap>
                        <View style={styles.pricingRow} wrap={false}>
                            <Text style={styles.pricingLabel}>Base price</Text>
                            <Text style={styles.pricingValue}>{fmtMoney(basePrice, currency)}</Text>
                        </View>

                        {additionalServices.length ? (
                            <>
                                {additionalServices.map((s, i) => (
                                    <View key={`add-${i}`} style={styles.pricingRow} wrap={false}>
                                        <Text style={[styles.pricingLabel, { flex: 1 }]}>
                                            + {safeText(s.title)}
                                            {s.billingCycle
                                                ? ` (${safeText(s.billingCycle)})`
                                                : ''}
                                        </Text>
                                        <Text style={styles.pricingValue}>
                                            {fmtMoney(s.price, currency)}
                                        </Text>
                                    </View>
                                ))}
                            </>
                        ) : null}

                        {discountRate > 0 ? (
                            <View style={styles.pricingRow} wrap={false}>
                                <Text style={styles.pricingLabel}>
                                    Discount ({discountRate}%)
                                </Text>
                                <Text style={[styles.pricingValue, { color: '#dc2626' }]}>
                                    − {fmtMoney(discountAmount, currency)}
                                </Text>
                            </View>
                        ) : null}

                        <View
                            style={{
                                height: 1,
                                backgroundColor: SLATE_100,
                                marginVertical: 6,
                            }}
                        />

                        <View style={styles.pricingRow} wrap={false}>
                            <Text style={styles.pricingLabel}>Subtotal (net)</Text>
                            <Text style={styles.pricingValue}>
                                {fmtMoney(totals.subtotal, currency)}
                            </Text>
                        </View>
                        <View style={styles.pricingRow} wrap={false}>
                            <Text style={styles.pricingLabel}>
                                Tax ({taxRate}%)
                            </Text>
                            <Text style={styles.pricingValue}>
                                {fmtMoney(totals.taxAmount, currency)}
                            </Text>
                        </View>

                        <View style={styles.pricingTotalRow} wrap={false}>
                            <Text style={styles.pricingTotalLabel}>Grand Total</Text>
                            <Text style={styles.pricingTotalValue}>
                                {fmtMoney(grandTotal, currency)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* PAYMENT MILESTONES */}
                {milestones.length ? (
                    <View style={styles.section} wrap>
                        <Text style={styles.sectionTitle}>Payment Milestones</Text>
                        <View style={styles.card} wrap>
                            {milestones.map((m, i) => {
                                const isLast = i === milestones.length - 1;
                                const amount = (grandTotal * (m.percentage || 0)) / 100;
                                return (
                                    <View
                                        key={`m-${i}`}
                                        style={isLast ? styles.milestoneRowLast : styles.milestoneRow}
                                        wrap={false}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <Text style={styles.milestoneIndex}>{i + 1}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.milestoneLabel}>
                                                    {safeText(m.label)}
                                                </Text>
                                                {m.note ? (
                                                    <Text style={styles.milestoneNote}>
                                                        {safeText(m.note)}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                            <Text style={styles.milestonePercentage}>
                                                {m.percentage}%
                                            </Text>
                                            <Text style={styles.milestoneAmount}>
                                                {fmtMoney(amount, currency)}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ) : null}

                <Text
                    style={styles.footer}
                    fixed
                    render={({ pageNumber, totalPages }) =>
                        `${qTitle} • ${qNumber || 'Quotation'}  —  Page ${pageNumber} of ${totalPages}`
                    }
                />
            </Page>
        </Document>
    );
}

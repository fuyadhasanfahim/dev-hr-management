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

// ─── Design tokens (matches client-side PDF) ────────────────────────────────
const TEAL = '#0d9488';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';
const SLATE_50 = '#f8fafc';

const styles = StyleSheet.create({
    page: {
        paddingTop: 40,
        paddingBottom: 70,
        paddingHorizontal: 40,
        fontSize: 9.5,
        fontFamily: 'Helvetica',
        color: SLATE_700,
        lineHeight: 1.5,
    },

    // Header
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: 'flex-end' },
    eyebrow: {
        fontSize: 8,
        color: TEAL,
        fontFamily: 'Helvetica-Bold',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    title: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_900,
        letterSpacing: 1.5,
    },
    titleAccent: {
        height: 2.5,
        width: 50,
        backgroundColor: TEAL,
        marginTop: 8,
        marginBottom: 10,
    },
    subtitle: { fontSize: 10, color: SLATE_500 },
    meta: { fontSize: 9, color: SLATE_500, marginBottom: 2, textAlign: 'right' as const },
    metaStrong: { fontFamily: 'Helvetica-Bold', color: SLATE_900 },

    // Divider
    divider: { height: 1, backgroundColor: SLATE_100, marginVertical: 16 },

    // Billing
    billingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    billingCol: { width: '48%' },
    billingColRight: { width: '48%', alignItems: 'flex-end' as const },
    billingLabel: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: TEAL,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    billingName: {
        fontSize: 10.5,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_900,
        marginBottom: 3,
    },
    billingText: {
        fontSize: 9,
        color: SLATE_500,
        lineHeight: 1.45,
        marginBottom: 1,
    },

    // Sections
    sectionTitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_900,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 18,
        marginBottom: 8,
    },
    card: {
        borderWidth: 1,
        borderColor: SLATE_100,
        borderRadius: 6,
        padding: 12,
        backgroundColor: '#ffffff',
    },
    cardSoft: {
        borderWidth: 1,
        borderColor: SLATE_100,
        borderRadius: 6,
        padding: 12,
        backgroundColor: SLATE_50,
    },
    bodyText: { fontSize: 9.5, color: SLATE_700, lineHeight: 1.55 },

    // Scope
    scopeCard: {
        borderWidth: 1,
        borderColor: SLATE_100,
        borderRadius: 6,
        padding: 12,
        marginBottom: 6,
    },
    scopeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    scopeTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    scopeCount: { fontSize: 8, color: SLATE_500 },
    scopeDesc: { fontSize: 9, color: SLATE_500, marginBottom: 6 },
    bulletRow: { flexDirection: 'row', marginBottom: 3 },
    bulletDot: { width: 10, fontSize: 9, color: TEAL, fontFamily: 'Helvetica-Bold' },
    bulletText: { flex: 1, fontSize: 9, color: SLATE_700, lineHeight: 1.4 },

    // Tags
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    tag: {
        backgroundColor: SLATE_50,
        borderWidth: 1,
        borderColor: SLATE_100,
        borderRadius: 4,
        paddingVertical: 3,
        paddingHorizontal: 7,
        marginRight: 5,
        marginBottom: 5,
    },
    tagText: { fontSize: 8, color: SLATE_700 },

    // Workflow
    workflowRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    workflowStep: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 4,
        marginBottom: 5,
    },
    workflowNum: {
        backgroundColor: TEAL,
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    workflowNumText: {
        color: '#ffffff',
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
    },
    workflowText: {
        fontSize: 8.5,
        color: SLATE_700,
        marginRight: 4,
    },
    workflowArrow: {
        fontSize: 9,
        color: SLATE_300,
        marginRight: 4,
        marginBottom: 5,
    },

    // Pricing
    pricingCard: {
        borderWidth: 1,
        borderColor: SLATE_100,
        borderRadius: 6,
        overflow: 'hidden',
    },
    pricingHeaderBar: {
        backgroundColor: SLATE_50,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_100,
    },
    pricingHeaderText: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: SLATE_500,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    pricingBody: { padding: 12 },
    pricingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_50,
    },
    pricingRowLast: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5,
    },
    pricingLabel: { fontSize: 9, color: SLATE_500 },
    pricingValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    pricingTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: SLATE_100,
    },
    pricingTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: SLATE_900 },
    pricingTotalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: TEAL },

    // Milestones
    milestoneCard: {
        borderWidth: 1,
        borderColor: SLATE_100,
        borderRadius: 6,
        overflow: 'hidden',
    },
    milestoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: SLATE_50,
    },
    milestoneRowLast: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    milestoneBadge: {
        backgroundColor: TEAL,
        color: '#ffffff',
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 3,
        marginRight: 10,
    },
    milestoneLabel: { flex: 1, fontSize: 9, color: SLATE_700 },
    milestoneAmount: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: SLATE_900 },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 24,
        left: 40,
        right: 40,
        fontSize: 8,
        color: SLATE_500,
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: SLATE_100,
        paddingTop: 8,
    },
});

// ─── Interfaces ──────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

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
    const workflowSteps: string[] = (Array.isArray(quotation?.workflow) ? quotation.workflow : [])
        .map((s: any) => safeText(s))
        .filter(Boolean);

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

    const techTags = [frontend, backend, database, ...tools].filter(Boolean);

    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>
                {/* ── Header ────────────────────────────────────────────── */}
                <View style={styles.headerRow} wrap={false}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.eyebrow}>Quotation</Text>
                        <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: SLATE_900, marginBottom: 4 }}>
                            {qTitle}
                        </Text>
                        <Text style={styles.subtitle}>
                            For{' '}
                            <Text style={{ fontFamily: 'Helvetica-Bold', color: SLATE_900 }}>
                                {clientName}
                            </Text>
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        {qNumber ? (
                            <Text style={styles.meta}>
                                Ref: <Text style={styles.metaStrong}>{qNumber}</Text>
                            </Text>
                        ) : null}
                        {issueDate ? (
                            <Text style={styles.meta}>
                                Date: <Text style={styles.metaStrong}>{formatDate(issueDate)}</Text>
                            </Text>
                        ) : null}
                        {validUntil ? (
                            <Text style={styles.meta}>
                                Valid until:{' '}
                                <Text style={styles.metaStrong}>{formatDate(validUntil)}</Text>
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View style={styles.divider} />

                {/* ── Overview ──────────────────────────────────────────── */}
                {overview ? (
                    <>
                        <Text style={styles.sectionTitle}>Overview</Text>
                        <View style={styles.cardSoft}>
                            <Text style={styles.bodyText}>{overview}</Text>
                        </View>
                    </>
                ) : null}

                {/* ── Project Scope ─────────────────────────────────────── */}
                {phases.length ? (
                    <>
                        <Text style={styles.sectionTitle}>Project Scope</Text>
                        {phases.map((p, idx) => (
                            <View key={`phase-${idx}`} style={styles.scopeCard} wrap>
                                <View style={styles.scopeHeader} wrap={false}>
                                    <Text style={styles.scopeTitle}>
                                        Phase {idx + 1}: {safeText(p?.title || 'Untitled')}
                                    </Text>
                                    <Text style={styles.scopeCount}>
                                        {p?.items?.length || 0} items
                                    </Text>
                                </View>
                                {p?.description ? (
                                    <Text style={styles.scopeDesc}>
                                        {safeText(p.description)}
                                    </Text>
                                ) : null}
                                {Array.isArray(p?.items) && p.items.length
                                    ? p.items.map((it, i2) => (
                                          <View
                                              key={`item-${idx}-${i2}`}
                                              style={styles.bulletRow}
                                              wrap={false}
                                          >
                                              <Text style={styles.bulletDot}>•</Text>
                                              <Text style={styles.bulletText}>
                                                  {safeText(it)}
                                              </Text>
                                          </View>
                                      ))
                                    : null}
                            </View>
                        ))}
                    </>
                ) : null}

                {/* ── Tech stack ────────────────────────────────────────── */}
                {techTags.length ? (
                    <>
                        <Text style={styles.sectionTitle}>Technology Stack</Text>
                        <View style={styles.card} wrap>
                            <View style={styles.tagsWrap}>
                                {techTags.map((t, i) => (
                                    <View key={`tag-${i}`} style={styles.tag}>
                                        <Text style={styles.tagText}>{safeText(t)}</Text>
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
                                    <View key={`wf-${i}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={styles.workflowStep}>
                                            <View style={styles.workflowNum}>
                                                <Text style={styles.workflowNumText}>
                                                    {i + 1}
                                                </Text>
                                            </View>
                                            <Text style={styles.workflowText}>
                                                {step}
                                            </Text>
                                        </View>
                                        {i < workflowSteps.length - 1 ? (
                                            <Text
                                                style={styles.workflowArrow}
                                            >
                                                →
                                            </Text>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </>
                ) : null}

                {/* ── Pricing ──────────────────────────────────────────── */}
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
                                <Text style={styles.pricingLabel}>Base price</Text>
                                <Text style={styles.pricingValue}>
                                    {fmtMoney(basePrice, currency)}
                                </Text>
                            </View>

                            {additionalServices.length
                                ? additionalServices.map((s, i) => (
                                      <View key={`add-${i}`} style={styles.pricingRow}>
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
                                  ))
                                : null}

                            {discountRate > 0 ? (
                                <View style={styles.pricingRow}>
                                    <Text style={styles.pricingLabel}>
                                        Discount ({discountRate}%)
                                    </Text>
                                    <Text style={[styles.pricingValue, { color: '#ef4444' }]}>
                                        − {fmtMoney(discountAmount, currency)}
                                    </Text>
                                </View>
                            ) : null}

                            <View style={styles.pricingRow}>
                                <Text style={styles.pricingLabel}>Subtotal</Text>
                                <Text style={styles.pricingValue}>
                                    {fmtMoney(totals.subtotal, currency)}
                                </Text>
                            </View>
                            <View style={styles.pricingRowLast}>
                                <Text style={styles.pricingLabel}>Tax ({taxRate}%)</Text>
                                <Text style={styles.pricingValue}>
                                    {fmtMoney(totals.taxAmount, currency)}
                                </Text>
                            </View>

                            <View style={styles.pricingTotalRow}>
                                <Text style={styles.pricingTotalLabel}>Grand Total</Text>
                                <Text style={styles.pricingTotalValue}>
                                    {fmtMoney(grandTotal, currency)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── Payment Milestones ────────────────────────────────── */}
                {milestones.length ? (
                    <>
                        <Text style={styles.sectionTitle}>Payment Terms</Text>
                        <View style={styles.milestoneCard} wrap={false}>
                            {milestones.map((m, i) => {
                                const isLast = i === milestones.length - 1;
                                const amount = (grandTotal * (m.percentage || 0)) / 100;
                                return (
                                    <View
                                        key={`m-${i}`}
                                        style={isLast ? styles.milestoneRowLast : styles.milestoneRow}
                                        wrap={false}
                                    >
                                        <Text style={styles.milestoneBadge}>
                                            {m.percentage}%
                                        </Text>
                                        <Text style={styles.milestoneLabel}>
                                            {safeText(m.label)}
                                        </Text>
                                        <Text style={styles.milestoneAmount}>
                                            {fmtMoney(amount, currency)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                ) : null}

                {/* ── Footer ───────────────────────────────────────────── */}
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

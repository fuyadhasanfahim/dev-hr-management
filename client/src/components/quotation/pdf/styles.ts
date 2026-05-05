import { StyleSheet } from "@react-pdf/renderer";

// ─── Design tokens ────────────────────────────────────────────────────────────
const colors = {
  teal: "#0d9488",
  tealLight: "#ccfbf1",
  orange: "#f97316",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate300: "#cbd5e1",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#ffffff",
  red500: "#ef4444",
};

// ─── Stylesheet ───────────────────────────────────────────────────────────────
export const styles = StyleSheet.create({
  // ── Page ──────────────────────────────────────────────────────────────────
  page: {
    paddingTop: 40,
    paddingBottom: 70,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: colors.slate700,
    lineHeight: 1.5,
    backgroundColor: colors.white,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  logoContainer: {
    width: 120,
    height: 44,
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    objectFit: "contain",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    letterSpacing: 1.5,
  },
  titleAccent: {
    height: 2.5,
    width: 50,
    backgroundColor: colors.teal,
    marginTop: 8,
    marginBottom: 10,
  },
  headerMeta: {
    fontSize: 9,
    color: colors.slate500,
    marginBottom: 2,
    textAlign: "right",
  },
  headerMetaStrong: {
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: 16,
  },

  // ── Billing ───────────────────────────────────────────────────────────────
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  billingCol: {
    width: "48%",
  },
  billingColRight: {
    width: "48%",
    alignItems: "flex-end",
  },
  billingLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.teal,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  billingName: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    marginBottom: 3,
  },
  billingText: {
    fontSize: 9,
    color: colors.slate500,
    lineHeight: 1.45,
    marginBottom: 1,
  },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    padding: 12,
    backgroundColor: colors.white,
  },
  cardSoft: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    padding: 12,
    backgroundColor: colors.slate50,
  },
  bodyText: {
    fontSize: 9.5,
    color: colors.slate700,
    lineHeight: 1.55,
  },

  // ── Project ────────────────────────────────────────────────────────────────
  projectTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
    backgroundColor: colors.slate50,
  },
  badgeText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: colors.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // ── Scope ──────────────────────────────────────────────────────────────────
  scopeCard: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    padding: 12,
    marginBottom: 6,
    backgroundColor: colors.white,
  },
  scopeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  scopeTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },
  scopeCount: {
    fontSize: 8,
    color: colors.slate500,
  },
  scopeDesc: {
    fontSize: 9,
    color: colors.slate500,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bulletDot: {
    width: 10,
    fontSize: 9,
    color: colors.teal,
    fontFamily: "Helvetica-Bold",
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: colors.slate700,
    lineHeight: 1.4,
  },

  // ── Services table ─────────────────────────────────────────────────────────
  tableWrap: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.slate50,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  tableHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  tableRowEven: {
    backgroundColor: colors.slate50,
  },
  tableCell: {
    fontSize: 9,
    color: colors.slate700,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  colNo: { width: "7%", textAlign: "center" },
  colName: { width: "53%", textAlign: "left" },
  colQty: { width: "10%", textAlign: "center" },
  colRate: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },

  // ── Tags (tech stack) ──────────────────────────────────────────────────────
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginRight: 5,
    marginBottom: 5,
  },
  tagText: {
    fontSize: 8,
    color: colors.slate700,
  },

  // ── Workflow ────────────────────────────────────────────────────────────────
  workflowRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  workflowStep: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
    marginBottom: 5,
  },
  workflowNum: {
    backgroundColor: colors.teal,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  workflowNumText: {
    color: colors.white,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  workflowText: {
    fontSize: 8.5,
    color: colors.slate700,
    marginRight: 4,
  },
  workflowArrow: {
    fontSize: 9,
    color: colors.slate300,
    marginRight: 4,
    marginBottom: 5,
  },

  // ── Pricing ────────────────────────────────────────────────────────────────
  pricingCard: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    overflow: "hidden",
  },
  pricingHeaderBar: {
    backgroundColor: colors.slate50,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  pricingHeaderText: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: colors.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pricingBody: {
    padding: 12,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate50,
  },
  pricingRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  pricingLabel: {
    fontSize: 9,
    color: colors.slate500,
  },
  pricingValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },
  pricingDiscount: {
    color: colors.red500,
  },
  pricingTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  pricingTotalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },
  pricingTotalValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.teal,
  },

  // ── Payment milestones ─────────────────────────────────────────────────────
  milestoneCard: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    overflow: "hidden",
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate50,
  },
  milestoneRowLast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  milestoneBadge: {
    backgroundColor: colors.teal,
    color: colors.white,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  milestoneLabel: {
    flex: 1,
    fontSize: 9,
    color: colors.slate700,
  },
  milestoneAmount: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },

  // ── Trust band ─────────────────────────────────────────────────────────────
  trustBand: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    padding: 12,
    backgroundColor: colors.white,
  },
  trustTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    marginBottom: 3,
  },
  trustText: {
    fontSize: 8.5,
    color: colors.slate500,
    lineHeight: 1.4,
  },

  // ── CTA / Pay Now ──────────────────────────────────────────────────────────
  ctaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    padding: 14,
    backgroundColor: colors.slate50,
  },
  ctaLeft: {
    flex: 1,
    paddingRight: 16,
  },
  ctaHeading: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: colors.teal,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  ctaDesc: {
    fontSize: 8.5,
    color: colors.slate500,
    lineHeight: 1.4,
  },
  ctaRight: {
    width: 150,
  },
  ctaButton: {
    backgroundColor: colors.teal,
    paddingVertical: 9,
    borderRadius: 4,
  },
  ctaButtonText: {
    color: colors.white,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: colors.teal,
    paddingVertical: 7,
    borderRadius: 4,
    marginTop: 5,
  },
  ctaSecondaryText: {
    color: colors.teal,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },

  // ── Signature ──────────────────────────────────────────────────────────────
  signatureSection: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
  },
  signatureBlock: {
    width: "45%",
  },
  signatureImage: {
    width: 110,
    height: 36,
    objectFit: "contain",
  },
  signatureLine: {
    height: 1,
    backgroundColor: colors.slate300,
    marginTop: 4,
    marginBottom: 5,
  },
  signatureName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },
  signatureRole: {
    fontSize: 8,
    color: colors.slate500,
    marginTop: 1,
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: colors.slate500,
    textAlign: "center",
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 40,
    fontSize: 8,
    color: colors.slate500,
  },
});
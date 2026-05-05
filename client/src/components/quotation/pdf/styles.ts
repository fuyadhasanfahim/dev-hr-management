import { StyleSheet } from "@react-pdf/renderer";

const colors = {
  teal: "#0d9488",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  white: "#FFFFFF",
  border: "#e2e8f0",
  accent: "#FF8A00", 
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 64,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: colors.slate700,
    lineHeight: 1.5,
    backgroundColor: colors.white,
  },

  // Header Section
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  logoContainer: {
    width: 140,
    height: 50,
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    objectFit: "contain",
  },
  headerDetailsContainer: {
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    letterSpacing: 1,
    marginBottom: 6,
  },
  titleUnderline: {
    height: 3,
    width: 60,
    backgroundColor: colors.teal,
    marginBottom: 10,
  },
  headerDetailText: {
    fontSize: 9.5,
    color: colors.slate500,
    marginBottom: 3,
  },
  headerHighlightText: {
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: 16,
  },

  // Bill From / Bill To Section
  addressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 20,
  },
  addressBox: {
    flex: 1,
  },
  boxTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.teal,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  boxTextStrong: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    marginBottom: 4,
  },
  boxText: {
    fontSize: 9.5,
    color: colors.slate700,
    marginBottom: 2,
    lineHeight: 1.4,
  },

  // Section headings
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
  },
  sectionBox: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    padding: 12,
    backgroundColor: colors.white,
  },
  sectionText: {
    fontSize: 10,
    color: colors.slate700,
    lineHeight: 1.5,
  },

  // Project title block
  projectTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    marginBottom: 6,
  },
  projectMetaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metaBadge: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: colors.slate50,
  },
  metaBadgeText: {
    fontSize: 8,
    color: colors.slate700,
    fontFamily: "Helvetica-Bold",
  },

  // Tags (tech stack)
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 8.5,
    color: colors.slate700,
  },

  // Workflow inline
  workflowInline: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  workflowStep: {
    marginRight: 6,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  workflowStepText: {
    fontSize: 9.5,
    color: colors.slate700,
  },
  workflowArrow: {
    fontSize: 9,
    color: colors.teal,
    marginRight: 6,
    marginBottom: 6,
  },

  // Full scope cards
  scopeCard: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  scopeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  scopeTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },
  scopeCountBadge: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
    backgroundColor: colors.slate50,
  },
  scopeCountBadgeText: {
    fontSize: 8.5,
    color: colors.slate500,
  },
  sectionSubText: {
    fontSize: 9.5,
    color: colors.slate500,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletDot: {
    width: 10,
    fontSize: 10,
    color: colors.teal,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: colors.slate700,
  },

  // Table Section
  tableContainer: {
    marginTop: 8,
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
    color: colors.slate500,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    paddingVertical: 8,
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
  tableRowLast: {
    flexDirection: "row",
  },
  tableCell: {
    fontSize: 9.5,
    color: colors.slate700,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableCellStrong: {
    color: colors.slate900,
    fontFamily: "Helvetica-Bold",
  },

  // Column Widths
  colNo: { width: "8%", textAlign: "center" },
  colName: { width: "52%", textAlign: "left" },
  colQty: { width: "10%", textAlign: "center" },
  colRate: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },

  // Pricing breakdown (compact table-like)
  pricingBox: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  pricingHeader: {
    backgroundColor: colors.slate50,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  pricingHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.slate700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pricingBody: {
    padding: 12,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate50,
  },
  pricingRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  pricingLabel: {
    fontSize: 9.5,
    color: colors.slate700,
  },
  pricingValue: {
    fontSize: 9.5,
    color: colors.slate900,
    fontFamily: "Helvetica-Bold",
  },
  pricingTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
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

  // Payment plan section
  paymentPlanBox: {
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    overflow: "hidden",
  },
  paymentMilestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate50,
  },
  paymentMilestoneRowLast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  milestoneBadge: {
    backgroundColor: colors.teal,
    color: colors.white,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginRight: 10,
  },
  paymentMilestoneLabel: {
    flex: 1,
    fontSize: 9.5,
    color: colors.slate900,
  },
  paymentMilestoneValue: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: colors.slate700,
  },

  // Pay Now Section
  payNowSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    padding: 16,
    backgroundColor: colors.slate50,
  },
  payNowTextContainer: {
    flex: 1,
    paddingRight: 20,
  },
  payNowHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.teal,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  payNowDescription: {
    fontSize: 9,
    color: colors.slate500,
    lineHeight: 1.4,
  },
  payNowButtonContainer: {
    width: 160,
  },
  payNowButton: {
    backgroundColor: colors.teal,
    paddingVertical: 10,
    borderRadius: 4,
  },
  payNowSecondaryButton: {
    borderWidth: 1,
    borderColor: colors.teal,
    paddingVertical: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  payNowText: {
    color: colors.white,
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  payNowSecondaryText: {
    color: colors.teal,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },

  // Trust statement
  trustBand: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 6,
    backgroundColor: colors.white,
    padding: 12,
  },
  trustTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
    marginBottom: 4,
  },
  trustText: {
    fontSize: 9,
    color: colors.slate500,
    lineHeight: 1.4,
  },

  // Signature
  signatureSection: {
    marginTop: 30,
    paddingTop: 16,
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
    width: 120,
    height: 40,
    objectFit: "contain",
  },
  signatureLine: {
    height: 1,
    backgroundColor: colors.slate100,
    marginTop: 4,
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: colors.slate900,
  },
  signatureRole: {
    fontSize: 8.5,
    color: colors.slate500,
    marginTop: 2,
  },

  // Footer Section
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
    fontSize: 8.5,
    color: colors.slate500,
    textAlign: "center",
  },

  // Page number
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 40,
    fontSize: 8.5,
    color: colors.slate500,
  },
});
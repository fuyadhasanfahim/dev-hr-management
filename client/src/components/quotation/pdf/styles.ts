import { StyleSheet } from "@react-pdf/renderer";

// Quotation PDF styles intentionally match InvoicePDF look & feel.
const colors = {
  orange: "#FF8A00",
  teal: "#009999",
  gray: "#464646",
  lightGray: "#F0F0F0",
  white: "#FFFFFF",
  border: "#E0E0E0",
};

export const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: colors.white,
    fontFamily: "Helvetica",
    paddingBottom: 60, // space for footer
  },

  // Top Orange Bar
  topBar: {
    height: 8,
    backgroundColor: colors.orange,
    width: "100%",
    marginBottom: 20,
  },

  // Header Section
  headerContainer: {
    marginHorizontal: 40,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    height: 100,
  },
  logoContainer: {
    width: 150,
    height: 70,
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
    fontSize: 32,
    fontWeight: "bold",
    color: colors.teal,
    marginBottom: 5,
  },
  titleUnderline: {
    height: 4,
    width: 170,
    backgroundColor: colors.orange,
    marginBottom: 15,
  },
  headerDetailText: {
    fontSize: 11,
    color: colors.gray,
    marginBottom: 4,
  },

  // Bill From / Bill To Section
  addressContainer: {
    flexDirection: "row",
    marginHorizontal: 40,
    marginTop: 18,
    justifyContent: "space-between",
    gap: 14,
  },
  addressBox: {
    flex: 1,
    flexDirection: "row",
    height: 90,
  },
  accentBar: {
    width: 8,
    height: "100%",
  },
  addressContent: {
    flex: 1,
    padding: 15,
  },
  // Bill From specifics
  billFromBox: {
    backgroundColor: colors.teal,
  },
  billFromAccent: {
    backgroundColor: colors.orange,
  },
  billFromText: {
    color: colors.white,
  },
  // Bill To specifics
  billToBox: {
    backgroundColor: colors.orange,
  },
  billToAccent: {
    backgroundColor: colors.teal,
  },
  billToText: {
    color: colors.white,
  },
  boxTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 10,
  },
  boxText: {
    fontSize: 9,
    marginBottom: 2,
    lineHeight: 1.3,
  },

  // Section headings (invoice-like)
  sectionTitle: {
    marginHorizontal: 40,
    marginTop: 12,
    marginBottom: 6,
    fontSize: 10,
    fontWeight: "bold",
    color: colors.teal,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionBox: {
    marginHorizontal: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  sectionText: {
    fontSize: 9,
    color: colors.gray,
    lineHeight: 1.4,
  },
  sectionSubText: {
    fontSize: 8,
    color: colors.gray,
    lineHeight: 1.35,
    marginTop: 4,
  },

  // Project title block
  projectTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray,
    lineHeight: 1.2,
  },
  projectMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    flexWrap: "wrap",
  },
  metaBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: "#FAFAFA",
  },
  metaBadgeText: {
    fontSize: 8,
    color: colors.gray,
    fontWeight: "bold",
  },

  // Tags (tech stack)
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagText: {
    fontSize: 8,
    color: colors.gray,
    fontWeight: "bold",
  },

  // Workflow inline
  workflowInline: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  workflowStep: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  workflowStepText: {
    fontSize: 8,
    color: colors.gray,
    fontWeight: "bold",
  },
  workflowArrow: {
    fontSize: 9,
    color: colors.gray,
    marginHorizontal: 2,
  },

  // Full scope cards
  scopeCard: {
    marginHorizontal: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    backgroundColor: "#FFFFFF",
  },
  scopeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  scopeTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: colors.teal,
  },
  scopeCountBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
    backgroundColor: "#FAFAFA",
  },
  scopeCountBadgeText: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: colors.gray,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 3,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.orange,
    marginTop: 5,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.3,
    color: colors.gray,
    lineHeight: 1.35,
  },

  // Payment plan section
  paymentPlanBox: {
    marginHorizontal: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  paymentPlanHeader: {
    backgroundColor: colors.teal,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  paymentPlanHeaderText: {
    fontSize: 8.5,
    color: colors.white,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  paymentMilestoneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F3F3",
  },
  paymentMilestoneRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  paymentMilestoneLabel: {
    fontSize: 8.6,
    color: colors.gray,
  },
  paymentMilestoneValue: {
    fontSize: 8.6,
    fontWeight: "bold",
    color: colors.gray,
  },

  // Trust statement
  trustBand: {
    marginHorizontal: 40,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: "#F9FEFD",
    padding: 10,
  },
  trustTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.teal,
    marginBottom: 4,
  },
  trustText: {
    fontSize: 8.3,
    color: colors.gray,
    lineHeight: 1.35,
  },

  // Pricing breakdown (compact table-like)
  pricingBox: {
    marginHorizontal: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  pricingHeader: {
    backgroundColor: "#FAFAFA",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pricingHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.gray,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pricingBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F3F3",
  },
  pricingRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  pricingLabel: {
    fontSize: 9,
    color: colors.gray,
  },
  pricingValue: {
    fontSize: 9,
    color: colors.gray,
    fontWeight: "bold",
  },
  pricingTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pricingTotalLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.teal,
  },
  pricingTotalValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.teal,
  },

  // Signature (minimal)
  signatureSection: {
    marginTop: 18,
    marginHorizontal: 40,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    marginTop: 10,
  },
  signatureBlock: {
    width: "48%",
  },
  signatureImage: {
    width: 140,
    height: 42,
    objectFit: "contain",
  },
  signatureLine: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 8,
    marginBottom: 6,
  },
  signatureName: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.gray,
  },
  signatureRole: {
    fontSize: 8,
    color: colors.gray,
    marginTop: 2,
  },

  // Table Section
  tableContainer: {
    marginTop: 4,
    marginHorizontal: 40,
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderColor: colors.border,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.teal,
  },
  tableHeaderText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
    paddingVertical: 8,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: colors.border,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableRowEven: {
    backgroundColor: colors.lightGray,
  },
  tableCell: {
    fontSize: 9,
    color: colors.gray,
    textAlign: "center",
    paddingVertical: 8,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: colors.border,
  },

  // Column Widths
  colNo: { width: "8%" },
  colName: { width: "52%", textAlign: "left", paddingLeft: 5 },
  colQty: { width: "10%" },
  colRate: { width: "15%" },
  colTotal: { width: "15%" },

  // Total Section
  totalContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 25,
    marginHorizontal: 40,
  },
  totalBox: {
    width: 200,
    height: 40,
    flexDirection: "row",
    backgroundColor: colors.orange,
  },
  totalAccent: {
    width: 8,
    height: "100%",
    backgroundColor: colors.teal,
  },
  totalContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
  },
  totalLabel: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "bold",
  },
  totalValue: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "bold",
  },

  // Footer Section
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: colors.teal,
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: colors.white,
    textAlign: "center",
  },

  // Page number
  pageNumber: {
    position: "absolute",
    bottom: 35,
    right: 40,
    fontSize: 8,
    color: colors.gray,
  },

  // Pay Now Section
  payNowSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 40,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    backgroundColor: "#fdfdfd",
    paddingHorizontal: 15,
    borderRadius: 4,
  },
  payNowTextContainer: {
    flex: 1,
    paddingRight: 20,
  },
  payNowHeading: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.teal,
    marginBottom: 4,
  },
  payNowDescription: {
    fontSize: 8,
    color: colors.gray,
    lineHeight: 1.4,
  },
  payNowButtonContainer: {
    width: 190,
  },
  payNowButton: {
    backgroundColor: colors.teal,
    paddingVertical: 10,
    borderRadius: 4,
  },
  payNowSecondaryButton: {
    borderWidth: 1,
    borderColor: colors.orange,
    paddingVertical: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  payNowText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  payNowSecondaryText: {
    color: colors.orange,
    fontSize: 8.5,
    fontWeight: "bold",
    textAlign: "center",
  },
});
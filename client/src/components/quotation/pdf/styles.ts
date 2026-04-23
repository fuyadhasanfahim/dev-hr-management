import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  // ── Page ──
  page: {
    fontSize: 11,
    color: "#374151",
    lineHeight: 1.4,
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 35,
    fontFamily: "Helvetica",
  },

  // ── Header ──
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  companyInfo: {
    width: "55%",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  logo: {
    height: 40,
    objectFit: "contain",
    marginBottom: 6,
  },
  companyName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  companyAddress: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 2,
    lineHeight: 1.4,
  },

  // ── Quotation Meta ──
  quotationMeta: {
    width: "40%",
    alignItems: "flex-end",
  },
  titleLabel: {
    fontSize: 20,
    color: "#019689", // Teal accent
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: "Helvetica-Bold",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: "#6B7280",
    fontFamily: "Helvetica-Bold",
    width: 65,
    textAlign: "right",
    marginRight: 8,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    width: 85,
    textAlign: "left",
  },

  // ── Quotation Title ──
  quotationTitle: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ── Client ──
  clientSection: {
    flexDirection: "row",
    marginTop: 4,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  clientCol: {
    width: "50%",
  },
  clientFor: {
    fontSize: 9,
    color: "#9CA3AF",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  clientName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  clientCompany: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginTop: 2,
  },
  clientDetail: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 3,
  },

  // ── Generic Structured Content ──
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#019689", // Teal accent
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionHeadingAlt: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#F3F4F6",
    padding: 6,
    color: "#111827",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── Features ──
  featuresGrid: {
    flexDirection: "column",
    marginBottom: 6,
  },
  featureItem: {
    width: "50%",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    paddingRight: 10,
  },
  featureCheck: {
    fontSize: 10,
    color: "#019689",
    marginRight: 6,
    fontFamily: "Helvetica-Bold",
  },
  featureText: {
    fontSize: 10,
    color: "#374151",
    flex: 1,
    lineHeight: 1.4,
  },

  // ── Technology Stack ──
  techSection: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 6,
  },
  techCategoryRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  techCategoryLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#4B5563",
    textTransform: "uppercase",
    width: 65,
    marginTop: 3,
  },
  techBadgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    flex: 1,
    gap: 4,
  },
  techBadgeFrontend: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  techBadgeFrontendText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
  techBadgeBackend: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  techBadgeBackendText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
  techBadgeDesign: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  techBadgeDesignText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },

  // ── Delivery Timeline ──
  deliveryBox: {
    paddingVertical: 4,
    marginBottom: 12,
  },
  deliveryText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
  },

  // ── Totals ──
  totalsBox: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
    borderRadius: 6,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  totalsLabel: { fontSize: 10, color: "#4B5563" },
  totalsValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111827" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  grandTotalValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#019689",
  },

  // ── Terms & Notes ──
  termsSection: {
    marginTop: 24,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#FAFAFA",
    borderLeftWidth: 3,
    borderLeftColor: "#019689",
  },
  termsText: {
    fontSize: 10,
    color: "#4B5563",
    lineHeight: 1.5,
  },

  // ── Footer Note ──
  footerNote: {
    fontSize: 9,
    color: "#9CA3AF",
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },

  // ── Signature Section ──
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
    paddingTop: 15,
  },
  signatureBlock: {
    width: "45%",
    flexDirection: "column",
  },
  signatureImage: {
    width: 80,
    height: "auto",
    marginBottom: 4,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
    marginTop: 8,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  signatureRole: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 1,
  },
  signatureCompany: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#019689",
    marginTop: 1,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },

  // ── Page Number ──
  pageNumber: {
    position: "absolute",
    bottom: 15,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: "#9CA3AF",
  },
});

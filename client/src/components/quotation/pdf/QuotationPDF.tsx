"use client";

import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { QuotationData } from '@/types/quotation.type';
import { format } from 'date-fns';

const formatCurrency = (amount: number, currency: string) => {
  return `${currency}${amount.toLocaleString()}`;
};

interface QuotationPDFProps {
  data: QuotationData;
}

export const QuotationPDF = ({ data }: QuotationPDFProps) => {
  const { totals, pricing, techStack, phases, additionalServices, workflow, details, client, company } = data;

  const hasTech =
    techStack.frontend ||
    techStack.backend ||
    techStack.database ||
    techStack.tools.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ── HEADER ── */}
        <View style={styles.headerSection}>
          <View style={styles.companyInfo}>
            {company.logo ? (
              <Image 
                src={{ uri: "https://res.cloudinary.com/dny7zfbg9/image/upload/v1755954483/mqontecf1xao7znsh6cx.png" }} 
                style={{ width: 120, height: 40, objectFit: 'contain', marginBottom: 8 }} 
              />
            ) : (
              <Text style={styles.companyName}>{company.name}</Text>
            )}
            <Text style={styles.companyAddress}>{company.address}</Text>
            <Text style={styles.companyAddress}>{company.email} | {company.phone}</Text>
            <Text style={{ ...styles.companyAddress, color: '#4B5563', marginTop: 3 }}>{company.website}</Text>
          </View>
          <View style={styles.quotationMeta}>
            <Text style={styles.titleLabel}>Quotation</Text>
            <View style={styles.metaRow}><Text style={styles.metaLabel}>ID:</Text><Text style={styles.metaValue}>{data.quotationNumber || "TBD"}</Text></View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>{details.date ? format(new Date(details.date), 'MMM dd, yyyy') : '-'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Valid Until:</Text>
              <Text style={styles.metaValue}>{details.validUntil ? format(new Date(details.validUntil), 'MMM dd, yyyy') : '-'}</Text>
            </View>
          </View>
        </View>

        {/* ── TITLE ── */}
        <Text style={styles.quotationTitle}>{details.title}</Text>

        {/* ── CLIENT ── */}
        <View style={styles.clientSection}>
          <View style={styles.clientCol}>
            <Text style={styles.clientFor}>Quotation For:</Text>
            <Text style={styles.clientName}>{client.contactName}</Text>
            {client.companyName && <Text style={styles.clientCompany}>{client.companyName}</Text>}
          </View>
          <View style={styles.clientCol}>
            <Text style={styles.clientDetail}>{client.address}</Text>
            <Text style={styles.clientDetail}>{client.email}</Text>
            <Text style={styles.clientDetail}>{client.phone}</Text>
          </View>
        </View>

        {/* ── OVERVIEW ── */}
        {data.overview && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Project Overview</Text>
            <Text style={{ fontSize: 10, color: '#374151', lineHeight: 1.5 }}>{data.overview}</Text>
          </View>
        )}

        {/* ── PHASES (REFACTORED) ── */}
        {phases.length > 0 && (
          <React.Fragment>
            <Text style={styles.sectionHeading}>Project Phases & Milestones</Text>
            {phases.map((phase, idx) => (
              <View key={idx} wrap={false} style={{ marginBottom: 10, padding: 8, backgroundColor: '#F9FAFB', borderLeftWidth: 3, borderLeftColor: '#019689' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 4 }}>
                  Phase {idx + 1}: {phase.title}
                </Text>
                {phase.description && <Text style={{ fontSize: 10, color: '#4B5563', marginBottom: 6, lineHeight: 1.4 }}>{phase.description}</Text>}
                {phase.items.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                    <Text style={{ fontSize: 10, marginRight: 6, color: '#9CA3AF' }}>•</Text>
                    <Text style={{ fontSize: 10, color: '#374151', flex: 1, lineHeight: 1.3 }}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </React.Fragment>
        )}

        {/* ── TECH STACK (REFACTORED) ── */}
        {hasTech && (
          <View style={styles.techSection}>
            <Text style={{ ...styles.sectionHeading, borderBottomWidth: 0, marginBottom: 4 }}>Technology Stack</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {techStack.frontend && <View style={styles.techBadgeFrontend}><Text style={styles.techBadgeFrontendText}>{techStack.frontend}</Text></View>}
              {techStack.backend && <View style={styles.techBadgeBackend}><Text style={styles.techBadgeBackendText}>{techStack.backend}</Text></View>}
              {techStack.database && <View style={styles.techBadgeBackend}><Text style={styles.techBadgeBackendText}>{techStack.database}</Text></View>}
              {techStack.tools.map((tool, i) => <View key={i} style={styles.techBadgeDesign}><Text style={styles.techBadgeDesignText}>{tool}</Text></View>)}
            </View>
          </View>
        )}

        {/* ── WORKFLOW ── */}
        {workflow.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Workflow Summary</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {workflow.map((step, i) => (
                <View key={i} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', marginRight: 5 }}>{i + 1}.</Text>
                  <Text style={{ fontSize: 10, color: '#4B5563' }}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── ADDITIONAL SERVICES ── */}
        {additionalServices.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Additional Services</Text>
            {additionalServices.map((srv, idx) => (
              <View key={idx} style={{ marginBottom: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 4, backgroundColor: '#FFFFFF' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#019689' }}>{srv.title}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
                    ৳{srv.price.toLocaleString()} / {srv.billingCycle}
                  </Text>
                </View>
                {srv.description && <Text style={{ fontSize: 9, color: '#4B5563', lineHeight: 1.3 }}>{srv.description}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* ── PRICING MATRIX (REFACTORED) ── */}
        <View wrap={false} style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Package Base Cost</Text>
            <Text style={styles.totalsValue}>৳{pricing.basePrice.toLocaleString()}</Text>
          </View>
          {additionalServices.length > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Additional Services</Text>
              <Text style={styles.totalsValue}>+৳{additionalServices.reduce((a, b) => a + b.price, 0).toLocaleString()}</Text>
            </View>
          )}
          {pricing.taxRate > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax ({pricing.taxRate}%)</Text>
              <Text style={styles.totalsValue}>+৳{totals.taxAmount.toLocaleString()}</Text>
            </View>
          )}
          {pricing.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>-৳{pricing.discount.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Investment</Text>
            <Text style={styles.grandTotalValue}>৳{totals.grandTotal.toLocaleString()}</Text>
          </View>
        </View>

        {/* ── FOOTER & SIGNATURES ── */}
        <View style={{ marginTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }} wrap={false}>
          <View style={{ width: '45%' }}>
            <Image src={{ uri: "https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png" }} style={{ width: 120, height: 40 }} />
            <View style={{ borderTopWidth: 1, borderTopColor: '#9CA3AF', marginTop: 8, marginBottom: 4 }} />
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' }}>Md. Ashaduzzaman</Text>
            <Text style={{ fontSize: 9, color: '#6B7280' }}>Founder and CEO, {company.name}</Text>
          </View>
          <View style={{ width: '45%' }}>
            <View style={{ height: 40 }} />
            <View style={{ borderTopWidth: 1, borderTopColor: '#9CA3AF', marginTop: 8, marginBottom: 4 }} />
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' }}>{client.contactName}</Text>
            <Text style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Client Signature</Text>
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

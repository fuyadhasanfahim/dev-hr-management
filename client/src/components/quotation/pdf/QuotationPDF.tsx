"use client";

import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { QuotationData } from '@/types/quotation.type';
// Note: formatCurrency and other utils might need migration too
import { format } from 'date-fns';

const formatCurrency = (amount: number, currency: string) => {
  return `${currency}${amount.toLocaleString()}`;
};

interface QuotationPDFProps {
  data: QuotationData;
  packagePrice: number;
  additionalTotal: number;
  taxAmount: number;
  grandTotal: number;
}

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export const QuotationPDF = ({
  data,
  packagePrice,
  additionalTotal,
  taxAmount,
  grandTotal,
}: QuotationPDFProps) => {
  const hasTech =
    data.techStack.frontend.length > 0 ||
    data.techStack.backend.length > 0 ||
    data.techStack.database?.length > 0 ||
    data.techStack.tools.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ── HEADER ── */}
        <View style={styles.headerSection}>
          <View style={styles.companyInfo}>
            {data.company.logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image 
                src={{ uri: "https://res.cloudinary.com/dny7zfbg9/image/upload/v1755954483/mqontecf1xao7znsh6cx.png" }} 
                style={{
                  width: 120,
                  height: 40,
                  objectFit: 'contain',
                  marginBottom: 8
                }} 
              />
            ) : (
              <Text style={styles.companyName}>{data.company.name}</Text>
            )}
            <Text style={styles.companyAddress}>{data.company.address}</Text>
            <Text style={styles.companyAddress}>
              {data.company.email} | {data.company.phone}
            </Text>
            <Text style={{ ...styles.companyAddress, color: '#4B5563', marginTop: 3 }}>
              {data.company.website}
            </Text>
          </View>
          <View style={styles.quotationMeta}>
            <Text style={styles.titleLabel}>Quotation</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>ID:</Text>
              <Text style={styles.metaValue}>
                {data.quotationNumber || data.details.quotationNumber || "TBD"}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>
                {data.details.date ? format(new Date(data.details.date), 'MMM dd, yyyy') : '-'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Valid Until:</Text>
              <Text style={styles.metaValue}>
                {data.details.validUntil ? format(new Date(data.details.validUntil), 'MMM dd, yyyy') : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── TITLE ── */}
        <Text style={styles.quotationTitle}>{data.details.title}</Text>

        {/* ── CLIENT ── */}
        <View style={styles.clientSection}>
          <View style={styles.clientCol}>
            <Text style={styles.clientFor}>Quotation For:</Text>
            <Text style={styles.clientName}>{data.client.contactName}</Text>
            {data.client.companyName ? (
              <Text style={styles.clientCompany}>{data.client.companyName}</Text>
            ) : null}
          </View>
          <View style={styles.clientCol}>
            <Text style={styles.clientDetail}>{data.client.address}</Text>
            <Text style={styles.clientDetail}>{data.client.email}</Text>
            <Text style={styles.clientDetail}>{data.client.phone}</Text>
          </View>
        </View>

        {/* ── OVERVIEW ── */}
        {data.overview && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Project Overview</Text>
            <Text style={{ fontSize: 10, color: '#374151', lineHeight: 1.5 }}>
              {data.overview}
            </Text>
          </View>
        )}

        {/* ── SCOPE OF WORK ── */}
        {data.serviceType === 'web-development' && data.scopeOfWork.length > 0 && (
          <React.Fragment>
            <Text style={styles.sectionHeading}>Scope of Work</Text>
            {data.scopeOfWork.map((phase, idx) => (
              <View key={phase.id} wrap={false} style={{ marginBottom: 10, padding: 8, backgroundColor: '#F9FAFB', borderLeftWidth: 3, borderLeftColor: '#019689' }}>
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
            <View style={{ marginBottom: 2 }} />
          </React.Fragment>
        )}

        {/* ── TECH STACK ── */}
        {data.serviceType === 'web-development' && hasTech && (
          <View style={styles.techSection}>
            <Text style={{ ...styles.sectionHeading, borderBottomWidth: 0, marginBottom: 4 }}>Technology Stack</Text>

            {data.techStack.frontend.length > 0 && (
              <View style={styles.techCategoryRow}>
                <Text style={styles.techCategoryLabel}>Frontend</Text>
                <View style={styles.techBadgesWrap}>
                  {data.techStack.frontend.map((tech, i) => (
                    <View key={i} style={styles.techBadgeFrontend}>
                      <Text style={styles.techBadgeFrontendText}>{tech}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {data.techStack.backend.length > 0 && (
              <View style={styles.techCategoryRow}>
                <Text style={styles.techCategoryLabel}>Backend</Text>
                <View style={styles.techBadgesWrap}>
                  {data.techStack.backend.map((tech, i) => (
                    <View key={i} style={styles.techBadgeBackend}>
                      <Text style={styles.techBadgeBackendText}>{tech}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {data.techStack.database?.length > 0 && (
              <View style={styles.techCategoryRow}>
                <Text style={styles.techCategoryLabel}>Database</Text>
                <View style={styles.techBadgesWrap}>
                  {data.techStack.database.map((tech, i) => (
                    <View key={i} style={styles.techBadgeBackend}>
                      <Text style={styles.techBadgeBackendText}>{tech}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {data.techStack.tools.length > 0 && (
              <View style={styles.techCategoryRow}>
                <Text style={styles.techCategoryLabel}>Tools</Text>
                <View style={styles.techBadgesWrap}>
                  {data.techStack.tools.map((tool, i) => (
                    <View key={i} style={styles.techBadgeDesign}>
                      <Text style={styles.techBadgeDesignText}>{tool}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── DELIVERY TIMELINE ── */}
        {data.serviceType === 'web-development' && data.deliveryTimeline && (
          <View style={styles.deliveryBox}>
            <Text style={styles.sectionHeading}>Delivery Timeline</Text>
            <Text style={styles.deliveryText}>{data.deliveryTimeline}</Text>
          </View>
        )}


        {/* ── WORKFLOW SUMMARY ── */}
        {data.serviceType === 'web-development' && data.workflow.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Workflow Summary</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {data.workflow.map((step, i) => (
                <View key={i} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', marginRight: 5 }}>{i + 1}.</Text>
                  <Text style={{ fontSize: 10, color: '#4B5563' }}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── OPTIONAL SERVICES ── */}
        {data.serviceType === 'web-development' && data.optionalServices.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Additional Services</Text>
            {data.optionalServices.map((srv) => (
              <View key={srv.id} style={{ marginBottom: 8, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 4, backgroundColor: '#FFFFFF' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#019689' }}>{srv.title}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
                    {formatCurrency(srv.price, data.settings.currency)}{srv.type === 'recurring' ? ' / Yearly' : ''}
                  </Text>
                </View>
                {srv.description && <Text style={{ fontSize: 9, color: '#4B5563', marginBottom: 6, lineHeight: 1.3 }}>{srv.description}</Text>}
                {srv.items.length > 0 && (
                  <View style={{ marginTop: 2 }}>
                    {srv.items.map((item, i) => (
                      <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }}>
                        <Text style={{ fontSize: 9, marginRight: 6, color: '#9CA3AF' }}>•</Text>
                        <Text style={{ fontSize: 9, color: '#4B5563', flex: 1, lineHeight: 1.3 }}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
        {/* ── PAYMENT TERMS (Web Development only) ── */}
        {data.serviceType === 'web-development' && (
          <View wrap={false} style={{ marginBottom: 14, padding: 10, backgroundColor: '#F0FDFA', borderLeftWidth: 3, borderLeftColor: '#019689', borderRadius: 4 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Payment Terms
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 8, gap: 8 }}>
              <View style={{ flex: 1, padding: 8, backgroundColor: '#FFFFFF', borderRadius: 4, borderWidth: 1, borderColor: '#99F6E4', flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0D9488', marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>50%</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' }}>Advance Payment</Text>
                  <Text style={{ fontSize: 8, color: '#6B7280' }}>Before starting the project</Text>
                </View>
              </View>
              <View style={{ flex: 1, padding: 8, backgroundColor: '#FFFFFF', borderRadius: 4, borderWidth: 1, borderColor: '#99F6E4', flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#14B8A6', marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>30%</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' }}>After Development</Text>
                  <Text style={{ fontSize: 8, color: '#6B7280' }}>Before final delivery</Text>
                </View>
              </View>
              <View style={{ flex: 1, padding: 8, backgroundColor: '#FFFFFF', borderRadius: 4, borderWidth: 1, borderColor: '#99F6E4', flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#2DD4BF', marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' }}>20%</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' }}>Final Payment</Text>
                  <Text style={{ fontSize: 8, color: '#6B7280' }}>After project handover</Text>
                </View>
              </View>
            </View>
            <View style={{ backgroundColor: '#CCFBF1', borderRadius: 4, padding: 7, borderWidth: 1, borderColor: '#99F6E4' }}>
              <Text style={{ fontSize: 9, color: '#134E4A', fontFamily: 'Helvetica-Oblique' }}>
                <Text style={{ fontFamily: 'Helvetica-BoldOblique' }}>Note: </Text>
                Work will begin only after the initial advance payment is received.
              </Text>
            </View>
          </View>
        )}
        {/* ── PRICING MATRIX ── */}
        {data.serviceType === 'web-development' && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Website Pricing</Text>
            <View style={{ flexDirection: 'column' }}>
              <View style={{ marginBottom: 10 }}>
                {data.pricing.included.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 6 }}>Included in this package:</Text>
                    <View style={styles.featuresGrid}>
                      {chunk(data.pricing.included, 2).map((row, rowIdx) => (
                        <View key={rowIdx} style={{ flexDirection: 'row', marginBottom: 4 }}>
                          {row.map((inc, i) => (
                            <View key={i} wrap={false} style={{ width: '50%', flexDirection: 'row', paddingRight: 10 }}>
                              <Text style={{ fontSize: 9, color: '#019689', marginRight: 6, fontFamily: 'Helvetica-Bold' }}>✓</Text>
                              <Text style={{ fontSize: 9, color: '#374151', flex: 1, lineHeight: 1.3 }}>{inc}</Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}



        {/* ── PHOTOGRAPHY PACKAGES ── */}
        {data.serviceType === 'product-photography' && (
          <View style={{ marginBottom: 5 }}>
            <Text style={styles.sectionHeading}>Photography Packages & Scope</Text>

            <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', paddingVertical: 6, backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <Text style={{ flex: 3, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', paddingLeft: 6 }}>Item</Text>
                <Text style={{ flex: 3, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' }}>Output</Text>
                <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', textAlign: 'center' }}>Qty</Text>
                <Text style={{ flex: 1.5, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', textAlign: 'right' }}>Rate</Text>
                <Text style={{ flex: 1.5, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', textAlign: 'right', paddingRight: 6 }}>Subtotal</Text>
              </View>
              {data.photographyItems.map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: idx !== data.photographyItems.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }} wrap={false}>
                  <Text style={{ flex: 3, fontSize: 9, color: '#111827', paddingLeft: 6, paddingRight: 4 }}>{item.title}</Text>
                  <Text style={{ flex: 3, fontSize: 9, color: '#4B5563', paddingRight: 4 }}>{item.outputString}</Text>
                  <Text style={{ flex: 1, fontSize: 9, color: '#374151', textAlign: 'center' }}>{item.quantity}</Text>
                  <Text style={{ flex: 1.5, fontSize: 9, color: '#374151', textAlign: 'right' }}>{formatCurrency(item.price, data.settings.currency)}</Text>
                  <Text style={{ flex: 1.5, fontSize: 9, color: '#111827', fontFamily: 'Helvetica-Bold', textAlign: 'right', paddingRight: 6 }}>{formatCurrency(item.quantity * item.price, data.settings.currency)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}


        {data.serviceType === 'web-development' && data.optionalServices.length > 0 && (
          <View style={{ marginTop: 5 }} />
        )}

        {/* Totals Box Full Width */}
        <View wrap={false} style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{data.serviceType === 'product-photography' ? 'Photography Base Cost' : 'Base Cost'}</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(packagePrice, data.settings.currency)}
            </Text>
          </View>
          {additionalTotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Additional Services Total</Text>
              <Text style={styles.totalsValue}>
                +{formatCurrency(additionalTotal, data.settings.currency)}
              </Text>
            </View>
          )}
          {data.settings.taxRate > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Tax ({data.settings.taxRate}%)
              </Text>
              <Text style={styles.totalsValue}>
                +{formatCurrency(taxAmount, data.settings.currency)}
              </Text>
            </View>
          )}
          {data.settings.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>
                -{formatCurrency(data.settings.discount, data.settings.currency)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Investment</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(grandTotal, data.settings.currency)}
            </Text>
          </View>
        </View>

        {/* ── FINAL NOTE ── */}
        {data.finalNote && (
          <View style={styles.termsSection}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 6, textTransform: 'uppercase' }}>Final Note</Text>
            <Text style={styles.termsText}>{data.finalNote}</Text>
          </View>
        )}

        {/* ── VALID UNTIL ── */}
        <Text style={styles.footerNote}>
          This quotation is valid until{' '}
          {data.details.validUntil ? format(new Date(data.details.validUntil), 'MMMM dd, yyyy') : '-'}
        </Text>

        {/* ── SIGNATURE SECTION ── */}
        <View style={{
          marginTop: 40,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end'
        }} wrap={false}>
          {/* Company Signature */}
          <View style={{ width: '45%' }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image 
              src={{ uri: "https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png" }} 
              style={{ width: 120, height: 40 }} 
            />
            <View style={{
              borderTopWidth: 1,
              borderTopColor: '#9CA3AF',
              marginTop: 8,
              marginBottom: 4
            }} />
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
              Md. Ashaduzzaman
            </Text>
            <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>
              Founder and CEO
            </Text>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#019689', marginTop: 1 }}>
              {data.company.name}
            </Text>
          </View>

          {/* Client Signature Placeholder */}
          <View style={{ width: '45%' }}>
            <View style={{ height: 40 }} />
            <View style={{
              borderTopWidth: 1,
              borderTopColor: '#9CA3AF',
              marginTop: 8,
              marginBottom: 4
            }} />
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
              {data.client.contactName}
            </Text>
            <Text style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
              Client Signature
            </Text>
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

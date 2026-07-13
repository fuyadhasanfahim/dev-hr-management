'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useQuotationStore } from '@/store/useQuotationStore';
import { toast } from 'sonner';
import {
  Check,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Send,
  Layers,
  DollarSign,
  User,
  Mail,
  Copy,
  Eye,
  Briefcase,
  ArrowLeft,
  Calendar as CalendarIcon,
  Globe,
  Megaphone,
  Image as ImageIcon,
  Video,
  X as XIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGetClientsQuery } from '@/redux/features/client/clientApi';
import {
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
  useSendQuotationMutation,
} from '@/redux/features/quotation/quotationApi';
import { format } from 'date-fns';
import { formatMoney } from '@/lib/money';
import { computeQuotationTotals, computeServiceTotal } from '@/lib/quotation-totals';
import { QuotationCategory, BillingCycle } from '@/types/quotation.type';
import { Client } from '@/types/client.type';
import { QuotationEmailDialog } from '../QuotationEmailDialog';
import { MultiServiceQuotationPdfModal } from '@/components/quotation/pdf/MultiServiceQuotationPdfModal';
import { quotationPdfFileStem } from '@/components/quotation/pdf/QuotationPuppeteerPdfBtn';
import { PremiumCard } from '@/components/ui/shared/PremiumCard';
import { PremiumButton } from '@/components/ui/shared/PremiumButton';
import { PremiumInput } from '@/components/ui/shared/PremiumInput';
import { PremiumTextarea } from '@/components/ui/shared/PremiumTextarea';
import { PremiumBadge } from '@/components/ui/shared/PremiumBadge';
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CATEGORY_CONFIG,
  BILLING_CYCLE_LABELS,
  SUGGESTED_LINE_ITEMS,
  getBillingOptions,
  isUnitBased,
  getUnitLabel,
} from '@/constants/quotation-templates';

function QuotationDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dateVal = value && !isNaN(new Date(value).getTime()) ? new Date(value) : undefined;

  return (
    <div className="w-full space-y-2 font-sans">
      <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 select-none">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between hover:border-[#4E12D4]/60 focus:outline-none focus:ring-2 focus:ring-[#4E12D4]/30 focus:border-[#4E12D4] transition-all duration-200 shadow-2xs group"
          >
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-4 h-4 text-[#4E12D4] group-hover:scale-110 transition-transform" />
              <span>
                {dateVal ? format(dateVal, 'dd-MMM-yyyy') : <span className="text-slate-400 font-normal">Select Date...</span>}
              </span>
            </div>
            <CalendarIcon className="w-4 h-4 text-slate-400 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl border border-purple-500/20 shadow-xl bg-card z-[100]" align="start">
          <Calendar
            mode="single"
            selected={dateVal}
            onSelect={(d) => {
              if (d) {
                onChange(d.toISOString().split('T')[0]);
                setOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Tag-style multi-value input used for the web-development tech stack editor. */
function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (v) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground block">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-background border border-border/60 min-h-[42px]">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#4E12D4]/10 text-[#4E12D4] dark:text-[#C850FA] text-xs font-semibold"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="hover:text-red-500 cursor-pointer"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder || 'Type & press Enter'}
          className="flex-1 min-w-[100px] bg-transparent border-0 text-xs font-medium focus:outline-none placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}

const parseRawProposalToBullets = (text: string): string => {
  const lines = text.split('\n');
  const result: string[] = [];
  let lastWasHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Detect section headers
    const headingMatch = line.match(/^(\d+[\.\)]\s*)?([A-Z\d][\w\s&/,\-()]{3,60})$/);
    const looksLikeHeader = !/^[-*•◦▪+]\s*/.test(line) && 
                            line.length < 75 && 
                            !line.endsWith('.') &&
                            !line.endsWith(':') &&
                            !/^(we |this |since |the |our |included|please|during|sslcommerz|surjopay|referral)/i.test(line);

    if (headingMatch || looksLikeHeader) {
      const cleanHeader = line.replace(/^\d+[\.\)]\s*/, '').trim();
      result.push(`• ${cleanHeader}`);
      lastWasHeader = true;
    } 
    // Detect bullet list items
    else if (/^[-*•◦▪+]\s*/.test(line)) {
      const cleanItem = line.replace(/^[-*•◦▪+]\s*/, '').trim();
      const leadingSpaces = rawLine.match(/^\s*/)?.[0].length || 0;
      const indent = leadingSpaces >= 3 ? '    • ' : '  • ';
      result.push(`${indent}${cleanItem}`);
      lastWasHeader = false;
    } 
    // Paragraph or descriptive sentences (filler/introductions)
    else {
      const isFiller = line.endsWith(':') || 
                       /will (include|provide|be|help|finalize|integrate|connect|have)/i.test(line) ||
                       /^(we |this |since |the |important |during |payment |referral |alert |manual |report |B2B |POS )/i.test(line);
      
      if (!isFiller) {
        if (lastWasHeader) {
          result.push(`  • ${line}`);
        } else {
          result.push(`• ${line}`);
        }
      }
    }
  }
  return result.join('\n');
};

const SERVICE_ORDER: QuotationCategory[] = ['web-development', 'marketing', 'photo-editing', 'video-editing'];

const SERVICE_UI: Record<QuotationCategory, { icon: typeof Globe; color: string; borderColor: string; iconBg: string }> = {
  'web-development': {
    icon: Globe,
    color: 'text-[#4E12D4] dark:text-[#C850FA]',
    borderColor: 'border-[#4E12D4]',
    iconBg: 'bg-[#4E12D4]/10 text-[#4E12D4]',
  },
  marketing: {
    icon: Megaphone,
    color: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-500',
    iconBg: 'bg-emerald-500/10 text-emerald-600',
  },
  'photo-editing': {
    icon: ImageIcon,
    color: 'text-pink-600 dark:text-pink-400',
    borderColor: 'border-pink-500',
    iconBg: 'bg-pink-500/10 text-pink-600',
  },
  'video-editing': {
    icon: Video,
    color: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-500',
    iconBg: 'bg-amber-500/10 text-amber-600',
  },
};

/** Base/package one-time price only makes sense for these two categories — photo/video are purely per-unit. */
const BASE_PRICE_CATEGORIES: QuotationCategory[] = ['web-development', 'marketing'];

export interface QuotationBuilderProps {
  hideHeader?: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
  backUrl?: string;
}

export default function QuotationBuilder({
  hideHeader,
  pageTitle,
  pageSubtitle,
  backUrl,
}: QuotationBuilderProps = {}) {
  const router = useRouter();
  const {
    data,
    updateDetails,
    setData,
    toggleService,
    updateService,
    updateTechStack,
    addScopeItem,
    updateScopeItem,
    removeScopeItem,
    addLineItem,
    updateLineItem,
    removeLineItem,
    updateNotIncluded,
    updateClientRequirements,
    setPaymentMilestones,
  } = useQuotationStore();

  const { data: clientsData, isLoading: clientsLoading } = useGetClientsQuery({});
  const [createQuotation, { isLoading: isCreating }] = useCreateQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateQuotationMutation();
  const [sendQuotation, { isLoading: isSending }] = useSendQuotationMutation();

  const notIncludedItems = data.notIncluded || [];
  const clientRequirements = data.clientRequirements || [];

  const [collapsedServices, setCollapsedServices] = useState<Record<string, boolean>>({});
  const [aiInputText, setAiInputText] = useState('');
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const [milestoneType, setMilestoneType] = useState<'30/40/30' | '50/50' | '20/30/50' | 'custom'>('30/40/30');
  const [customMilestoneText, setCustomMilestoneText] = useState('');

  const handleMilestoneChange = (type: '30/40/30' | '50/50' | '20/30/50' | 'custom', customText = customMilestoneText) => {
    setMilestoneType(type);
    let ms = [];
    if (type === '30/40/30') {
      ms = [
        { label: '30% Upfront Payment', percentage: 30 },
        { label: '40% Midway Progress Milestone', percentage: 40 },
        { label: '30% Final Delivery & Handover', percentage: 30 },
      ];
    } else if (type === '50/50') {
      ms = [
        { label: '50% Upfront Payment', percentage: 50 },
        { label: '50% Final Delivery & Handover', percentage: 50 },
      ];
    } else if (type === '20/30/50') {
      ms = [
        { label: '20% Upfront Payment', percentage: 20 },
        { label: '30% Midway Progress Milestone', percentage: 30 },
        { label: '50% Final Delivery & Handover', percentage: 50 },
      ];
    } else {
      ms = [{ label: customText || 'Custom Payment Terms', percentage: 100 }];
    }
    setPaymentMilestones(ms);
  };

  const handleCustomTextChange = (val: string) => {
    setCustomMilestoneText(val);
    setPaymentMilestones([{ label: val || 'Custom Payment Terms', percentage: 100 }]);
  };

  // Derive the milestone-picker selection from loaded data (e.g. when opening an existing quotation).
  useEffect(() => {
    const ms = data.paymentMilestones;
    if (ms && ms.length > 0) {
      if (ms.length === 3 && ms[0].percentage === 30 && ms[1].percentage === 40 && ms[2].percentage === 30) {
        setMilestoneType('30/40/30');
      } else if (ms.length === 2 && ms[0].percentage === 50 && ms[1].percentage === 50) {
        setMilestoneType('50/50');
      } else if (ms.length === 3 && ms[0].percentage === 20 && ms[1].percentage === 30 && ms[2].percentage === 50) {
        setMilestoneType('20/30/50');
      } else {
        setMilestoneType('custom');
        setCustomMilestoneText(ms.map((m) => m.label).join(' / '));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data._id]);

  const { perService, totals: liveTotals, recurringCharges } = useMemo(
    () => computeQuotationTotals(data.services),
    [data.services],
  );

  const activeServices = useMemo(() => data.services.map((s) => s.category), [data.services]);



  const addNotIncludedItem = () => updateNotIncluded([...notIncludedItems, 'New exclusion note...']);
  const updateNotIncludedItem = (index: number, val: string) => {
    const next = [...notIncludedItems];
    next[index] = val;
    updateNotIncluded(next);
  };
  const removeNotIncludedItem = (index: number) => updateNotIncluded(notIncludedItems.filter((_, i) => i !== index));

  const addRequirementItem = () => updateClientRequirements([...clientRequirements, 'New prerequisite asset required from client...']);
  const updateRequirementItem = (index: number, val: string) => {
    const next = [...clientRequirements];
    next[index] = val;
    updateClientRequirements(next);
  };
  const removeRequirementItem = (index: number) => updateClientRequirements(clientRequirements.filter((_, i) => i !== index));

  const saveQuotation = async (status: 'draft' | 'sent', shouldRedirect = false): Promise<string | null> => {
    if (!data.clientId) {
      toast.error('Please select a client first!');
      return null;
    }
    if (data.services.length === 0) {
      toast.error('Please select at least one active service!');
      return null;
    }
    try {
      if (data._id) {
        const payload = { ...data };
        const updated = await updateQuotation({ id: data._id, ...payload }).unwrap();
        setData(updated);
        toast.success('🎉 Quotation updated successfully!');
        if (shouldRedirect) router.push(`/quotations/${updated._id}`);
        return updated._id ?? null;
      } else {
        const payload = { ...data, status };
        const created = await createQuotation(payload).unwrap();
        setData(created);
        toast.success('🎉 Quotation created successfully!');
        if (shouldRedirect) router.push(`/quotations/${created._id}`);
        return created._id ?? null;
      }
    } catch (err: unknown) {
      const maybe = err as { data?: { message?: string } } | null;
      toast.error(maybe?.data?.message || 'Failed to save quotation!');
      return null;
    }
  };

  const copyPrompt = () => {
    if (activeServices.length === 0) {
      toast.error('Please select at least one active service above first!');
      return;
    }

    const servicesText = activeServices
      .map((catId) => {
        const label = CATEGORY_CONFIG[catId].label;
        return `- ${label}`;
      })
      .join('\n');

    const prompt = `You are a professional proposal builder. Please generate a detailed service scope and deliverables layout for a client proposal based on the following selected services:
${servicesText}

Format the response EXACTLY as shown in the template below. Use standard bullets (•) for main features, and indent sub-features with two spaces (  •). Do not use markdown bolding (**) inside the deliverables list.

--- TEMPLATE START ---
${activeServices.map((catId) => {
  const label = CATEGORY_CONFIG[catId].label;
  return `${label} Scope
Description: [Write a concise, 1-2 sentence description of what is included in this service]
Deliverables:
• [Feature Title, e.g. E-Commerce Core Setup]
  • [Sub-feature item 1, e.g. Product Catalog Setup]
  • [Sub-feature item 2, e.g. Shopping Cart & Checkout Flow]
• [Next Feature Title, e.g. CRM & Administration]
  • [Sub-feature item, e.g. Role-based permissions]`;
}).join('\n\n')}

Not Included:
• [Item not included, e.g. Domain & premium web hosting costs]
• [Item not included, e.g. Paid marketing campaign budget]

Client Needs to Provide:
• [Client requirement, e.g. Brand guidelines, logo, and typography assets]
• [Client requirement, e.g. Admin access credentials to current site hosting]
--- TEMPLATE END ---`;

    navigator.clipboard.writeText(prompt);
    toast.success('📋 Dynamic AI Prompt copied to clipboard! Paste it into ChatGPT/Claude.');
  };

  const handleAiImport = () => {
    if (!aiInputText.trim()) {
      toast.error('Please paste the AI-generated proposal first!');
      return;
    }

    const lines = aiInputText.split('\n');
    let currentServiceCategory: QuotationCategory | null = null;
    
    const serviceScopes: Record<QuotationCategory, string[]> = {
      'web-development': [],
      'marketing': [],
      'photo-editing': [],
      'video-editing': []
    };
    
    const serviceDescriptions: Record<QuotationCategory, string> = {
      'web-development': '',
      'marketing': '',
      'photo-editing': '',
      'video-editing': ''
    };
    
    let parsingExclusions = false;
    let parsingRequirements = false;
    
    const tempNotIncluded: string[] = [];
    const tempClientReqs: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      if (!line) continue;

      const lower = line.toLowerCase();
      
      const isBullet = /^[-*•◦▪+]\s*/.test(line) || rawLine.startsWith(' ') || rawLine.startsWith('\t');
      const isSpecialLine = lower.startsWith('description:') || lower.startsWith('service name:') || lower.startsWith('deliverables:');
      
      if (!isBullet && !isSpecialLine && (line.length < 60 || lower.includes('scope') || lower.includes('included') || lower.includes('provide') || lower.includes('requirements'))) {
        // Section triggers
        if (lower.includes('web') && (lower.includes('dev') || lower.includes('design') || lower.includes('site') || lower.includes('crm') || lower.includes('scope'))) {
          currentServiceCategory = 'web-development';
          parsingExclusions = false;
          parsingRequirements = false;
          continue;
        } else if (lower.includes('marketing') || lower.includes('seo') || lower.includes('campaign') || lower.includes('ads')) {
          currentServiceCategory = 'marketing';
          parsingExclusions = false;
          parsingRequirements = false;
          continue;
        } else if (lower.includes('video') || lower.includes('motion') || lower.includes('reel') || lower.includes('production')) {
          currentServiceCategory = 'video-editing';
          parsingExclusions = false;
          parsingRequirements = false;
          continue;
        } else if (lower.includes('photo') || lower.includes('retouch') || lower.includes('graphic')) {
          currentServiceCategory = 'photo-editing';
          parsingExclusions = false;
          parsingRequirements = false;
          continue;
        } else if (lower.includes('not included') || lower.includes('exclusions') || lower.includes('not included in this price')) {
          currentServiceCategory = null;
          parsingExclusions = true;
          parsingRequirements = false;
          continue;
        } else if (lower.includes('client needs to provide') || lower.includes('client requirements') || lower.includes('client need') || lower.includes('prerequisites') || lower.includes('client provide') || lower.includes('provide')) {
          currentServiceCategory = null;
          parsingExclusions = false;
          parsingRequirements = true;
          continue;
        }
      }

      if (currentServiceCategory) {
        if (line.toLowerCase().startsWith('description:')) {
          serviceDescriptions[currentServiceCategory] = line.replace(/^description:\s*/i, '').trim();
        } else if (line.toLowerCase().startsWith('service name:')) {
          continue;
        } else if (line.toLowerCase().startsWith('deliverables:')) {
          continue;
        } else {
          const leadingSpaces = rawLine.match(/^\s*/)?.[0].length || 0;
          const isSub = leadingSpaces >= 2 || rawLine.startsWith('\t');
          const cleanText = line.replace(/^[-*•◦▪+]\s*/, '').trim();
          
          if (cleanText) {
            const prefix = isSub ? '  • ' : '• ';
            serviceScopes[currentServiceCategory].push(`${prefix}${cleanText}`);
          }
        }
      } else if (parsingExclusions) {
        const cleanText = line.replace(/^[-*•◦▪+]\s*/, '').trim();
        if (cleanText) {
          tempNotIncluded.push(cleanText);
        }
      } else if (parsingRequirements) {
        const cleanText = line.replace(/^[-*•◦▪+]\s*/, '').trim();
        if (cleanText) {
          tempClientReqs.push(cleanText);
        }
      }
    }

    let updatedCount = 0;
    (Object.keys(serviceScopes) as QuotationCategory[]).forEach((cat) => {
      const items = serviceScopes[cat];
      const desc = serviceDescriptions[cat];
      if (items.length > 0 || desc) {
        if (!data.services.some((s) => s.category === cat)) {
          toggleService(cat);
        }
        
        const updates: any = {};
        if (items.length > 0) updates.scopeItems = items;
        if (desc) updates.scopeDescription = desc;
        
        updateService(cat, updates);
        updatedCount++;
      }
    });

    if (tempNotIncluded.length > 0) {
      updateNotIncluded(tempNotIncluded);
    }
    if (tempClientReqs.length > 0) {
      updateClientRequirements(tempClientReqs);
    }

    if (updatedCount > 0 || tempNotIncluded.length > 0 || tempClientReqs.length > 0) {
      toast.success('✨ Successfully imported AI proposal into quotation settings!');
      setAiInputText('');
    } else {
      toast.error('Could not detect structure! Ensure block headings like "Web Development Scope" are present.');
    }
  };

  const setItemType = (catId: QuotationCategory, index: number, type: 'heading' | 'main' | 'sub') => {
    const s = data.services.find((x) => x.category === catId);
    if (!s) return;
    const nextItems = [...s.scopeItems];
    let text = nextItems[index].trim();
    text = text.replace(/^###\s*/, '').replace(/^[-*•◦▪+]\s*/, '').trim();
    
    if (type === 'heading') {
      nextItems[index] = `### ${text}`;
    } else if (type === 'main') {
      nextItems[index] = `• ${text}`;
    } else if (type === 'sub') {
      nextItems[index] = `  • ${text}`;
    }
    updateService(catId, { scopeItems: nextItems });
  };

  const deleteItem = (catId: QuotationCategory, index: number) => {
    const s = data.services.find((x) => x.category === catId);
    if (!s) return;
    const nextItems = s.scopeItems.filter((_, i) => i !== index);
    updateService(catId, { scopeItems: nextItems });
  };

  const editItemText = (catId: QuotationCategory, index: number, newText: string) => {
    const s = data.services.find((x) => x.category === catId);
    if (!s) return;
    const nextItems = [...s.scopeItems];
    const original = nextItems[index];
    const match = original.match(/^(\s*###\s*|\s*[-*•◦▪+]\s*|\s*)/);
    const prefix = match ? match[0] : '';
    nextItems[index] = `${prefix}${newText}`;
    updateService(catId, { scopeItems: nextItems });
  };

  const openRecipientPicker = () => {
    if (!data.clientId) return toast.error('Please select a client first!');
    setRecipientModalOpen(true);
  };

  const confirmDispatch = async (selectedEmails: string[]) => {
    if (!data.clientId) {
      toast.error('Please select a client first!');
      return [];
    }
    if (selectedEmails.length === 0) {
      toast.warning('Please select at least one recipient!');
      return [];
    }
    if (isSending || isCreating || isUpdating) return [];

    const id = data._id || (await saveQuotation('draft'));
    if (!id) return [];

    try {
      const result = await sendQuotation({
        id: String(id),
        emails: selectedEmails,
        includePaymentLink: false,
      }).unwrap();

      if (result.data?.clientLink) {
        try {
          await navigator.clipboard.writeText(result.data.clientLink);
          toast.success('Client link copied to clipboard!');
        } catch {
          // non-fatal
        }
      }

      const recipients = result.data?.recipients ?? [];
      const failed = recipients.filter((r: { status: string }) => r.status === 'failed');
      const sent = recipients.filter((r: { status: string }) => r.status === 'sent');

      if (sent.length > 0 && failed.length === 0) {
        toast.success(`🎉 Quotation sent to ${sent.length} recipient(s)!`);
        setRecipientModalOpen(false);
      } else if (sent.length > 0 && failed.length > 0) {
        toast.warning(`Sent to ${sent.length}, failed for ${failed.length} recipient(s).`);
      } else {
        toast.error('Failed to send quotation to any recipients.');
      }
      return recipients;
    } catch (err: unknown) {
      const maybe = err as { data?: { message?: string } } | null;
      toast.error(maybe?.data?.message || 'Failed to send quotation.');
      return [];
    }
  };

  const currency = data.currency || '৳';
  const fileNameBase = quotationPdfFileStem(data.quotationNumber, data.details?.title);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header Bar */}
      {(!hideHeader || pageTitle) && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/50 shadow-sm">
          <div className="flex items-center gap-3">
            {backUrl && (
              <button
                type="button"
                onClick={() => router.push(backUrl)}
                className="p-2 rounded-full border border-border/60 hover:bg-muted/50 transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#1E0078] via-[#4E12D4] to-[#C850FA] bg-clip-text text-transparent">
                {pageTitle || 'Quotation Studio'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {pageSubtitle ||
                  'Build stunning, version-controlled quotations with ease.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/15 via-indigo-500/15 to-pink-500/15 hover:from-purple-500/25 hover:via-indigo-500/25 hover:to-pink-500/25 border border-purple-500/40 text-[#4E12D4] dark:text-purple-200 hover:text-[#3d0da8] dark:hover:text-white font-bold text-xs tracking-wide shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer"
              disabled={isCreating || isUpdating}
            >
              <Eye className="w-4 h-4" /> Live PDF Preview
            </button>

            <PremiumButton
              variant="purple"
              size="sm"
              onClick={() => saveQuotation('draft', true)}
              disabled={isCreating || isUpdating}
              leftIcon={<Save className="w-4 h-4 text-white" />}
            >
              {isCreating || isUpdating ? 'Saving...' : data._id ? 'Update Quotation' : 'Save Draft'}
            </PremiumButton>

            <PremiumButton
              variant="magenta"
              size="sm"
              onClick={openRecipientPicker}
              disabled={isSending || isCreating || isUpdating}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send to Client
            </PremiumButton>
          </div>
        </div>
      )}

      {/* 1. Client & Proposal Meta */}
      <PremiumCard accent="purple">
        <div className="flex items-center gap-3.5 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white flex items-center justify-center shadow-md shadow-[#4E12D4]/20">
            <Briefcase className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              1. Client &amp; Proposal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              Select the client and set the proposal title and dates.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Client</label>
            <ShadcnSelect
              value={data.clientId || ''}
              onValueChange={(val) => {
                const c = clientsData?.clients?.find((x: Client) => x._id === val);
                if (c) {
                  setData({
                    ...data,
                    clientId: val,
                    client: {
                      contactName: c.name || '',
                      companyName: c.name || '',
                      email: c.emails?.[0] || '',
                      phone: c.phone || '',
                      address: c.address || c.officeAddress || '',
                    },
                  });
                  toast.success(`Client selected: ${c.name}`);
                }
              }}
            >
              <SelectTrigger className="w-full h-11 bg-background border-[#4E12D4]/30 rounded-xl font-medium">
                <SelectValue placeholder={clientsLoading ? 'Loading clients...' : 'Select a Client from CRM'} />
              </SelectTrigger>
              <SelectContent>
                {clientsData?.clients?.map((c: Client) => (
                  <SelectItem key={c._id || c.name} value={c._id || ''}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </ShadcnSelect>
            {data.client?.contactName && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <User className="w-3 h-3" /> {data.client.contactName}
                {data.client.email && (
                  <>
                    <Mail className="w-3 h-3 ml-1.5" /> {data.client.email}
                  </>
                )}
              </p>
            )}
          </div>

          <PremiumInput
            label="Proposal Title"
            placeholder="e.g. E-Commerce Redesign & Development Package"
            value={data.details?.title || ''}
            onChange={(e) => updateDetails({ title: e.target.value })}
            leftIcon={<Layers className="w-4 h-4" />}
          />

          <QuotationDatePicker
            label="Issue Date"
            value={data.details?.date}
            onChange={(val) => updateDetails({ date: val })}
          />
          <QuotationDatePicker
            label="Valid Until Date"
            value={data.details?.validUntil}
            onChange={(val) => updateDetails({ validUntil: val })}
          />
        </div>
      </PremiumCard>

      {/* 2. Active Quotation Services */}
      <PremiumCard accent="purple">
        <div className="flex items-center gap-3.5 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white flex items-center justify-center shadow-md shadow-[#4E12D4]/20">
            <Layers className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              2. Active Quotation Services
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              Select one or more services — each gets its own scope and pricing below.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICE_ORDER.map((catId) => {
            const cfg = CATEGORY_CONFIG[catId];
            const ui = SERVICE_UI[catId];
            const isActive = activeServices.includes(catId);
            const IconComponent = ui.icon;
            return (
              <motion.div
                key={catId}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleService(catId)}
                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between shadow-sm hover:shadow-md ${
                  isActive
                    ? `${ui.borderColor} bg-gradient-to-br from-white via-purple-50/40 to-white dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 ring-2 ring-[#4E12D4]/30 shadow-md shadow-[#4E12D4]/10`
                    : 'border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 opacity-70 hover:opacity-100 hover:border-[#4E12D4]/40'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl ${ui.iconBg} flex items-center justify-center shrink-0`}>
                    <IconComponent className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-black tracking-tight truncate ${isActive ? ui.color : 'text-slate-800 dark:text-slate-100'}`}>
                      {cfg.label}
                    </div>
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-xl flex items-center justify-center transition-all shrink-0 ml-2 ${
                    isActive ? 'bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white shadow-sm shadow-[#4E12D4]/30 scale-110' : 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </PremiumCard>

      {/* 3. Per-service scope, tech stack & pricing */}
      {data.services.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#4E12D4]" />
            3. Service Scope &amp; Pricing
          </h2>

          {data.services.map((service, idx) => {
            const catId = service.category;
            const cfg = CATEGORY_CONFIG[catId];
            const ui = SERVICE_UI[catId];
            const IconComponent = ui.icon;
            const billingOptions = getBillingOptions(catId);
            const unitBased = isUnitBased(catId);
            const unitLabel = getUnitLabel(catId);
            const showBasePrice = BASE_PRICE_CATEGORIES.includes(catId);
            const serviceTotal = computeServiceTotal(service);
            const suggestions = SUGGESTED_LINE_ITEMS[catId] || [];

            return (
              <div key={catId} className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border-b border-purple-500/15 dark:border-purple-500/20 select-none">
                  <div 
                    onClick={() => setCollapsedServices(prev => ({ ...prev, [catId]: !prev[catId] }))}
                    className="flex items-center gap-3.5 min-w-0 cursor-pointer group/header flex-1"
                  >
                    <div className={`w-12 h-12 rounded-2xl ${ui.iconBg} flex items-center justify-center shrink-0`}>
                      <IconComponent className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-lg font-black tracking-tight truncate ${ui.color}`}>{idx + 1}. {cfg.label}</h3>
                        {collapsedServices[catId] ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover/header:text-foreground transition-colors" />
                        ) : (
                          <ChevronUp className="w-4 h-4 text-muted-foreground group-hover/header:text-foreground transition-colors" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Scope, {catId === 'web-development' ? 'tech stack, ' : ''}and pricing for this service.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleService(catId)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 font-bold text-xs transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Service
                  </button>
                </div>

                {!collapsedServices[catId] && (
                  <div className="p-6 space-y-6">
                    <PremiumTextarea
                      label="Scope Description"
                      placeholder={`Short description of what's included in ${cfg.label}...`}
                      value={service.scopeDescription || ''}
                      onChange={(e) => updateService(catId, { scopeDescription: e.target.value })}
                      rows={2}
                    />

                    {/* Deliverables */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Deliverables</label>
                        {!(catId === 'web-development' || catId === 'marketing') && (
                          <button
                            type="button"
                            onClick={() => addScopeItem(catId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4E12D4] text-white hover:bg-[#3d0da8] font-bold text-[11px] transition-all cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add Deliverable
                          </button>
                        )}
                      </div>
                      {catId === 'web-development' || catId === 'marketing' ? (
                        <div className="space-y-2">
                          <textarea
                            value={service.scopeItems.join('\n')}
                            onChange={(e) => updateService(catId, { scopeItems: e.target.value.split('\n') })}
                            onPaste={(e) => {
                              const pastedText = e.clipboardData.getData('text');
                              const hasNumberedHeaders = /\b\d+[\.\)]\s+[A-Z]/g.test(pastedText);
                              const hasDashes = /^\s*[-*•◦▪+]\s+\w+/m.test(pastedText);
                              
                              if (hasNumberedHeaders || hasDashes) {
                                e.preventDefault();
                                const formatted = parseRawProposalToBullets(pastedText);
                                
                                const start = e.currentTarget.selectionStart;
                                const end = e.currentTarget.selectionEnd;
                                const currentValue = e.currentTarget.value;
                                const newValue = currentValue.substring(0, start) + formatted + currentValue.substring(end);
                                
                                updateService(catId, { scopeItems: newValue.split('\n') });
                                toast.success('✨ Automatically cleaned and formatted proposal scope!');
                              }
                            }}
                            rows={12}
                            placeholder={`• E-Commerce Website Scope\n  • Modern, clean, and responsive design\n  • Mobile & desktop optimized layout\n\n• CRM / Admin Panel Scope\n  • Dashboard overview\n  • Product management`}
                            className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-[#4E12D4] focus:ring-2 focus:ring-[#4E12D4]/10 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all resize-y leading-relaxed"
                          />
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                              💡 Tip: Type <code className="px-1 py-0.5 rounded bg-muted">• Feature</code> for root items, and indent with spaces like <code className="px-1 py-0.5 rounded bg-muted">&nbsp;&nbsp;• Sub-feature</code> for sub-features. Use newlines to separate.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const rawVal = service.scopeItems.join('\n');
                                const cleaned = parseRawProposalToBullets(rawVal);
                                updateService(catId, { scopeItems: cleaned.split('\n') });
                                toast.success('✨ Cleaned and formatted deliverables!');
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 font-bold text-[11px] transition-all cursor-pointer shrink-0 self-end sm:self-auto"
                            >
                              <Sparkles className="w-3 h-3" /> Clean & Format Text
                            </button>
                          </div>

                          {/* Live Preview of parsed deliverables */}
                          {service.scopeItems.length > 0 && service.scopeItems.some(it => it.trim()) && (
                            <div className="mt-4 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/10 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block select-none">Live Interactive Preview Editor</span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {(() => {
                                  let runningIndex = 1;
                                  return service.scopeItems.map((it, i) => {
                                    const trimmed = String(it || '').trim();
                                    if (!trimmed) return null;

                                    const isHeading = trimmed.startsWith('### ');
                                    const leadingSpaces = it.match(/^\s*/)?.[0].length || 0;
                                    const isSub = leadingSpaces >= 2 || it.startsWith('\t');
                                    const cleanText = trimmed.replace(/^###\s*/, '').replace(/^[-*•◦▪+]\s*/, '').trim();

                                    const activeBtnStyle = "bg-[#4E12D4] text-white";
                                    const inactiveBtnStyle = "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400";

                                    const actionControls = (
                                      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 ml-2">
                                        <button
                                          type="button"
                                          title="Make Heading"
                                          onClick={() => setItemType(catId, i, 'heading')}
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${isHeading ? activeBtnStyle : inactiveBtnStyle}`}
                                        >
                                          H
                                        </button>
                                        <button
                                          type="button"
                                          title="Make Main Feature"
                                          onClick={() => setItemType(catId, i, 'main')}
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${(!isHeading && !isSub) ? activeBtnStyle : inactiveBtnStyle}`}
                                        >
                                          Main
                                        </button>
                                        <button
                                          type="button"
                                          title="Make Sub Feature"
                                          onClick={() => setItemType(catId, i, 'sub')}
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${isSub ? activeBtnStyle : inactiveBtnStyle}`}
                                        >
                                          Sub
                                        </button>
                                        <button
                                          type="button"
                                          title="Delete Item"
                                          onClick={() => deleteItem(catId, i)}
                                          className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer transition-all ml-0.5"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );

                                    if (isHeading) {
                                      return (
                                        <div key={i} className="col-span-full mt-3 first:mt-0 mb-1 pb-1 border-b border-purple-500/20 flex items-center justify-between group/item hover:bg-slate-100/20 dark:hover:bg-slate-800/10 px-2 rounded-lg">
                                          <input
                                            value={cleanText}
                                            onChange={(e) => editItemText(catId, i, e.target.value)}
                                            className="text-xs font-black tracking-tight text-[#4E12D4] dark:text-purple-400 uppercase bg-transparent border-0 focus:outline-none flex-1 py-1"
                                          />
                                          {actionControls}
                                        </div>
                                      );
                                    }

                                    if (isSub) {
                                      return (
                                        <div key={i} className="col-span-full flex items-center justify-between gap-2 pl-6 py-1 group/item hover:bg-slate-100/30 dark:hover:bg-slate-800/10 rounded-lg pr-2">
                                          <div className="flex items-center gap-2 flex-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#4E12D4] dark:bg-purple-400 shrink-0"></span>
                                            <input
                                              value={cleanText}
                                              onChange={(e) => editItemText(catId, i, e.target.value)}
                                              className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-transparent border-0 focus:outline-none flex-1 py-0.5"
                                            />
                                          </div>
                                          {actionControls}
                                        </div>
                                      );
                                    }

                                    const startsWithBullet = /^[-*•◦▪+]\s*/.test(trimmed);

                                    if (startsWithBullet) {
                                      return (
                                        <div key={i} className="col-span-full md:col-span-1 group relative flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-purple-500/[0.03] dark:bg-purple-500/[0.05] border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/[0.06] shadow-2xs hover:shadow-md transition-all duration-200">
                                          <div className="flex items-center gap-3.5 flex-1">
                                            <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 font-black text-xs shadow-2xs">
                                              •
                                            </div>
                                            <input
                                              value={cleanText}
                                              onChange={(e) => editItemText(catId, i, e.target.value)}
                                              className="bg-transparent border-0 focus:outline-none focus:ring-0 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 flex-1 py-0.5"
                                            />
                                          </div>
                                          {actionControls}
                                        </div>
                                      );
                                    }

                                    const standardIndex = runningIndex++;

                                    return (
                                      <div key={i} className="col-span-full md:col-span-1 group relative flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-purple-500/[0.03] dark:bg-purple-500/[0.05] border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/[0.06] shadow-2xs hover:shadow-md transition-all duration-200">
                                        <div className="flex items-center gap-3.5 flex-1">
                                          <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 font-black text-xs shadow-2xs">
                                            {standardIndex}
                                          </div>
                                          <input
                                            value={cleanText}
                                            onChange={(e) => editItemText(catId, i, e.target.value)}
                                            className="bg-transparent border-0 focus:outline-none focus:ring-0 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 flex-1 py-0.5"
                                          />
                                        </div>
                                        {actionControls}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        service.scopeItems.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No deliverables added yet.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <AnimatePresence>
                              {service.scopeItems.map((item, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="group relative flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800"
                                >
                                  <span className="w-6 h-6 rounded-lg bg-[#4E12D4]/10 text-[#4E12D4] font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    {String(i + 1).padStart(2, '0')}
                                  </span>
                                  <textarea
                                    value={item}
                                    onChange={(e) => updateScopeItem(catId, i, e.target.value)}
                                    rows={2}
                                    placeholder="Describe this deliverable..."
                                    className="flex-1 bg-transparent border-0 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeScopeItem(catId, i)}
                                    className="opacity-40 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        )
                      )}
                    </div>

                    {/* Tech Stack — web-development only */}
                    {catId === 'web-development' && (
                      <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/40">
                        <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Technology Stack</label>
                        <PremiumTextarea
                          placeholder="Short description of the technology stack (shown above the table in the PDF)..."
                          value={service.techStack?.description || ''}
                          onChange={(e) => updateTechStack(catId, { description: e.target.value })}
                          rows={2}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <TagInput
                            label="Frontend"
                            values={service.techStack?.frontend || []}
                            onChange={(next) => updateTechStack(catId, { frontend: next })}
                            placeholder="e.g. Next.js"
                          />
                          <TagInput
                            label="Backend"
                            values={service.techStack?.backend || []}
                            onChange={(next) => updateTechStack(catId, { backend: next })}
                            placeholder="e.g. Node.js"
                          />
                          <TagInput
                            label="Database"
                            values={service.techStack?.database || []}
                            onChange={(next) => updateTechStack(catId, { database: next })}
                            placeholder="e.g. MongoDB"
                          />
                          <TagInput
                            label="Tools"
                            values={service.techStack?.tools || []}
                            onChange={(next) => updateTechStack(catId, { tools: next })}
                            placeholder="e.g. Figma"
                          />
                        </div>
                      </div>
                    )}

                    {/* Pricing: base + discount/tax */}
                    <div className={`grid grid-cols-1 ${showBasePrice ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
                      {showBasePrice && (
                        <PremiumInput
                          label="Base / Package Price"
                          type="number"
                          placeholder="0.00"
                          value={service.basePrice || ''}
                          onChange={(e) => updateService(catId, { basePrice: parseFloat(e.target.value) || 0 })}
                        />
                      )}
                      <PremiumInput
                        label="Discount (%)"
                        type="number"
                        placeholder="0%"
                        value={service.discount || ''}
                        onChange={(e) => updateService(catId, { discount: parseFloat(e.target.value) || 0 })}
                      />
                      <PremiumInput
                        label="VAT / Tax (%)"
                        type="number"
                        placeholder="0%"
                        value={service.taxRate || ''}
                        onChange={(e) => updateService(catId, { taxRate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    {/* Line items */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                          Add-on / Line Items {unitLabel ? `(priced per ${unitLabel})` : '(one-time or recurring — e.g. hosting, retainers)'}
                        </label>
                        <div className="flex items-center gap-2">
                          {suggestions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => suggestions.forEach((it) => addLineItem(catId, { ...it }))}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground/80 hover:bg-muted/70 font-bold text-[11px] transition-all cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" /> Add Suggested
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addLineItem(catId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4E12D4] text-white hover:bg-[#3d0da8] font-bold text-[11px] transition-all cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add Line Item
                          </button>
                        </div>
                      </div>

                      {service.lineItems.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No add-on line items yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {service.lineItems.map((item, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800"
                            >
                              <input
                                value={item.title}
                                onChange={(e) => updateLineItem(catId, i, { title: e.target.value })}
                                placeholder="Item title"
                                className="sm:col-span-4 bg-transparent border border-transparent focus:border-[#4E12D4]/40 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none"
                              />
                              <select
                                value={item.billingCycle}
                                onChange={(e) => updateLineItem(catId, i, { billingCycle: e.target.value as BillingCycle })}
                                className="sm:col-span-2 bg-background border border-border/60 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                              >
                                {billingOptions.map((bc) => (
                                  <option key={bc} value={bc}>
                                    {BILLING_CYCLE_LABELS[bc]}
                                  </option>
                                ))}
                              </select>
                              {unitBased && (
                                <input
                                  type="number"
                                  value={item.quantity ?? 1}
                                  onChange={(e) => updateLineItem(catId, i, { quantity: parseFloat(e.target.value) || 1 })}
                                  placeholder="Qty"
                                  className="sm:col-span-1 bg-background border border-border/60 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                                />
                              )}
                              <input
                                type="number"
                                value={item.price || ''}
                                onChange={(e) => updateLineItem(catId, i, { price: parseFloat(e.target.value) || 0 })}
                                placeholder="Unit price"
                                className={`${unitBased ? 'sm:col-span-2' : 'sm:col-span-3'} bg-background border border-border/60 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none`}
                              />
                              <input
                                value={item.description || ''}
                                onChange={(e) => updateLineItem(catId, i, { description: e.target.value })}
                                placeholder="Note (optional)"
                                className="sm:col-span-2 bg-transparent border border-transparent focus:border-[#4E12D4]/40 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => removeLineItem(catId, i)}
                                className="sm:col-span-1 flex items-center justify-center p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Per-service total readout */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/40">
                      <span className="text-sm font-bold text-foreground/80">{cfg.label} Total (one-time)</span>
                      <span className="text-lg font-black text-[#4E12D4]">{formatMoney(serviceTotal.grandTotal, currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Investment & Pricing Summary */}
      <PremiumCard accent="violet">
        <div className="flex items-center gap-3.5 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1E0078] to-[#C850FA] text-white flex items-center justify-center shadow-md shadow-[#1E0078]/20">
            <DollarSign className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              4. Quotation Investment &amp; Pricing Summary
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              {data.services.length > 1
                ? 'Auto-calculated from every selected service below.'
                : 'Auto-calculated from the service pricing above.'}
            </p>
          </div>
        </div>

        {data.services.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Select at least one service above to see pricing.</p>
        ) : (
          <div className="space-y-4">
            {data.services.length > 1 && (
              <div className="rounded-xl border border-border/40 overflow-hidden">
                {perService.map((s) => (
                  <div key={s.category} className="flex items-center justify-between px-4 py-3 border-b border-border/30 last:border-b-0 bg-muted/10">
                    <span className="text-sm font-semibold text-foreground/80">{CATEGORY_CONFIG[s.category as QuotationCategory]?.label || s.category}</span>
                    <span className="text-sm font-bold">{formatMoney(s.grandTotal, currency)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 rounded-xl bg-gradient-to-r from-[#1E0078] via-[#4E12D4] to-[#C850FA] text-white flex items-center justify-between shadow-lg">
              <span className="text-sm uppercase tracking-widest font-semibold opacity-90">Grand Total Investment</span>
              <span className="text-2xl font-black">{formatMoney(liveTotals.grandTotal, currency)}</span>
            </div>

            {recurringCharges.length > 0 && (
              <div className="p-4 rounded-xl border border-dashed border-pink-400/50 bg-pink-500/[0.03] space-y-2">
                <p className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider">
                  Ongoing / Recurring Charges (billed separately, not included above)
                </p>
                <ul className="space-y-1">
                  {recurringCharges.map((item, i) => (
                    <li key={i} className="flex items-center justify-between text-xs font-medium text-foreground/80">
                      <span>{item.title} <span className="text-slate-400">({BILLING_CYCLE_LABELS[item.billingCycle]})</span></span>
                      <span className="font-bold">{formatMoney((item.price || 0) * (item.quantity ?? 1), currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </PremiumCard>

      {/* 5. AI Auto-Fill & Import Tool */}
      <PremiumCard accent="magenta">
        <div className="flex items-center gap-3.5 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C850FA] to-[#4E12D4] text-white flex items-center justify-center shadow-md shadow-[#C850FA]/20">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              5. AI Auto-Fill &amp; Import Tool
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              Copy the custom prompt for your selected services, paste it to ChatGPT/Claude, and paste the response back to import everything.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">💡 Smart Prompt Builder:</span> Generates a tailor-made prompt containing only your active selected services.
            </div>
            <PremiumButton variant="outline" size="sm" onClick={copyPrompt} leftIcon={<Copy className="w-3.5 h-3.5" />}>
              Copy Custom AI Prompt
            </PremiumButton>
          </div>

          <div className="space-y-3">
            <PremiumTextarea
              placeholder="Paste ChatGPT/Claude structured response here..."
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              rows={6}
            />
            <div className="flex justify-end">
              <PremiumButton variant="magenta" size="sm" onClick={handleAiImport} leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
                Smart Import to Proposal
              </PremiumButton>
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* 6. Not Included in This Price */}
      <div className="rounded-3xl border border-red-500/20 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-red-500/5 to-transparent border-b border-red-500/10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-xl font-bold shadow-sm">
              ✕
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-red-600 dark:text-red-400">6. Not Included in This Price</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">List third-party licenses, ad spend, domain/hosting, or out-of-scope items.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <PremiumBadge variant="red" size="sm" className="font-bold px-3 py-1 shadow-2xs">
              {notIncludedItems.length} {notIncludedItems.length === 1 ? 'Exclusion' : 'Exclusions'}
            </PremiumBadge>
            <button
              type="button"
              onClick={addNotIncludedItem}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold text-xs shadow-md shadow-red-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add Exclusion</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {notIncludedItems.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-red-500/20 rounded-2xl bg-red-500/[0.02]">
              <p className="text-sm font-semibold text-slate-400">No exclusions listed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {notIncludedItems.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative flex items-start gap-3.5 p-4 rounded-2xl bg-red-500/[0.03] dark:bg-red-500/[0.05] border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/[0.06] shadow-2xs hover:shadow-md transition-all duration-200"
                  >
                    <div className="w-7 h-7 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5 font-black text-xs shadow-2xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={item}
                        onChange={(e) => updateNotIncludedItem(idx, e.target.value)}
                        rows={2}
                        placeholder="Describe exclusion item..."
                        className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-sm font-sans font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none leading-relaxed py-0 px-0 min-h-[44px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNotIncludedItem(idx)}
                      className="opacity-40 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-all shrink-0 -mt-1 -mr-1 cursor-pointer"
                      title="Remove exclusion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* 7. Client Needs to Provide */}
      <div className="rounded-3xl border border-[#4E12D4]/20 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#4E12D4]/5 to-transparent border-b border-[#4E12D4]/10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#4E12D4]/10 text-[#4E12D4] flex items-center justify-center text-xl font-bold shadow-sm">
              📋
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-[#4E12D4] dark:text-indigo-300">7. Client Needs to Provide</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">List assets, credentials, hosting access, and brand guidelines required from the client.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <PremiumBadge variant="purple" size="sm" className="font-bold px-3 py-1 shadow-2xs">
              {clientRequirements.length} {clientRequirements.length === 1 ? 'Requirement' : 'Requirements'}
            </PremiumBadge>
            <button
              type="button"
              onClick={addRequirementItem}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#4E12D4] text-white hover:bg-[#3d0da8] font-bold text-xs shadow-md shadow-[#4E12D4]/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add Requirement</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {clientRequirements.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-[#4E12D4]/20 rounded-2xl bg-[#4E12D4]/[0.02]">
              <p className="text-sm font-semibold text-slate-400">No client requirements listed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {clientRequirements.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative flex items-start gap-3.5 p-4 rounded-2xl bg-[#4E12D4]/[0.03] dark:bg-[#4E12D4]/[0.06] border border-[#4E12D4]/20 hover:border-[#4E12D4]/40 hover:bg-[#4E12D4]/[0.08] shadow-2xs hover:shadow-md transition-all duration-200"
                  >
                    <div className="w-7 h-7 rounded-xl bg-[#4E12D4]/10 text-[#4E12D4] dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5 font-black text-xs shadow-2xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={item}
                        onChange={(e) => updateRequirementItem(idx, e.target.value)}
                        rows={2}
                        placeholder="Describe client requirement..."
                        className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-sm font-sans font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none leading-relaxed py-0 px-0 min-h-[44px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRequirementItem(idx)}
                      className="opacity-40 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-all shrink-0 -mt-1 -mr-1 cursor-pointer"
                      title="Remove requirement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* 8. Payment Milestones */}
      <div className="rounded-3xl border border-purple-500/20 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border-b border-purple-500/15">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-[#4E12D4] dark:text-[#C850FA] flex items-center justify-center text-xl font-bold shadow-sm">
              💳
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-[#4E12D4] dark:text-indigo-300">8. Payment Milestones</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select a standard payment milestone structure or write custom payment terms.</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {[
              { id: '30/40/30', label: '30% / 40% / 30%', desc: 'Upfront, Midway & Final' },
              { id: '50/50', label: '50% / 50%', desc: 'Upfront & Handover' },
              { id: '20/30/50', label: '20% / 30% / 50%', desc: 'Booking, Midway & Delivery' },
              { id: 'custom', label: 'Custom Terms', desc: 'Write custom milestones' },
            ].map((opt) => {
              const isSelected = milestoneType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleMilestoneChange(opt.id as '30/40/30' | '50/50' | '20/30/50' | 'custom')}
                  className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#4E12D4]/10 to-[#1E0078]/10 border-[#4E12D4] ring-2 ring-[#4E12D4]/20 shadow-md scale-[1.02]'
                      : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className={`text-sm font-black tracking-tight ${isSelected ? 'text-[#4E12D4] dark:text-[#C850FA]' : 'text-slate-900 dark:text-white'}`}>
                    {opt.label}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {milestoneType === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80"
            >
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Write Custom Payment Milestones / Terms:
              </label>
              <textarea
                value={customMilestoneText}
                onChange={(e) => handleCustomTextChange(e.target.value)}
                rows={2}
                placeholder="e.g. 40% Advance on signing, 30% after design approval, 30% on final website deployment..."
                className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-500/30 focus:border-[#4E12D4] focus:ring-2 focus:ring-[#4E12D4]/20 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all resize-none shadow-inner"
              />
            </motion.div>
          )}

          {/* Current Selection Preview */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Active Structure:</span>
            {data.paymentMilestones?.map((m, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xs text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="w-5 h-5 rounded-md bg-[#4E12D4]/10 text-[#4E12D4] dark:text-[#C850FA] font-mono text-[10px] flex items-center justify-center">
                  {idx + 1}
                </span>
                <span>{m.label}</span>
                {m.percentage > 0 && (
                  <span className="font-mono text-[#4E12D4] dark:text-[#C850FA] ml-1 font-extrabold">({m.percentage}%)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Floating Action Bar */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-2xl">
        <button
          type="button"
          onClick={() => setIsPdfModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-fuchsia-500/20 hover:from-purple-500/35 hover:via-indigo-500/35 hover:to-fuchsia-500/35 border border-purple-500/50 text-purple-100 hover:text-white font-bold text-xs tracking-wide shadow-lg shadow-purple-900/20 transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer"
        >
          <Eye className="w-4 h-4 text-[#C850FA] animate-pulse" />
          <span>Preview PDF</span>
        </button>

        <PremiumButton
          variant="purple"
          size="sm"
          onClick={() => saveQuotation('draft', true)}
          disabled={isCreating || isUpdating}
          leftIcon={<Save className="w-4 h-4 text-white" />}
        >
          {isCreating || isUpdating ? 'Saving...' : data._id ? 'Update Quotation' : 'Save Quotation'}
        </PremiumButton>

        <PremiumButton
          variant="magenta"
          size="sm"
          onClick={openRecipientPicker}
          disabled={isSending || isCreating || isUpdating}
          leftIcon={<Send className="w-4 h-4" />}
        >
          Send to Client
        </PremiumButton>
      </div>

      {/* Recipient Email Dialog */}
      <QuotationEmailDialog
        open={recipientModalOpen}
        onClose={() => setRecipientModalOpen(false)}
        clientId={data.clientId || ''}
        quotationLabel={data.quotationNumber || data.details?.title}
        onSend={confirmDispatch}
        isSending={isSending || isCreating || isUpdating}
      />

      {/* Live PDF Preview Modal — shows the real Puppeteer-generated PDF */}
      <MultiServiceQuotationPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        quotationId={data._id}
        fileNameBase={fileNameBase}
        ensureSaved={() => saveQuotation('draft')}
      />
    </div>
  );
}

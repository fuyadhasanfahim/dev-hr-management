'use client';

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useQuotationStore } from '@/store/useQuotationStore';
import { toast } from 'sonner';
import {
  Building2,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Send,
  FileText,
  Layers,
  DollarSign,
  User,
  Mail,
  Phone,
  Copy,
  Eye,
  Receipt,
  Briefcase,
  ArrowLeft,
  Calendar as CalendarIcon,
  Code,
  TrendingUp,
  Video,
  Camera,
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
import { IQuotationPhase, IPaymentMilestone } from '@/types/quotation.type';
import { Client } from '@/types/client.type';
import { QuotationEmailDialog } from '../QuotationEmailDialog';
import { MultiServiceQuotationPdfModal } from '@/components/quotation/pdf/MultiServiceQuotationPdfModal';
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

type ServiceCategoryKey = 'web-dev' | 'marketing' | 'video-editing' | 'photo-editing';

interface ServiceCategory {
  id: ServiceCategoryKey;
  label: string;
  badgeText: string;
  color: string;
  borderColor: string;
  bgColor: string;
  iconChar: string;
  iconBg: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'web-dev',
    label: 'Web Design & Development',
    badgeText: 'Web Dev',
    color: 'text-[#4E12D4] dark:text-[#C850FA]',
    borderColor: 'border-[#4E12D4]/40 hover:border-[#4E12D4]',
    bgColor: 'bg-[#4E12D4]/10 dark:bg-[#4E12D4]/20',
    iconChar: '⚡',
    iconBg: 'bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white shadow-md shadow-[#4E12D4]/30 border border-white/20',
    icon: Code,
  },
  {
    id: 'marketing',
    label: 'Digital Marketing & SEO',
    badgeText: 'Marketing',
    color: 'text-[#C850FA] dark:text-purple-300',
    borderColor: 'border-[#C850FA]/40 hover:border-[#C850FA]',
    bgColor: 'bg-[#C850FA]/10 dark:bg-[#C850FA]/20',
    iconChar: '📈',
    iconBg: 'bg-gradient-to-br from-[#C850FA] to-[#4E12D4] text-white shadow-md shadow-[#C850FA]/30 border border-white/20',
    icon: TrendingUp,
  },
  {
    id: 'video-editing',
    label: 'Video & Motion Graphics',
    badgeText: 'Video Editing',
    color: 'text-[#1E0078] dark:text-indigo-300',
    borderColor: 'border-[#1E0078]/40 hover:border-[#1E0078]',
    bgColor: 'bg-[#1E0078]/10 dark:bg-[#1E0078]/20',
    iconChar: '🎬',
    iconBg: 'bg-gradient-to-br from-[#1E0078] to-[#4E12D4] text-white shadow-md shadow-[#1E0078]/30 border border-white/20',
    icon: Video,
  },
  {
    id: 'photo-editing',
    label: 'Photo Editing & Retouching',
    badgeText: 'Photo Editing',
    color: 'text-[#4E12D4] dark:text-blue-400',
    borderColor: 'border-blue-500/40 hover:border-blue-500',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    iconChar: '📸',
    iconBg: 'bg-gradient-to-br from-blue-600 to-[#1E0078] text-white shadow-md shadow-blue-500/30 border border-white/20',
    icon: Camera,
  },
];

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
    updateClient,
    updateDetails,
    updatePricing,
    setData,
    setPaymentMilestones,
  } = useQuotationStore();

  const { data: clientsData, isLoading: clientsLoading } = useGetClientsQuery({});
  const [createQuotation, { isLoading: isCreating }] = useCreateQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateQuotationMutation();
  const [sendQuotation, { isLoading: isSending }] = useSendQuotationMutation();

  const [activeServices, setActiveServices] = useState<ServiceCategoryKey[]>(['web-dev']);
  const [categoryScopes, setCategoryScopes] = useState<Record<ServiceCategoryKey, string[]>>({
    'web-dev': [
      'Complete Responsive Web Architecture & Design System',
      'High-converting Landing Page with Modern Glassmorphism UI',
      'Dynamic Backend API & Database Integration',
      'Speed Optimization (90+ Google PageSpeed Score)',
    ],
    'marketing': [
      'Comprehensive Technical & On-Page SEO Audit',
      'Google Analytics 4 (GA4) & Meta Pixel Setup',
      'Targeted Ad Campaign Strategy & Copywriting',
    ],
    'video-editing': [
      'Professional Video Editing & Narrative Pacing',
      'Color Grading & Cinematic Visual Enhancement',
      'Motion Graphics, Lower Thirds & Intro Animations',
    ],
    'photo-editing': [
      'High-End Product & Portrait Retouching',
      'Background Removal & Seamless Composition',
      'Color Correction & Lighting Enhancement',
    ],
  });

  const [notIncludedItems, setNotIncludedItems] = useState<string[]>([
    'Domain Registration & Premium Web Hosting (Billed Separately)',
    'Third-party Paid API Licenses, Plugins, or Premium Fonts',
    'Paid Ad Spend for Facebook, Google, or LinkedIn Campaigns',
    'Raw Unedited Studio Footage or Source Design Files (Unless specified)',
  ]);

  const [clientRequirements, setClientRequirements] = useState<string[]>([
    'High-resolution Brand Logo, Color Palette & Typography Guidelines',
    'Admin Access / Credentials to Hosting, Domain, or CMS Platform',
    'Final Approved Text Content, Copywriting & Product Photography',
    'Dedicated Point of Contact for Prompt Feedback and Approvals',
  ]);

  const [aiInputText, setAiInputText] = useState('');
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const isStoreInitializedRef = useRef(false);

  const [milestoneType, setMilestoneType] = useState<'30/40/30' | '50/50' | '20/30/50' | 'custom'>('30/40/30');
  const [customMilestoneText, setCustomMilestoneText] = useState('');

  const handleMilestoneChange = (type: '30/40/30' | '50/50' | '20/30/50' | 'custom', customText = customMilestoneText) => {
    setMilestoneType(type);
    let ms: IPaymentMilestone[] = [];
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

  useEffect(() => {
    isStoreInitializedRef.current = false;
  }, [data._id]);

  // Sync state from store when loading an existing quotation or template
  useEffect(() => {
    if (isStoreInitializedRef.current) return;
    if (
      (data.phases && data.phases.length > 0) ||
      (data.notIncluded && data.notIncluded.length > 0) ||
      (data.clientRequirements && data.clientRequirements.length > 0)
    ) {
      isStoreInitializedRef.current = true;
      if (data.phases && data.phases.length > 0) {
        const nextScopes: Record<ServiceCategoryKey, string[]> = {
          'web-dev': [],
          'marketing': [],
          'video-editing': [],
          'photo-editing': [],
        };
        const nextActive: ServiceCategoryKey[] = [];

        data.phases.forEach((phase) => {
          const titleLower = (phase.title || '').toLowerCase();
          let matchedKey: ServiceCategoryKey = 'web-dev';
          if (titleLower.includes('marketing') || titleLower.includes('seo')) matchedKey = 'marketing';
          else if (titleLower.includes('video') || titleLower.includes('motion')) matchedKey = 'video-editing';
          else if (titleLower.includes('photo') || titleLower.includes('retouch')) matchedKey = 'photo-editing';

          if (phase.items && phase.items.length > 0) {
            nextScopes[matchedKey] = phase.items;
            if (!nextActive.includes(matchedKey)) nextActive.push(matchedKey);
          }
        });

        if (nextActive.length > 0) {
          setActiveServices(nextActive);
          setCategoryScopes(nextScopes);
        }
      }
      if (data.notIncluded && data.notIncluded.length > 0) setNotIncludedItems(data.notIncluded);
      if (data.clientRequirements && data.clientRequirements.length > 0) setClientRequirements(data.clientRequirements);
      if (data.paymentMilestones && data.paymentMilestones.length > 0) {
        const ms = data.paymentMilestones;
        if (ms.length === 3 && ms[0].percentage === 30 && ms[1].percentage === 40 && ms[2].percentage === 30) {
          setMilestoneType('30/40/30');
        } else if (ms.length === 2 && ms[0].percentage === 50 && ms[1].percentage === 50) {
          setMilestoneType('50/50');
        } else if (ms.length === 3 && ms[0].percentage === 20 && ms[1].percentage === 30 && ms[2].percentage === 50) {
          setMilestoneType('20/30/50');
        } else {
          setMilestoneType('custom');
          setCustomMilestoneText(ms.map(m => m.label).join(' / '));
        }
      } else {
        setMilestoneType('30/40/30');
        setPaymentMilestones([
          { label: '30% Upfront Payment', percentage: 30 },
          { label: '40% Midway Progress Milestone', percentage: 40 },
          { label: '30% Final Delivery & Handover', percentage: 30 },
        ]);
      }
    }
  }, [data.phases, data.notIncluded, data.clientRequirements]);

  const syncToStore = (
    newScopes = categoryScopes,
    newNotIncluded = notIncludedItems,
    newRequirements = clientRequirements,
    newActive = activeServices,
  ) => {
    const constructedPhases: IQuotationPhase[] = newActive.map((catId) => {
      const cat = SERVICE_CATEGORIES.find((c) => c.id === catId)!;
      return {
        title: cat.label,
        description: `Deliverables and feature scope for ${cat.label}`,
        items: newScopes[catId] || [],
      };
    });

    const flattenedScope: string[] = [];
    newActive.forEach((catId) => {
      const items = newScopes[catId] || [];
      items.forEach((item) =>
        flattenedScope.push(`[${SERVICE_CATEGORIES.find((c) => c.id === catId)?.badgeText}] ${item}`),
      );
    });

    setData({
      ...data,
      phases: constructedPhases,
      developmentScope: flattenedScope,
      notIncluded: newNotIncluded,
      clientRequirements: newRequirements,
    });
  };

  const toggleService = (catId: ServiceCategoryKey) => {
    let nextActive: ServiceCategoryKey[];
    if (activeServices.includes(catId)) {
      if (activeServices.length === 1) {
        toast.error('You must keep at least one agency service active!');
        return;
      }
      nextActive = activeServices.filter((id) => id !== catId);
    } else {
      nextActive = [...activeServices, catId];
    }
    setActiveServices(nextActive);
    syncToStore(categoryScopes, notIncludedItems, clientRequirements, nextActive);
  };

  const basePrice = Number(data.pricing?.basePrice || 0);
  const discount = Number(data.pricing?.discount || 0);
  const taxRate = Number(data.pricing?.taxRate || 0);

  const computedGrandTotal = useMemo(() => {
    const discounted = basePrice - (basePrice * discount) / 100;
    const taxed = discounted + (discounted * taxRate) / 100;
    return Math.max(0, taxed);
  }, [basePrice, discount, taxRate]);



  const dynamicAiPrompt = useMemo(() => {
    const activeHeaders = activeServices
      .map((catId, idx) => {
        const cat = SERVICE_CATEGORIES.find((c) => c.id === catId)!;
        let desc = '(List feature deliverables as bullet points)';
        if (catId === 'web-dev') desc = '(List web structure, UI design, and development features as bullet points)';
        else if (catId === 'marketing') desc = '(List SEO audit, GA4 setup, and ad campaign features as bullet points)';
        else if (catId === 'video-editing') desc = '(List video editing, color grading, and reel features as bullet points)';
        else if (catId === 'photo-editing') desc = '(List photo retouching, background removal, and graphic features as bullet points)';

        return `${idx + 1}. ${cat.label} Scope\n${desc}`;
      })
      .join('\n\n');

    const exclusionsIdx = activeServices.length + 1;
    const reqIdx = activeServices.length + 2;

    return `Please create a Multi-Service Agency Proposal for the selected services with these exact section headings:\n\n${activeHeaders}\n\n${exclusionsIdx}. Not Included in This Price\n(List exclusions like domain, hosting, ad budget as bullet points)\n\n${reqIdx}. Client Needs to Provide\n(List required client assets like brand guidelines, credentials as bullet points)`;
  }, [activeServices]);

  const copyPrompt = () => {
    navigator.clipboard.writeText(dynamicAiPrompt);
    const names = activeServices
      .map((id) => SERVICE_CATEGORIES.find((c) => c.id === id)?.badgeText)
      .filter(Boolean)
      .join(', ');
    toast.success(`🎉 AI Prompt for [${names}] copied to clipboard!`);
  };

  const handleAiImport = () => {
    if (!aiInputText.trim()) {
      toast.error('Please paste ChatGPT proposal output first!');
      return;
    }

    const nextScopes = { ...categoryScopes };
    let nextNotIncluded = [...notIncludedItems];
    let nextReq = [...clientRequirements];
    const nextActive = [...activeServices];
    let totalParsed = 0;

    const sections = aiInputText.split(/\n(?=\d+\.\s+)|(?=###\s*\d*\.\s*)|(?=##\s*)/gi);

    sections.forEach((sec) => {
      const lines = sec
        .split('\n')
        .map((l) => l.trim().replace(/^[-*•✅❌👉⚡🎬📸📈]\s*/, ''))
        .filter(Boolean);
      if (lines.length < 2) return;

      const header = lines[0].toLowerCase();
      const items = lines.slice(1).filter((l) => l.length > 5 && !l.toLowerCase().includes('scope'));

      if (items.length === 0) return;

      let targetCatId: ServiceCategoryKey | null = null;
      if (header.includes('web') || header.includes('design') || header.includes('development') || header.includes('ui/ux')) {
        targetCatId = 'web-dev';
      } else if (header.includes('marketing') || header.includes('seo') || header.includes('campaign')) {
        targetCatId = 'marketing';
      } else if (header.includes('video') || header.includes('motion') || header.includes('reel')) {
        targetCatId = 'video-editing';
      } else if (header.includes('photo') || header.includes('retouch') || header.includes('graphic')) {
        targetCatId = 'photo-editing';
      }

      if (targetCatId) {
        nextScopes[targetCatId] = items;
        if (!nextActive.includes(targetCatId)) nextActive.push(targetCatId);
        totalParsed += items.length;
      } else if (header.includes('not included') || header.includes('exclusion')) {
        nextNotIncluded = items;
        totalParsed += items.length;
      } else if (header.includes('provide') || header.includes('client need') || header.includes('requirement')) {
        nextReq = items;
        totalParsed += items.length;
      }
    });

    if (totalParsed > 0) {
      setCategoryScopes(nextScopes);
      setNotIncludedItems(nextNotIncluded);
      setClientRequirements(nextReq);
      setActiveServices(nextActive);
      setAiInputText('');
      syncToStore(nextScopes, nextNotIncluded, nextReq, nextActive);
      toast.success(`🎉 Successfully auto-filled ${totalParsed} items across multi-service categories!`);
    } else {
      toast.error("Could not auto-detect sections! Ensure headings like 'Web Design Scope' or 'Not Included' are present.");
    }
  };

  const updateScopeItem = (catId: ServiceCategoryKey, index: number, val: string) => {
    const next = { ...categoryScopes };
    next[catId] = [...next[catId]];
    next[catId][index] = val;
    setCategoryScopes(next);
    syncToStore(next, notIncludedItems, clientRequirements, activeServices);
  };

  const addScopeItem = (catId: ServiceCategoryKey) => {
    const next = { ...categoryScopes };
    next[catId] = [...next[catId], 'New feature deliverable description...'];
    setCategoryScopes(next);
    syncToStore(next, notIncludedItems, clientRequirements, activeServices);
  };

  const removeScopeItem = (catId: ServiceCategoryKey, index: number) => {
    const next = { ...categoryScopes };
    next[catId] = next[catId].filter((_, i) => i !== index);
    setCategoryScopes(next);
    syncToStore(next, notIncludedItems, clientRequirements, activeServices);
  };

  const updateNotIncluded = (index: number, val: string) => {
    const next = [...notIncludedItems];
    next[index] = val;
    setNotIncludedItems(next);
    syncToStore(categoryScopes, next, clientRequirements, activeServices);
  };

  const addNotIncluded = () => {
    const next = [...notIncludedItems, 'New exclusion note...'];
    setNotIncludedItems(next);
    syncToStore(categoryScopes, next, clientRequirements, activeServices);
  };

  const removeNotIncluded = (index: number) => {
    const next = notIncludedItems.filter((_, i) => i !== index);
    setNotIncludedItems(next);
    syncToStore(categoryScopes, next, clientRequirements, activeServices);
  };

  const updateRequirement = (index: number, val: string) => {
    const next = [...clientRequirements];
    next[index] = val;
    setClientRequirements(next);
    syncToStore(categoryScopes, notIncludedItems, next, activeServices);
  };

  const addRequirement = () => {
    const next = [...clientRequirements, 'New prerequisite asset required from client...'];
    setClientRequirements(next);
    syncToStore(categoryScopes, notIncludedItems, next, activeServices);
  };

  const removeRequirement = (index: number) => {
    const next = clientRequirements.filter((_, i) => i !== index);
    setClientRequirements(next);
    syncToStore(categoryScopes, notIncludedItems, next, activeServices);
  };

  const saveQuotation = async (status: 'draft' | 'sent', shouldRedirect = false) => {
    if (!data.clientId) {
      toast.error('Please select a client first!');
      return null;
    }
    try {
      if (data._id) {
        const payload = { ...data };
        const updated = await updateQuotation({ id: data._id, ...payload }).unwrap();
        setData(updated);
        toast.success('🎉 Quotation updated successfully!');
        if (shouldRedirect) router.push(`/quotations/${updated._id}`);
        return updated._id;
      } else {
        const payload = { ...data, status };
        const created = await createQuotation(payload).unwrap();
        setData(created);
        toast.success('🎉 Quotation created successfully!');
        if (shouldRedirect) router.push(`/quotations/${created._id}`);
        return created._id;
      }
    } catch (err: unknown) {
      const maybe = err as { data?: { message?: string } } | null;
      toast.error(maybe?.data?.message || 'Failed to save quotation!');
      return null;
    }
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

  const activeScopesForPdf = useMemo(() => {
    return activeServices.map((id) => {
      const cat = SERVICE_CATEGORIES.find((c) => c.id === id)!;
      return {
        id: cat.id,
        label: cat.label,
        badgeText: cat.badgeText,
        color: cat.color,
        borderColor: cat.borderColor,
        bgColor: cat.bgColor,
        items: categoryScopes[id] || [],
      };
    });
  }, [activeServices, categoryScopes]);

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

      {/* Top Controls: Client Selector & Metadata */}
      <PremiumCard accent="purple">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white flex items-center justify-center shadow-md shadow-[#4E12D4]/20">
              <Briefcase className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                1. Client & Quotation Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                Select client details and configure quotation settings.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Client Details */}
          <div className="lg:col-span-6 space-y-4 bg-muted/20 p-5 rounded-xl border border-border/40">
            <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-[#4E12D4]" /> Client Information
            </h3>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Select Saved Client</label>
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
                <SelectTrigger className="w-full h-10 bg-background border-[#4E12D4]/30 rounded-xl font-medium">
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
            </div>

            <div className="space-y-3 pt-2">
              <PremiumInput
                label="Contact Person"
                placeholder="Client Contact Name"
                value={data.client?.contactName || ''}
                onChange={(e) => updateClient({ contactName: e.target.value })}
                leftIcon={<User className="w-4 h-4" />}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PremiumInput
                  label="Email Address"
                  placeholder="client@company.com"
                  value={data.client?.email || ''}
                  onChange={(e) => updateClient({ email: e.target.value })}
                  leftIcon={<Mail className="w-4 h-4" />}
                />
                <PremiumInput
                  label="Phone Number"
                  placeholder="+880 1712 345678"
                  value={data.client?.phone || ''}
                  onChange={(e) => updateClient({ phone: e.target.value })}
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Quotation Metadata & Template Picker */}
          <div className="lg:col-span-6 space-y-4 bg-muted/20 p-5 rounded-xl border border-border/40">
            <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#C850FA]" /> Proposal & Template Setup
            </h3>



            <div className="space-y-3 pt-2">
              <PremiumInput
                label="Proposal Package Title"
                placeholder="e.g. E-Commerce Redesign & Development Package"
                value={data.details?.title || ''}
                onChange={(e) => updateDetails({ title: e.target.value })}
                leftIcon={<Layers className="w-4 h-4" />}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* Active Quotation Services Bar */}
      <PremiumCard accent="purple">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white flex items-center justify-center shadow-md shadow-[#4E12D4]/20">
              <Layers className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                2. Active Quotation Services
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                Toggle agency service categories to configure scoped deliverables for this quotation.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICE_CATEGORIES.map((cat) => {
            const isActive = activeServices.includes(cat.id);
            const IconComponent = cat.icon;
            return (
              <motion.div
                key={cat.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleService(cat.id)}
                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between shadow-sm hover:shadow-md ${
                  isActive
                    ? `${cat.borderColor} bg-gradient-to-br from-white via-purple-50/40 to-white dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 ring-2 ring-[#4E12D4]/30 shadow-md shadow-[#4E12D4]/10`
                    : 'border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 opacity-70 hover:opacity-100 hover:border-[#4E12D4]/40'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl ${cat.iconBg} flex items-center justify-center shrink-0`}>
                    <IconComponent className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-black tracking-tight truncate ${isActive ? cat.color : 'text-slate-800 dark:text-slate-100'}`}>
                      {cat.badgeText}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">{cat.label}</div>
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

      {/* Investment & Pricing Summary Card */}
      <PremiumCard accent="violet">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1E0078] to-[#C850FA] text-white flex items-center justify-center shadow-md shadow-[#1E0078]/20">
              <DollarSign className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                3. Quotation Investment & Pricing
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                Set the base pricing, discount percentages, and taxes for the selected services.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
          <div>
            <PremiumInput
              label="Base Price (BDT)"
              type="number"
              placeholder="0.00"
              value={basePrice || ''}
              onChange={(e) => updatePricing({ basePrice: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div>
            <PremiumInput
              label="Discount (%)"
              type="number"
              placeholder="0%"
              value={discount || ''}
              onChange={(e) => updatePricing({ discount: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div>
            <PremiumInput
              label="VAT / Tax (%)"
              type="number"
              placeholder="0%"
              value={taxRate || ''}
              onChange={(e) => updatePricing({ taxRate: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-[#1E0078] via-[#4E12D4] to-[#C850FA] text-white flex flex-col justify-center items-center shadow-lg">
            <span className="text-[11px] uppercase tracking-widest font-semibold opacity-90">Total Investment</span>
            <span className="text-2xl font-black mt-0.5">{formatMoney(computedGrandTotal, 'BDT')}</span>
          </div>
        </div>
      </PremiumCard>

      {/* AI Smart Import & Multi-Service Parser */}
      <PremiumCard accent="magenta">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C850FA] to-[#4E12D4] text-white flex items-center justify-center shadow-md shadow-[#C850FA]/20">
              <Sparkles className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                4. AI Auto-Fill Prototype
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                Copy the prompt below, paste it into ChatGPT, and paste the AI response back to auto-fill deliverables.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">💡 Smart Prompt Copy:</span> Generates a prompt containing only headings for your currently selected active services.
            </div>
            <PremiumButton variant="outline" size="sm" onClick={copyPrompt} leftIcon={<Copy className="w-3.5 h-3.5" />}>
              Copy Multi-Service AI Prompt
            </PremiumButton>
          </div>

          <div className="space-y-3">
            <PremiumTextarea
              placeholder={`Paste ChatGPT proposal output here... (e.g. 1. ${
                SERVICE_CATEGORIES.find((c) => c.id === activeServices[0])?.label || 'Web Design'
              } Scope: ... ${activeServices.length > 1 ? `2. ${SERVICE_CATEGORIES.find((c) => c.id === activeServices[1])?.label} Scope: ... ` : ''}${activeServices.length + 1}. Not Included: ...)`}
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end">
              <PremiumButton variant="magenta" size="sm" onClick={handleAiImport} leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
                Smart Import to Quotation
              </PremiumButton>
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* Multi-Service Deliverables Scopes */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#4E12D4]" />
          5. Multi-Service Deliverables Scope
        </h2>

        {activeServices.map((catId) => {
          const cat = SERVICE_CATEGORIES.find((c) => c.id === catId)!;
          const items = categoryScopes[catId] || [];
          const IconComponent = cat.icon;

          return (
            <div key={cat.id} className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border-b border-purple-500/15 dark:border-purple-500/20">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl ${cat.iconBg} flex items-center justify-center shrink-0`}>
                    <IconComponent className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-lg font-black tracking-tight truncate ${cat.color}`}>{cat.label} Deliverables</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Configure specific feature scopes and milestones for this service.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <PremiumBadge variant="purple" size="sm" className="font-bold px-3 py-1 shadow-2xs">
                    {items.length} {items.length === 1 ? 'Item' : 'Items'}
                  </PremiumBadge>
                  <button
                    type="button"
                    onClick={() => addScopeItem(cat.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#4E12D4] to-[#1E0078] text-white hover:opacity-95 font-bold text-xs shadow-md shadow-[#4E12D4]/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {items.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
                    <p className="text-sm font-semibold text-slate-400">No deliverables added yet for {cat.label}.</p>
                    <button
                      type="button"
                      onClick={() => addScopeItem(cat.id)}
                      className="mt-3 text-xs font-bold text-[#4E12D4] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add first deliverable
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {items.map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group relative flex items-start gap-3.5 p-4.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 hover:border-[#4E12D4]/50 dark:hover:border-[#C850FA]/50 shadow-sm hover:shadow-md transition-all duration-200 focus-within:ring-2 focus-within:ring-[#4E12D4]/20 focus-within:border-[#4E12D4]"
                        >
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-md shadow-[#4E12D4]/20 border border-white/20 mt-0.5">
                            {String(idx + 1).padStart(2, '0')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <textarea
                              value={item}
                              onChange={(e) => updateScopeItem(cat.id, idx, e.target.value)}
                              rows={2}
                              placeholder="Describe this deliverable item..."
                              className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-sm font-sans font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none leading-relaxed py-0 px-0 min-h-[44px]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeScopeItem(cat.id, idx)}
                            className="opacity-40 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-all shrink-0 -mt-1 -mr-1 cursor-pointer"
                            title="Remove item"
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
          );
        })}
      </div>

      {/* Exclusions: Not Included in This Price */}
      <div className="rounded-3xl border border-red-500/20 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
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
              onClick={addNotIncluded}
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
              <button
                type="button"
                onClick={addNotIncluded}
                className="mt-2 text-xs font-bold text-red-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add first exclusion item
              </button>
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
                        onChange={(e) => updateNotIncluded(idx, e.target.value)}
                        rows={2}
                        placeholder="Describe exclusion item..."
                        className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-sm font-sans font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none leading-relaxed py-0 px-0 min-h-[44px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNotIncluded(idx)}
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

      {/* Prerequisites: Client Needs to Provide */}
      <div className="rounded-3xl border border-[#4E12D4]/20 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
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
              onClick={addRequirement}
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
              <button
                type="button"
                onClick={addRequirement}
                className="mt-2 text-xs font-bold text-[#4E12D4] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add first requirement item
              </button>
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
                        onChange={(e) => updateRequirement(idx, e.target.value)}
                        rows={2}
                        placeholder="Describe client requirement..."
                        className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 text-sm font-sans font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none leading-relaxed py-0 px-0 min-h-[44px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRequirement(idx)}
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
      <div className="rounded-3xl border border-purple-500/20 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
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
                  onClick={() => handleMilestoneChange(opt.id as any)}
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
            {data.paymentMilestones?.map((m: any, idx: number) => (
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

      {/* Multi-Service PDF Preview Modal */}
      <MultiServiceQuotationPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        quotationId={data._id || (data as any).id}
        overview={data.overview}
        quotationNo={data.quotationNumber || 'DRAFT-001'}
        issueDate={data.details?.date || format(new Date(), 'yyyy-MM-dd')}
        validUntil={data.details?.validUntil || format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd')}
        clientName={data.client?.contactName || data.client?.companyName || 'Valued Client'}
        clientEmail={data.client?.email || ''}
        proposalTitle={data.details?.title || 'Multi-Service Agency Proposal'}
        finalAmount={computedGrandTotal}
        activeScopes={activeScopesForPdf}
        notIncludedItems={notIncludedItems}
        clientRequirements={clientRequirements}
        paymentMilestones={data.paymentMilestones}
      />
    </div>
  );
}

import React from 'react';
import { cn } from '@/lib/utils';
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    FileText,
    Image as ImageIcon,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import { useSupportStore } from '../../store/useSupportStore';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

// ==========================================
// 1. PRIORITY BADGE
// ==========================================
interface PriorityBadgeProps {
    priority: 'low' | 'medium' | 'high' | 'urgent';
    className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
    const configs = {
        low: {
            bg: 'bg-emerald-500/10 dark:bg-emerald-400/5',
            text: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            label: 'Low',
        },
        medium: {
            bg: 'bg-sky-500/10 dark:bg-sky-400/5',
            text: 'text-sky-600 dark:text-sky-400 border-sky-500/20',
            label: 'Medium',
        },
        high: {
            bg: 'bg-amber-500/10 dark:bg-amber-400/5',
            text: 'text-amber-600 dark:text-amber-400 border-amber-500/20',
            label: 'High',
        },
        urgent: {
            bg: 'bg-rose-500/15 dark:bg-rose-400/10',
            text: 'text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse',
            label: 'Urgent',
        },
    };

    const current = configs[priority] || configs.low;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border',
                current.bg,
                current.text,
                className
            )}
        >
            <AlertCircle className="w-3 h-3" />
            {current.label}
        </span>
    );
}

// ==========================================
// 2. STATUS BADGE
// ==========================================
interface StatusBadgeProps {
    status: 'open' | 'in_progress' | 'pending_client' | 'resolved' | 'closed';
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const configs = {
        open: {
            bg: 'bg-indigo-500/10 dark:bg-indigo-400/5',
            text: 'text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
            label: 'Open',
        },
        in_progress: {
            bg: 'bg-amber-500/10 dark:bg-amber-400/5',
            text: 'text-amber-600 dark:text-amber-400 border-amber-500/20',
            label: 'In Progress',
        },
        pending_client: {
            bg: 'bg-purple-500/10 dark:bg-purple-400/5',
            text: 'text-purple-600 dark:text-purple-400 border-purple-500/20',
            label: 'Pending Customer',
        },
        resolved: {
            bg: 'bg-emerald-500/10 dark:bg-emerald-400/5',
            text: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            label: 'Resolved',
        },
        closed: {
            bg: 'bg-slate-500/10 dark:bg-slate-400/5',
            text: 'text-slate-600 dark:text-slate-400 border-slate-500/20',
            label: 'Closed',
        },
    };

    const current = configs[status] || configs.open;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                current.bg,
                current.text,
                className
            )}
        >
            {status === 'resolved' ? (
                <CheckCircle2 className="w-3 h-3" />
            ) : (
                <Clock className="w-3 h-3" />
            )}
            {current.label}
        </span>
    );
}

// ==========================================
// 3. FILE SIZE FORMATTER
// ==========================================
export function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ==========================================
// 4. ATTACHMENT PREVIEW WIDGET
// ==========================================
interface AttachmentPreviewProps {
    file: { url: string; fileName: string; fileType: string; fileSize?: number };
    onDelete?: () => void;
    className?: string;
}

export function AttachmentPreview({ file, onDelete, className }: AttachmentPreviewProps) {
    const isImage = file.fileType.startsWith('image/');

    return (
        <div
            className={cn(
                'relative flex items-center gap-2 p-2 rounded-lg border border-border bg-card/65 hover:bg-card max-w-sm',
                className
            )}
        >
            <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center border">
                {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={file.url}
                        alt={file.fileName}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <FileText className="w-5 h-5 text-muted-foreground" />
                )}
            </div>
            <div className="flex-1 min-w-0 pr-4">
                <p className="text-xs font-medium text-foreground truncate">{file.fileName}</p>
                {file.fileSize && (
                    <p className="text-[10px] text-muted-foreground">{formatBytes(file.fileSize)}</p>
                )}
            </div>
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 shadow-md transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

// ==========================================
// 5. ANIMATED TYPING INDICATOR
// ==========================================
export function TypingIndicator({ label }: { label?: string }) {
    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-1.5 rounded-2xl bg-muted/40 max-w-[150px]">
            <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                    <motion.span
                        key={i}
                        className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full"
                        animate={{ y: [0, -3, 0] }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: 'easeInOut',
                        }}
                    />
                ))}
            </div>
            {label && <span className="truncate">{label}</span>}
        </div>
    );
}

// ==========================================
// 6. SOUND NOTIFICATIONS TOGGLE
// ==========================================
export function SoundToggle() {
    const { soundEnabled, toggleSound } = useSupportStore();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            title={soundEnabled ? 'Disable incoming message sound' : 'Enable incoming message sound'}
        >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
    );
}

// ==========================================
// 7. EMPTY SUPPORT STATE
// ==========================================
interface EmptySupportStateProps {
    title: string;
    description: string;
    action?: React.ReactNode;
}

export function EmptySupportState({ title, description, action }: EmptySupportStateProps) {
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed bg-card/25 max-w-md mx-auto my-6">
            <div className="p-3 rounded-full bg-muted/60 mb-3 border">
                <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">{description}</p>
            {action}
        </div>
    );
}

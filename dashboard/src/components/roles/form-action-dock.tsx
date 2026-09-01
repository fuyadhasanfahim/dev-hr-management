'use client';

import type { ReactNode } from 'react';
import { Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FormActionDockProps {
    saving: boolean;
    onSave: () => void;
    /** Omit to hide the Cancel button (e.g. embedded views). */
    onCancel?: () => void;
    /** Highlights the dock + shows the "Unsaved" marker. Omit if a form has no
     *  meaningful clean/dirty distinction (e.g. a create form). */
    dirty?: boolean;
    /** Extra gate on the Save button on top of `saving` / `dirty`. */
    canSave?: boolean;
    saveLabel?: string;
    cancelLabel?: string;
    /** Left-hand status content (counts, hints…). */
    status?: ReactNode;
}

/**
 * Shared floating action dock — a rounded, elevated pill that sticks to the
 * bottom of a form. Click-through on the empty sides. Used by the role /
 * department / designation / per-user permission editors.
 */
export function FormActionDock({
    saving,
    onSave,
    onCancel,
    dirty,
    canSave = true,
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    status,
}: FormActionDockProps) {
    const saveDisabled = saving || !canSave || dirty === false;

    return (
        <div className="pointer-events-none sticky bottom-4 z-10 flex justify-center pt-2">
            <div
                className={cn(
                    'pointer-events-auto flex items-center gap-2.5 rounded-full border bg-background/80 py-1.5 pl-4 pr-1.5 shadow-lg shadow-black/5 backdrop-blur-md transition-colors',
                    dirty ? 'border-primary/40' : 'border-border',
                )}
            >
                {status && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                        {status}
                    </span>
                )}

                {dirty && (
                    <span className="flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-amber-600 dark:text-amber-500">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                        Unsaved
                    </span>
                )}

                {(status || dirty) && <span className="h-5 w-px bg-border" />}

                <div className="flex items-center gap-1">
                    {onCancel && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full"
                            onClick={onCancel}
                            disabled={saving}
                        >
                            {cancelLabel}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        className="h-8 rounded-full px-4"
                        onClick={onSave}
                        disabled={saveDisabled}
                    >
                        {saving && <Loader className="h-3.5 w-3.5 animate-spin" />}
                        {saveLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

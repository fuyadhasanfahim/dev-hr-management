'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface DialogContentProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    contentClassName?: string;
    showCloseButton?: boolean;
}

export function DialogContentComponent({
    isOpen,
    onClose,
    title,
    description,
    children,
    footer,
    className,
    contentClassName,
    showCloseButton = true,
}: DialogContentProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={showCloseButton}
                className={cn(
                    'p-0 flex flex-col max-h-[85vh] h-auto overflow-hidden sm:max-w-lg md:max-w-xl gap-0 rounded-2xl border-border/80 shadow-2xl',
                    className
                )}
            >
                {/* Header */}
                <div className="p-5 sm:px-6 flex items-start justify-between gap-4 shrink-0 bg-card">
                    <DialogHeader className="space-y-1 text-left">
                        <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                            {title}
                        </DialogTitle>
                        {description && (
                            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                                {description}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                </div>

                {/* Top Separator */}
                <Separator className="shrink-0" />

                {/* Scrollable Body with Shadcn ScrollArea */}
                <ScrollArea className="flex-1 w-full max-h-[calc(85vh-130px)] min-h-[120px]">
                    <div className={cn('p-5 sm:p-6', contentClassName)}>
                        {children}
                    </div>
                    <ScrollBar orientation="vertical" />
                </ScrollArea>

                {/* Footer with Bottom Separator */}
                {footer && (
                    <>
                        <Separator className="shrink-0" />
                        <DialogFooter className="p-4 sm:px-6 bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0">
                            {footer}
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

export { DialogContentComponent as DialogContent };

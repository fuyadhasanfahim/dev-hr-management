'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface SharedDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    title?: React.ReactNode;
    description?: React.ReactNode;
    headerExtra?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    contentClassName?: string;
    showCloseButton?: boolean;
    headerClassName?: string;
    footerClassName?: string;
    scrollAreaClassName?: string;
}

/**
 * SharedDialog
 * A reusable, standardized dialog component built on Shadcn UI.
 * Features:
 * - Strict 85vh max-height flex-col structure with pinned Header and Footer
 * - Built-in Shadcn UI ScrollArea with vertical ScrollBar for smooth scrolling
 * - Shadcn UI Separators (splitters) positioned cleanly above & below the content
 */
export function SharedDialog({
    open,
    onOpenChange,
    trigger,
    title,
    description,
    headerExtra,
    children,
    footer,
    className,
    contentClassName,
    showCloseButton = true,
    headerClassName,
    footerClassName,
    scrollAreaClassName,
}: SharedDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

            <DialogContent
                showCloseButton={showCloseButton}
                className={cn(
                    '!flex !flex-col max-h-[85vh] h-auto overflow-hidden p-0 gap-0 sm:max-w-xl md:max-w-2xl rounded-2xl border-border/80 shadow-2xl min-h-0',
                    className
                )}
            >
                {/* Fixed Dialog Header */}
                {(title || description || headerExtra) && (
                    <div className="shrink-0 flex flex-col">
                        <div
                            className={cn(
                                'p-5 sm:px-6 flex items-start justify-between gap-4 bg-card',
                                headerClassName
                            )}
                        >
                            <DialogHeader className="space-y-1 text-left">
                                {title && (
                                    <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                                        {title}
                                    </DialogTitle>
                                )}
                                {description && (
                                    <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                                        {description}
                                    </DialogDescription>
                                )}
                            </DialogHeader>
                            {headerExtra && (
                                <div className="shrink-0">{headerExtra}</div>
                            )}
                        </div>

                        {/* Top Separator / Splitter */}
                        <Separator className="shrink-0" />
                    </div>
                )}

                {/* Scrollable Body Content with Shadcn ScrollArea */}
                <ScrollArea
                    className={cn(
                        'flex-1 min-h-0 w-full overflow-y-auto',
                        scrollAreaClassName
                    )}
                >
                    <div className={cn('p-5 sm:p-6', contentClassName)}>
                        {children}
                    </div>
                    <ScrollBar orientation="vertical" />
                </ScrollArea>

                {/* Fixed Dialog Footer with Bottom Separator */}
                {footer && (
                    <div className="shrink-0 flex flex-col">
                        {/* Bottom Separator / Splitter */}
                        <Separator className="shrink-0" />

                        <DialogFooter
                            className={cn(
                                'p-4 sm:px-6 bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2',
                                footerClassName
                            )}
                        >
                            {footer}
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Composable Primitives for custom dialog setups
 */
export function ScrollableDialogContent({
    children,
    className,
    showCloseButton = true,
    ...props
}: React.ComponentProps<typeof DialogContent>) {
    return (
        <DialogContent
            showCloseButton={showCloseButton}
            className={cn(
                '!flex !flex-col max-h-[85vh] h-auto overflow-hidden p-0 gap-0 sm:max-w-xl md:max-w-2xl rounded-2xl border-border/80 shadow-2xl min-h-0',
                className
            )}
            {...props}
        >
            {children}
        </DialogContent>
    );
}

export function ScrollableDialogHeader({
    title,
    description,
    children,
    className,
}: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className="shrink-0 flex flex-col">
            <div
                className={cn(
                    'p-5 sm:px-6 flex items-start justify-between gap-4 bg-card',
                    className
                )}
            >
                <DialogHeader className="space-y-1 text-left">
                    {title && (
                        <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                            {title}
                        </DialogTitle>
                    )}
                    {description && (
                        <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                            {description}
                        </DialogDescription>
                    )}
                    {children}
                </DialogHeader>
            </div>
            <Separator className="shrink-0" />
        </div>
    );
}

export function ScrollableDialogBody({
    children,
    className,
    scrollAreaClassName,
}: {
    children: React.ReactNode;
    className?: string;
    scrollAreaClassName?: string;
}) {
    return (
        <ScrollArea
            className={cn(
                'flex-1 min-h-0 w-full overflow-y-auto',
                scrollAreaClassName
            )}
        >
            <div className={cn('p-5 sm:p-6', className)}>{children}</div>
            <ScrollBar orientation="vertical" />
        </ScrollArea>
    );
}

export function ScrollableDialogFooter({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className="shrink-0 flex flex-col">
            <Separator className="shrink-0" />
            <DialogFooter
                className={cn(
                    'p-4 sm:px-6 bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2',
                    className
                )}
            >
                {children}
            </DialogFooter>
        </div>
    );
}

export {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
};

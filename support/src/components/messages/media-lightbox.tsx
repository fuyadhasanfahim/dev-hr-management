'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { mediaUrl, type WhatsAppMessage } from '@/store/api/whatsappApi';

/** Full-screen viewer for a set of photos/videos, with ←/→ navigation. Key it by what opened it so it starts on `index`. */
export function MediaLightbox({
    items,
    index,
    onClose,
}: {
    items: WhatsAppMessage[];
    index: number | null;
    onClose: () => void;
}) {
    const [current, setCurrent] = useState(index ?? 0);
    const [direction, setDirection] = useState(0);

    const go = (delta: number) => {
        setDirection(delta);
        setCurrent((i) => (i + delta + items.length) % items.length);
    };

    const item = items[current];
    const open = index !== null && !!item;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="max-w-[min(92vw,1100px)] border-none bg-black/95 p-0 text-white sm:max-w-[min(92vw,1100px)]"
                onKeyDown={(e) => {
                    if (items.length < 2) return;
                    if (e.key === 'ArrowRight') go(1);
                    if (e.key === 'ArrowLeft') go(-1);
                }}
            >
                <DialogTitle className="sr-only">Media viewer</DialogTitle>
                <DialogDescription className="sr-only">
                    {items.length > 1 ? `Item ${current + 1} of ${items.length}` : 'Attachment'}
                </DialogDescription>
                {item && (
                    <div className="relative flex h-[82vh] items-center justify-center overflow-hidden">
                        <AnimatePresence initial={false} custom={direction} mode="popLayout">
                            <motion.div
                                key={item.id}
                                custom={direction}
                                initial={{ opacity: 0, x: direction * 60 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: direction * -60 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                                className="flex size-full items-center justify-center p-10"
                            >
                                {item.type === 'video' ? (
                                    <video src={mediaUrl(item)} controls autoPlay className="max-h-full max-w-full rounded-lg" />
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element -- streamed from our API
                                    <img src={mediaUrl(item)} alt={item.body || 'Photo'} className="max-h-full max-w-full rounded-lg object-contain" />
                                )}
                            </motion.div>
                        </AnimatePresence>

                        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
                            <span className="text-sm text-white/80 tabular-nums">
                                {items.length > 1 && `${current + 1} / ${items.length}`}
                            </span>
                            <div className="flex items-center gap-1">
                                <a
                                    href={mediaUrl(item)}
                                    download={item.media?.filename}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Download"
                                    className="flex size-9 items-center justify-center rounded-full hover:bg-white/15"
                                >
                                    <Download className="size-4" />
                                </a>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="flex size-9 items-center justify-center rounded-full hover:bg-white/15"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                        </div>

                        {items.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => go(-1)}
                                    aria-label="Previous"
                                    className="absolute left-3 flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"
                                >
                                    <ChevronLeft className="size-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => go(1)}
                                    aria-label="Next"
                                    className="absolute right-3 flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"
                                >
                                    <ChevronRight className="size-5" />
                                </button>
                            </>
                        )}

                        {item.body && (
                            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-6 pt-8 pb-4 text-center text-sm whitespace-pre-wrap">
                                {item.body}
                            </p>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

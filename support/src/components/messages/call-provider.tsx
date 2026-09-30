'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { connectSocket, onSocketEvent } from '@/lib/socket';
import {
    useAcceptWhatsAppCallMutation,
    useEndWhatsAppCallMutation,
    useRejectWhatsAppCallMutation,
    useRequestWhatsAppCallPermissionMutation,
    useStartWhatsAppCallMutation,
} from '@/store/api/whatsappApi';

type Phase = 'incoming' | 'connecting' | 'ringing' | 'active';

interface CallState {
    callId: string | null; // null while an outbound call is still being placed
    conversationId: string;
    name: string;
    direction: 'inbound' | 'outbound';
    phase: Phase;
    answeredAt?: number;
    muted: boolean;
    error?: string;
}

interface CallContextValue {
    call: CallState | null;
    startCall: (conversation: { id: string; name: string }) => void;
}

const CallContext = createContext<CallContextValue>({ call: null, startCall: () => {} });
export const useCall = () => useContext(CallContext);

// Meta's side is ICE-lite and doesn't trickle: the SDP we hand over must
// already carry our candidates, so wait for gathering (capped, in case a
// STUN-less network never reports "complete").
function waitForIce(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
        const done = () => {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
        };
        const check = () => pc.iceGatheringState === 'complete' && done();
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(done, 3000);
    });
}

function useElapsed(since?: number): string {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!since) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [since]);
    if (!since) return '0:00';
    const s = Math.max(0, Math.floor((now - since) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Socket events that can beat the "call placed" HTTP response for an outbound call.
interface EarlyEvents {
    sdp?: string;
    status?: string;
    ended?: boolean;
}

export function CallProvider({ children }: { children: ReactNode }) {
    const [call, setCall] = useState<CallState | null>(null);
    const [permissionFor, setPermissionFor] = useState<{ id: string; name: string; canRequest: boolean } | null>(null);
    const callRef = useRef<CallState | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const micRef = useRef<MediaStream | null>(null);
    const offerRef = useRef<string | null>(null); // Incoming call's SDP offer, until accepted.
    const earlyRef = useRef(new Map<string, EarlyEvents>());
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const ringRef = useRef<HTMLAudioElement | null>(null);

    const [startCallApi] = useStartWhatsAppCallMutation();
    const [acceptCallApi] = useAcceptWhatsAppCallMutation();
    const [rejectCallApi] = useRejectWhatsAppCallMutation();
    const [endCallApi] = useEndWhatsAppCallMutation();
    const [requestPermission, { isLoading: requestingPermission }] = useRequestWhatsAppCallPermissionMutation();

    const update = useCallback((next: CallState | null | ((prev: CallState | null) => CallState | null)) => {
        setCall((prev) => {
            const value = typeof next === 'function' ? next(prev) : next;
            callRef.current = value;
            return value;
        });
    }, []);

    const cleanup = useCallback(() => {
        ringRef.current?.pause();
        pcRef.current?.close();
        pcRef.current = null;
        micRef.current?.getTracks().forEach((t) => t.stop());
        micRef.current = null;
        offerRef.current = null;
        earlyRef.current.clear();
        update(null);
    }, [update]);

    const openPeer = useCallback(async () => {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        micRef.current = mic;
        const pc = new RTCPeerConnection();
        pcRef.current = pc;
        mic.getTracks().forEach((t) => pc.addTrack(t, mic));
        pc.ontrack = (e) => {
            if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        };
        return pc;
    }, []);

    const applyStatus = useCallback(
        (status: string) => {
            if (status === 'ringing') update((c) => c && { ...c, phase: 'ringing' });
            if (status === 'accepted') update((c) => c && { ...c, phase: 'active', answeredAt: Date.now() });
        },
        [update],
    );

    // ── Socket: incoming calls + outbound call progress ───────────────────────
    useEffect(() => {
        connectSocket();
        ringRef.current = new Audio('/sounds/notification.wav');
        ringRef.current.loop = true;

        const offs = [
            onSocketEvent('whatsapp:call_incoming', (p: { callId: string; conversationId: string; name: string; sdp?: string }) => {
                if (callRef.current || !p.sdp) return; // Busy — the other agents can take it.
                offerRef.current = p.sdp;
                update({ callId: p.callId, conversationId: p.conversationId, name: p.name, direction: 'inbound', phase: 'incoming', muted: false });
                ringRef.current?.play().catch(() => {});
            }),
            // Another agent picked it up: stop ringing here.
            onSocketEvent('whatsapp:call_claimed', ({ callId }: { callId: string }) => {
                const c = callRef.current;
                if (c?.callId === callId && c.phase === 'incoming') cleanup();
            }),
            onSocketEvent('whatsapp:call_answer', ({ callId, sdp }: { callId: string; sdp: string }) => {
                const c = callRef.current;
                if (c?.direction !== 'outbound') return;
                if (c.callId === callId) void pcRef.current?.setRemoteDescription({ type: 'answer', sdp });
                else if (!c.callId) earlyRef.current.set(callId, { ...earlyRef.current.get(callId), sdp });
            }),
            onSocketEvent('whatsapp:call_status', ({ callId, status }: { callId: string; status: string }) => {
                const c = callRef.current;
                if (c?.callId === callId) applyStatus(status);
                else if (c && !c.callId) earlyRef.current.set(callId, { ...earlyRef.current.get(callId), status });
            }),
            onSocketEvent('whatsapp:call_ended', ({ callId }: { callId: string }) => {
                const c = callRef.current;
                if (c?.callId === callId) cleanup();
                else if (c && !c.callId) earlyRef.current.set(callId, { ...earlyRef.current.get(callId), ended: true });
            }),
        ];
        return () => offs.forEach((off) => off());
    }, [update, cleanup, applyStatus]);

    // ── Agent actions ─────────────────────────────────────────────────────────
    const startCall = useCallback(
        async (conversation: { id: string; name: string }) => {
            if (callRef.current) return;
            update({ callId: null, conversationId: conversation.id, name: conversation.name, direction: 'outbound', phase: 'connecting', muted: false });
            try {
                const pc = await openPeer();
                await pc.setLocalDescription(await pc.createOffer());
                await waitForIce(pc);
                const { callId } = await startCallApi({ conversationId: conversation.id, sdp: pc.localDescription!.sdp }).unwrap();

                const early = earlyRef.current.get(callId);
                earlyRef.current.clear();
                if (early?.ended) return cleanup();
                update((c) => c && { ...c, callId, phase: 'ringing' });
                if (early?.sdp) await pc.setRemoteDescription({ type: 'answer', sdp: early.sdp });
                if (early?.status) applyStatus(early.status);
            } catch (err) {
                cleanup();
                const data = (err as { data?: { code?: string; canRequest?: boolean; message?: string } }).data;
                if (data?.code === 'NO_PERMISSION') {
                    setPermissionFor({ ...conversation, canRequest: !!data.canRequest });
                } else {
                    const message = data?.message ?? (err instanceof Error ? err.message : 'Could not start the call');
                    window.alert(message);
                }
            }
        },
        [update, openPeer, startCallApi, cleanup, applyStatus],
    );

    const accept = async () => {
        const c = callRef.current;
        const offer = offerRef.current;
        if (!c?.callId || !offer) return;
        ringRef.current?.pause();
        update({ ...c, phase: 'connecting' });
        try {
            const pc = await openPeer();
            await pc.setRemoteDescription({ type: 'offer', sdp: offer });
            await pc.setLocalDescription(await pc.createAnswer());
            await waitForIce(pc);
            await acceptCallApi({ callId: c.callId, sdp: pc.localDescription!.sdp }).unwrap();
            update((cur) => cur && { ...cur, phase: 'active', answeredAt: Date.now() });
        } catch (err) {
            const message = (err as { data?: { message?: string } }).data?.message;
            cleanup();
            if (message) window.alert(message);
        }
    };

    const decline = () => {
        const c = callRef.current;
        if (c?.callId) void rejectCallApi(c.callId);
        cleanup();
    };

    const hangUp = () => {
        const c = callRef.current;
        if (c?.callId) void endCallApi(c.callId);
        cleanup();
    };

    const toggleMute = () => {
        const muted = !callRef.current?.muted;
        micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
        update((c) => c && { ...c, muted });
    };

    const elapsed = useElapsed(call?.answeredAt);
    const statusText =
        call?.phase === 'incoming'
            ? 'Incoming WhatsApp voice call'
            : call?.phase === 'connecting'
              ? 'Connecting…'
              : call?.phase === 'ringing'
                ? 'Ringing…'
                : elapsed;

    return (
        <CallContext.Provider value={{ call, startCall: (c) => void startCall(c) }}>
            {children}
            <audio ref={remoteAudioRef} autoPlay />

            <AnimatePresence>
                {call && (
                    <motion.div
                        role="dialog"
                        aria-label={`Call with ${call.name}`}
                        initial={{ opacity: 0, y: 24, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="fixed right-4 bottom-4 z-50 w-72 rounded-2xl border bg-popover p-4 shadow-2xl"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                {call.phase !== 'active' && (
                                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                                )}
                                <Avatar className="relative size-11">
                                    <AvatarFallback>{call.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{call.name}</p>
                                <p className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                                    {call.phase === 'connecting' && <Loader2 className="size-3 animate-spin" />}
                                    {statusText}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-center gap-3">
                            {call.phase === 'incoming' ? (
                                <>
                                    <Button size="icon" variant="destructive" className="size-11 rounded-full" onClick={decline} aria-label="Decline">
                                        <PhoneOff className="size-5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        className="size-11 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                                        onClick={() => void accept()}
                                        aria-label="Accept"
                                    >
                                        <Phone className="size-5" />
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        size="icon"
                                        variant={call.muted ? 'default' : 'outline'}
                                        className="size-11 rounded-full"
                                        onClick={toggleMute}
                                        aria-label={call.muted ? 'Unmute' : 'Mute'}
                                        aria-pressed={call.muted}
                                    >
                                        {call.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                                    </Button>
                                    <Button size="icon" variant="destructive" className="size-11 rounded-full" onClick={hangUp} aria-label="Hang up">
                                        <PhoneOff className="size-5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* WhatsApp only lets a business call users who opted in. */}
            <AlertDialog open={!!permissionFor} onOpenChange={(open) => !open && setPermissionFor(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Can’t call {permissionFor?.name} yet</AlertDialogTitle>
                        <AlertDialogDescription>
                            {permissionFor?.canRequest
                                ? 'WhatsApp needs the customer to allow calls first. Send them a request? They’ll get an “Allow calls” button in the chat.'
                                : 'The customer hasn’t allowed calls, and WhatsApp’s limit on permission requests (1 a day, 2 a week) is used up. Ask them to call you instead.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Close</AlertDialogCancel>
                        {permissionFor?.canRequest && (
                            <AlertDialogAction
                                disabled={requestingPermission}
                                onClick={() => {
                                    if (permissionFor) void requestPermission(permissionFor.id);
                                }}
                            >
                                Send request
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CallContext.Provider>
    );
}

'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Mic, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const BARS = 36;

function formatSeconds(total: number): string {
    const s = Math.max(0, Math.floor(total));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Recording ───────────────────────────────────────────────────────────────

// Opus is what WhatsApp voice notes use; the server re-encodes whatever
// container the browser gives us (WebM on Chrome, MP4 on Safari) to OGG.
const RECORDER_TYPES = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'];
const LIVE_BARS = 48;

export function useVoiceRecorder() {
    const recorderRef = useRef<MediaRecorder | null>(null);
    const stopMeterRef = useRef<(() => void) | null>(null);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    // Mic loudness samples (0..1), newest last — drives the live waveform.
    const [levels, setLevels] = useState<number[]>([]);

    useEffect(() => {
        if (!startedAt) return;
        const id = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(id);
    }, [startedAt]);

    // Release the mic if the agent leaves the page mid-recording.
    useEffect(
        () => () => {
            stopMeterRef.current?.();
            recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        },
        [],
    );

    // Samples the mic's RMS level ~12 times a second so the agent can see
    // they're actually being heard.
    const startMeter = (stream: MediaStream) => {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const id = setInterval(() => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (const v of buf) sum += ((v - 128) / 128) ** 2;
            const rms = Math.sqrt(sum / buf.length);
            setLevels((prev) => [...prev.slice(-(LIVE_BARS - 1)), Math.min(1, rms * 4)]);
        }, 80);
        stopMeterRef.current = () => {
            clearInterval(id);
            void ctx.close();
        };
    };

    const start = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.start();
        recorderRef.current = recorder;
        setLevels([]);
        startMeter(stream);
        setStartedAt(Date.now());
        setNow(Date.now());
    };

    // Resolves with the recording, or null when cancelled.
    const finish = (keep: boolean) =>
        new Promise<Blob | null>((resolve) => {
            const recorder = recorderRef.current;
            recorderRef.current = null;
            stopMeterRef.current?.();
            stopMeterRef.current = null;
            setStartedAt(null);
            if (!recorder) return resolve(null);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                recorder.stream.getTracks().forEach((t) => t.stop());
                resolve(keep ? new Blob(chunks, { type: recorder.mimeType }) : null);
            };
            recorder.stop();
        });

    return {
        recording: startedAt !== null,
        elapsed: formatSeconds(startedAt ? (now - startedAt) / 1000 : 0),
        levels,
        start,
        stop: () => finish(true),
        cancel: () => void finish(false),
    };
}

/** Scrolling live waveform shown while recording. */
export function LiveWaveform({ levels }: { levels: number[] }) {
    const padded = [...Array(Math.max(0, LIVE_BARS - levels.length)).fill(0), ...levels];
    return (
        <div className="flex h-7 flex-1 items-center justify-end gap-[3px] overflow-hidden" aria-hidden>
            {padded.map((level, i) => (
                <span
                    key={i}
                    className="w-[3px] shrink-0 rounded-full bg-primary transition-[height] duration-75"
                    style={{ height: `${Math.max(12, level * 100)}%`, opacity: level ? 1 : 0.25 }}
                />
            ))}
        </div>
    );
}

// ── Playback ────────────────────────────────────────────────────────────────

interface Waveform {
    peaks: number[];
    duration: number;
}

// Decoded waveforms, by URL — a thread re-render must not re-download audio.
const waveformCache = new Map<string, Promise<Waveform>>();

function loadWaveform(src: string): Promise<Waveform> {
    let cached = waveformCache.get(src);
    if (!cached) {
        cached = (async () => {
            const res = await fetch(src, { credentials: 'include' });
            const ctx = new AudioContext();
            try {
                const audio = await ctx.decodeAudioData(await res.arrayBuffer());
                const data = audio.getChannelData(0);
                const size = Math.floor(data.length / BARS) || 1;
                const peaks = Array.from({ length: BARS }, (_, i) => {
                    let sum = 0;
                    for (let j = i * size; j < (i + 1) * size && j < data.length; j++) sum += data[j]! ** 2;
                    return Math.sqrt(sum / size);
                });
                const max = Math.max(...peaks, 0.01);
                return { peaks: peaks.map((p) => p / max), duration: audio.duration };
            } finally {
                void ctx.close();
            }
        })();
        cached.catch(() => waveformCache.delete(src));
        waveformCache.set(src, cached);
    }
    return cached;
}

// Flat placeholder while decoding (or if the browser can't decode the codec).
const FLAT = Array.from({ length: BARS }, (_, i) => 0.25 + 0.15 * Math.sin(i * 1.3));

/** WhatsApp-style voice note: play button, tappable waveform, time. */
export function VoicePlayer({ src, isMe, voice }: { src: string; isMe: boolean; voice?: boolean }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [wave, setWave] = useState<Waveform | null>(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [metaDuration, setMetaDuration] = useState(0); // From <audio> metadata, before decoding finishes.

    useEffect(() => {
        let alive = true;
        loadWaveform(src)
            .then((w) => alive && setWave(w))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [src]);

    const duration = wave?.duration || metaDuration;
    const progress = duration ? current / duration : 0;
    const peaks = wave?.peaks ?? FLAT;

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            // Only one voice note plays at a time, like WhatsApp.
            document.querySelectorAll<HTMLAudioElement>('audio[data-voice-note]').forEach((a) => a !== audio && a.pause());
            void audio.play();
        } else {
            audio.pause();
        }
    };

    const seek = (e: PointerEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        audio.currentTime = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * duration;
        setCurrent(audio.currentTime);
    };

    return (
        <div className="flex w-64 max-w-full items-center gap-2.5 px-1.5 py-1">
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                data-voice-note
                onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setMetaDuration(e.currentTarget.duration)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    setPlaying(false);
                    setCurrent(0);
                }}
                onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            />
            <button
                type="button"
                onClick={toggle}
                aria-label={playing ? 'Pause voice message' : 'Play voice message'}
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90',
                    isMe ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground',
                )}
            >
                {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 translate-x-px fill-current" />}
            </button>
            <div className="min-w-0 flex-1">
                <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Seek voice message"
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    aria-valuenow={Math.round(current)}
                    onPointerDown={seek}
                    onKeyDown={(e) => {
                        const audio = audioRef.current;
                        if (!audio) return;
                        if (e.key === 'ArrowRight') audio.currentTime = Math.min(duration, audio.currentTime + 5);
                        if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
                    }}
                    className="flex h-8 cursor-pointer items-center gap-[2px]"
                >
                    {peaks.map((p, i) => {
                        const played = i / peaks.length < progress;
                        return (
                            <span
                                key={i}
                                className={cn(
                                    'w-[3px] flex-1 rounded-full transition-colors',
                                    isMe
                                        ? played
                                            ? 'bg-primary-foreground'
                                            : 'bg-primary-foreground/40'
                                        : played
                                          ? 'bg-primary'
                                          : 'bg-foreground/25',
                                )}
                                style={{ height: `${Math.max(14, p * 100)}%` }}
                            />
                        );
                    })}
                </div>
                <div
                    className={cn(
                        'flex items-center gap-1 text-[10px] tabular-nums',
                        isMe ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                >
                    {voice && <Mic className="size-3" />}
                    {formatSeconds(playing || current ? current : duration)}
                </div>
            </div>
        </div>
    );
}

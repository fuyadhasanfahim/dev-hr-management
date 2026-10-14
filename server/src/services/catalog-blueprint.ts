import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/AppError.js';

/**
 * Quotation "blueprint": the defaults a service / package carries so the wizard can
 * pre-fill every step. Resolution is package → service (per top-level key).
 * Anything left out stays blank in the wizard — nothing is invented.
 */
type Doc = Record<string, any>;

const INCLUSION_KINDS = ['domain', 'hosting', 'support', 'other'] as const;

const num = (v: unknown): number | null => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
};
const text = (v: unknown) => String(v ?? '').trim();
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | '' => (list.includes(v as T) ? (v as T) : '');

export function sanitizeBlueprint(raw: unknown): Doc | null {
    if (raw === null) return null;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new AppError('blueprint must be an object', 400);
    const b = raw as Doc;
    const out: Doc = {};

    const design = oneOf(b.designMode, ['template', 'custom'] as const);
    if (design) out.designMode = design;

    if (Array.isArray(b.inclusions)) {
        out.inclusions = b.inclusions
            .map((i: Doc) => ({
                key: text(i?.key) || randomUUID(),
                label: text(i?.label),
                kind: oneOf(i?.kind, INCLUSION_KINDS) || 'other',
                included: i?.included !== false,
                termMonths: num(i?.termMonths),
                owner: oneOf(i?.owner, ['client', 'agency'] as const),
                // true → a renewal timer is created when the quotation becomes an order
                renews: Boolean(i?.renews),
                // price to add when this item is switched off (not included in the package)
                charge: num(i?.charge) ?? 0,
                note: text(i?.note),
            }))
            .filter((i: Doc) => i.label);
    }

    if (b.revisions && typeof b.revisions === 'object') {
        out.revisions = {
            ui: num(b.revisions.ui),
            dev: num(b.revisions.dev),
            uiExtraFee: num(b.revisions.uiExtraFee),
            devExtraFee: num(b.revisions.devExtraFee),
        };
    }

    if (Array.isArray(b.paymentMilestones)) {
        out.paymentMilestones = b.paymentMilestones
            .map((m: Doc) => ({ label: text(m?.label), percentage: num(m?.percentage) ?? 0, note: text(m?.note) }))
            .filter((m: Doc) => m.label);
    }

    if (b.policies && typeof b.policies === 'object') {
        const p = b.policies as Doc;
        out.policies = {
            graceDays: num(p.graceDays),
            suspendDays: num(p.suspendDays),
            cancelNoticeDays: num(p.cancelNoticeDays),
            extraFeatureRate: num(p.extraFeatureRate),
            hourlyRate: num(p.hourlyRate),
            validityDays: num(p.validityDays),
            ownership: oneOf(p.ownership, ['client', 'portfolio', 'custom'] as const),
        };
    }
    return out;
}

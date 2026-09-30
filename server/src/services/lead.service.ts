import LeadModel from '../models/lead.model.js';
import LeadActivityModel from '../models/lead-activity.model.js';
import type { ILead, ILeadActivity, LeadQueryParams } from '../types/lead.type.js';
import ClientModel from '../models/client.model.js';
import mongoose, { Types } from 'mongoose';
import LeadSettingModel from '../models/lead-setting.model.js';
import { escapeRegex } from '../lib/sanitize.js';
import { logger } from '../lib/logger.js';

// User fields shown for "created by" / "updated by" / activity authors.
const PERSON_FIELDS = 'name email firstName lastName';

class DuplicatePhoneError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DuplicatePhoneError';
    }
}

const getAllLeads = async (params: LeadQueryParams) => {
    const {
        page = 1,
        limit = 10,
        search,
        status,
        priority,
        source,
        isConverted,
        assignedTo,
        nextActionType,
        nextActionDateFrom,
        nextActionDateTo,
        createdBy,
        updatedBy,
    } = params;

    const query: Record<string, any> = {};

    if (search) {
        const escaped = escapeRegex(search);
        query.$or = [
            { name: { $regex: escaped, $options: 'i' } },
            { phone: { $regex: escaped, $options: 'i' } },
            { email: { $regex: escaped, $options: 'i' } },
        ];
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (source) query.source = source;
    if (assignedTo) query.assignedTo = assignedTo;
    if (isConverted !== undefined) query.isConverted = isConverted;
    if (nextActionType) query.nextActionType = nextActionType;
    // 'automated' = no person (system-created / never edited by a person).
    const byPerson = (v?: string) => (v === 'automated' ? null : Types.ObjectId.isValid(v ?? '') ? new Types.ObjectId(v) : undefined);
    const createdByValue = byPerson(createdBy);
    const updatedByValue = byPerson(updatedBy);
    if (createdByValue !== undefined) query.createdBy = createdByValue;
    if (updatedByValue !== undefined) query.updatedBy = updatedByValue;

    // Date range filtering for nextActionDate
    if (nextActionDateFrom || nextActionDateTo) {
        query.nextActionDate = {};
        if (nextActionDateFrom) {
            query.nextActionDate.$gte = new Date(nextActionDateFrom as string);
        }
        if (nextActionDateTo) {
            // Set to end of day for inclusive filtering
            const toDate = new Date(nextActionDateTo as string);
            toDate.setHours(23, 59, 59, 999);
            query.nextActionDate.$lte = toDate;
        }
    }

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
        LeadModel.find(query)
            .populate('status')
            .populate('source')
            .populate('nextActionType')
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', PERSON_FIELDS)
            .populate('updatedBy', PERSON_FIELDS)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        LeadModel.countDocuments(query),
    ]);

    return {
        leads,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
};

const getLeadPeople = async () => {
    const [creators, updaters] = await Promise.all([
        LeadModel.distinct('createdBy', { createdBy: { $ne: null } }),
        LeadModel.distinct('updatedBy', { updatedBy: { $ne: null } }),
    ]);
    const ids = [...new Set([...creators, ...updaters].map(String))];
    if (!ids.length) return [];
    const users = await mongoose.connection
        .collection('user')
        .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }, { projection: { name: 1, email: 1 } })
        .toArray();
    return users
        .map((u) => ({ id: u._id.toString(), name: (u.name as string) || (u.email as string) || 'Unknown user' }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

const getLeadById = async (id: string) => {
    const lead = await LeadModel.findById(id)
        .populate('status')
        .populate('source')
        .populate('nextActionType')
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', PERSON_FIELDS)
        .populate('updatedBy', PERSON_FIELDS)
        .lean();

    if (!lead) return null;

    const activities = await LeadActivityModel.find({ leadId: id })
        .populate('previousStatus')
        .populate('newStatus')
        .populate('nextActionType')
        .populate('createdBy', PERSON_FIELDS)
        .sort({ createdAt: -1 })
        .lean();

    return { lead, activities };
};

const createLead = async (data: Partial<ILead>, createdBy: string) => {
    // Check duplicate phone
    if (data.phone) {
        const existing = await LeadModel.findOne({ phone: data.phone });
        if (existing) {
            throw new DuplicatePhoneError('A lead with this phone number already exists.');
        }
    }

    const lead = new LeadModel({ ...data, createdBy, updatedBy: createdBy, origin: 'manual' });
    await lead.save();

    // Log creation activity
    await LeadActivityModel.create({
        leadId: lead._id,
        activityType: 'CREATED',
        notes: 'Lead created',
        createdBy,
    });

    return lead;
};

// Fields whose edits go into the lead's history. Status and notes get their
// own old → new columns; everything else is listed under `changes`.
const TRACKED_FIELDS = [
    'name',
    'phone',
    'email',
    'website',
    'source',
    'priority',
    'nextActionType',
    'nextActionDate',
    'assignedTo',
] as const;

const asText = (v: unknown): string | null => {
    if (v === undefined || v === null || v === '') return null;
    if (v instanceof Date) return v.toISOString();
    return String(v);
};

const updateLead = async (id: string, data: Partial<ILead>, updatedBy?: string) => {
    if (data.phone) {
        const existing = await LeadModel.findOne({ phone: data.phone, _id: { $ne: id } });
        if (existing) {
            throw new DuplicatePhoneError('A lead with this phone number already exists.');
        }
    }

    const before = await LeadModel.findById(id).lean();
    if (!before) return null;

    // Never let the client rewrite who created it or the audit fields.
    const { createdBy: _c, updatedBy: _u, origin: _o, ...changes } = data as Record<string, unknown>;
    const updated = await LeadModel.findByIdAndUpdate(id, { ...changes, updatedBy: updatedBy ?? null }, { new: true });

    const fieldChanges = TRACKED_FIELDS.filter((f) => f in changes && asText(changes[f]) !== asText((before as any)[f])).map(
        (f) => ({ field: f, from: asText((before as any)[f]), to: asText(changes[f]) }),
    );
    const statusChanged = 'status' in changes && asText(changes.status) !== asText(before.status);
    const notesChanged = 'currentNotes' in changes && asText(changes.currentNotes) !== asText(before.currentNotes);

    if (fieldChanges.length || statusChanged || notesChanged) {
        await LeadActivityModel.create({
            leadId: id,
            activityType: 'UPDATED',
            ...(statusChanged ? { previousStatus: before.status, newStatus: changes.status as Types.ObjectId } : {}),
            ...(notesChanged ? { previousNotes: before.currentNotes, notes: changes.currentNotes as string } : {}),
            changes: fieldChanges.length ? fieldChanges : undefined,
            createdBy: updatedBy ?? null,
        });
    }
    return updated;
};

const lastDigits = (phone: string, n = 10) => phone.replace(/\D/g, '').slice(-n);

/**
 * A brand-new WhatsApp contact becomes a lead automatically (createdBy null,
 * origin "whatsapp"). Matches existing leads on the last 10 digits, since
 * staff type phones in many formats. Never throws — a lead is a nice-to-have
 * next to the conversation itself.
 */
const createLeadFromWhatsApp = async (waPhone: string, name?: string) => {
    try {
        const tail = lastDigits(waPhone);
        const candidates = await LeadModel.find({ phone: { $regex: escapeRegex(tail.slice(-4)) } })
            .select('phone')
            .limit(50)
            .lean();
        if (candidates.some((c) => lastDigits(c.phone) === tail)) return null;

        const [source, status] = await Promise.all([
            LeadSettingModel.findOne({ type: 'SOURCE', name: { $regex: '^whats\\s*app$', $options: 'i' } }),
            LeadSettingModel.findOne({ type: 'STATUS', isDefault: true }),
        ]);
        const lead = await LeadModel.create({
            name: name?.trim() || undefined,
            phone: `+${waPhone.replace(/\D/g, '')}`,
            source: source?._id ?? (await LeadSettingModel.create({ type: 'SOURCE', name: 'WhatsApp', color: '#25D366' }))._id,
            ...(status ? { status: status._id } : {}),
            origin: 'whatsapp',
            createdBy: null,
            updatedBy: null,
        });
        await LeadActivityModel.create({
            leadId: lead._id,
            activityType: 'CREATED',
            ...(status ? { newStatus: status._id } : {}),
            notes: 'Lead created automatically from a new WhatsApp conversation',
            createdBy: null,
        });
        return lead;
    } catch (err: any) {
        logger.warn(`Auto-creating a lead for WhatsApp contact failed: ${err.message}`);
        return null;
    }
};

const PRIORITIES = ['High', 'Medium', 'Low'];

// `priority` / `source` ride along on an activity (the "Log activity" form can
// change them too); they aren't activity fields, so they're recorded as changes.
const addActivity = async (
    leadId: string,
    data: Partial<ILeadActivity> & { priority?: string; source?: string },
    createdBy: string,
) => {
    const lead = await LeadModel.findById(leadId);
    if (!lead) throw new Error('Lead not found');

    const { priority, source, changes: _ignored, ...activityData } = data;
    const changes: { field: string; from: string | null; to: string | null }[] = [];
    if (priority && PRIORITIES.includes(priority) && priority !== lead.priority) {
        changes.push({ field: 'priority', from: lead.priority ?? null, to: priority });
    }
    if (source && Types.ObjectId.isValid(source) && source !== lead.source?.toString()) {
        changes.push({ field: 'source', from: lead.source?.toString() ?? null, to: source });
    }

    // Snapshot what the lead looked like before, so the history reads old → new.
    const activity = new LeadActivityModel({
        ...activityData,
        ...(data.newStatus && !data.previousStatus && lead.status ? { previousStatus: lead.status } : {}),
        ...(data.notes && lead.currentNotes ? { previousNotes: lead.currentNotes } : {}),
        ...(changes.length ? { changes } : {}),
        leadId,
        createdBy,
    });
    await activity.save();

    // Update main lead if status or next action changed
    const updateData: Partial<ILead> = { updatedBy: new Types.ObjectId(createdBy) };
    for (const c of changes) {
        if (c.field === 'priority') updateData.priority = c.to as ILead['priority'];
        if (c.field === 'source') updateData.source = new Types.ObjectId(c.to!);
    }
    if (data.newStatus) updateData.status = data.newStatus as Types.ObjectId;
    if (data.nextActionType) updateData.nextActionType = data.nextActionType as Types.ObjectId;
    if (data.nextActionDate) updateData.nextActionDate = data.nextActionDate;
    if (data.notes) updateData.currentNotes = data.notes; // keep latest note handy

    if (Object.keys(updateData).length > 0) {
        await LeadModel.findByIdAndUpdate(leadId, updateData);
    }

    return activity;
};

const convertToClient = async (leadId: string, clientData: any, createdBy: string) => {
    const lead = await LeadModel.findById(leadId);
    if (!lead) throw new Error('Lead not found');
    if (lead.isConverted) throw new Error('Lead is already converted');

    // Create client
    const client = new ClientModel({
        ...clientData,
        createdBy,
    });
    await client.save();

    // Find a "converted" status if exists
    const convertedStatus = await LeadSettingModel.findOne({ type: 'STATUS', isConvertedStatus: true });

    // Update lead
    lead.isConverted = true;
    lead.convertedClientId = client._id as Types.ObjectId;
    lead.updatedBy = new Types.ObjectId(createdBy);
    if (convertedStatus) {
        lead.status = convertedStatus._id as Types.ObjectId;
    }
    await lead.save();

    // Add activity
    await LeadActivityModel.create({
        leadId,
        activityType: 'CONVERTED',
        ...(convertedStatus ? { newStatus: convertedStatus._id } : {}),
        notes: 'Lead successfully converted to Client',
        createdBy,
    });

    return client;
};

export default {
    getAllLeads,
    getLeadPeople,
    getLeadById,
    createLead,
    updateLead,
    addActivity,
    convertToClient,
    createLeadFromWhatsApp,
    DuplicatePhoneError,
};

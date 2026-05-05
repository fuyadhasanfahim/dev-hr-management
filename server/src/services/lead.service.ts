import LeadModel from '../models/lead.model.js';
import LeadActivityModel from '../models/lead-activity.model.js';
import type { ILead, ILeadActivity, LeadQueryParams } from '../types/lead.type.js';
import ClientModel from '../models/client.model.js';
import { Types } from 'mongoose';
import LeadSettingModel from '../models/lead-setting.model.js';

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
    } = params;

    const query: Record<string, any> = {};

    if (search) {
        query.$text = { $search: search };
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (source) query.source = source;
    if (assignedTo) query.assignedTo = assignedTo;
    if (isConverted !== undefined) query.isConverted = isConverted;

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
        LeadModel.find(query)
            .populate('status')
            .populate('source')
            .populate('nextActionType')
            .populate('assignedTo', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        LeadModel.countDocuments(query),
    ]);

    return {
        leads,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
};

const getLeadById = async (id: string) => {
    const lead = await LeadModel.findById(id)
        .populate('status')
        .populate('source')
        .populate('nextActionType')
        .populate('assignedTo', 'firstName lastName email');
    
    if (!lead) return null;

    const activities = await LeadActivityModel.find({ leadId: id })
        .populate('previousStatus')
        .populate('newStatus')
        .populate('nextActionType')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 });

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

    const lead = new LeadModel({ ...data, createdBy });
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

const updateLead = async (id: string, data: Partial<ILead>) => {
    if (data.phone) {
        const existing = await LeadModel.findOne({ phone: data.phone, _id: { $ne: id } });
        if (existing) {
            throw new DuplicatePhoneError('A lead with this phone number already exists.');
        }
    }
    return await LeadModel.findByIdAndUpdate(id, data, { new: true });
};

const addActivity = async (leadId: string, data: Partial<ILeadActivity>, createdBy: string) => {
    const lead = await LeadModel.findById(leadId);
    if (!lead) throw new Error('Lead not found');

    const activity = new LeadActivityModel({
        ...data,
        leadId,
        createdBy,
    });
    await activity.save();

    // Update main lead if status or next action changed
    const updateData: Partial<ILead> = {};
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
    getLeadById,
    createLead,
    updateLead,
    addActivity,
    convertToClient,
    DuplicatePhoneError,
};

import { Types } from 'mongoose';
import ClientModel from '../models/client.model.js';
import type { ClientQueryParams } from '../types/client.type.js';
import type {
    CreateClientInput,
    UpdateClientInput,
} from '../validators/client.validation.js';
import { escapeRegex } from '../lib/sanitize.js';

// Build match stage from query params
const buildMatchStage = (
    params: ClientQueryParams,
): Record<string, unknown> => {
    const conditions: Record<string, unknown>[] = [];

    if (params.search) {
        const escaped = escapeRegex(params.search);
        conditions.push({
            $or: [
                { name: { $regex: escaped, $options: 'i' } },
                { emails: { $regex: escaped, $options: 'i' } },
            ],
        });
    }

    if (params.status) {
        conditions.push({ status: params.status });
    }

    // Ownership filter: restrict to clients created by or assigned to a specific user
    if (params.createdBy) {
        const userId = new Types.ObjectId(params.createdBy);
        conditions.push({
            $or: [
                { createdBy: userId },
                { assignedTelemarketer: userId },
            ],
        });
    }

    if (params.assignedTelemarketer) {
        conditions.push({
            assignedTelemarketer: new Types.ObjectId(params.assignedTelemarketer),
        });
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0] || {};
    return { $and: conditions };
};

// Get all clients with pagination and filtering
const getAllClientsFromDB = async (params: ClientQueryParams) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const sortField = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
    const sortStage: Record<string, 1 | -1> = { [sortField]: sortOrder };

    const matchStage = buildMatchStage(params);

    const pipeline: any[] = [{ $match: matchStage }];

    pipeline.push(
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limit },
        {
            $lookup: {
                from: 'user',
                localField: 'createdBy',
                foreignField: '_id',
                as: 'createdBy',
            },
        },
        {
            $unwind: {
                path: '$createdBy',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: 'user',
                localField: 'assignedTelemarketer',
                foreignField: '_id',
                as: 'assignedTelemarketer',
            },
        },
        {
            $unwind: {
                path: '$assignedTelemarketer',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                'createdBy.password': 0,
                'createdBy.passwordHistory': 0,
                'assignedTelemarketer.password': 0,
                'assignedTelemarketer.passwordHistory': 0,
            },
        },
    );

    const [clients, countResult] = await Promise.all([
        ClientModel.aggregate(pipeline),
        ClientModel.countDocuments(matchStage),
    ]);

    return {
        clients,
        pagination: {
            page,
            limit,
            total: countResult,
            pages: Math.ceil(countResult / limit),
        },
    };
};

// Get client by ID
const getClientByIdFromDB = async (id: string) => {
    const result = await ClientModel.aggregate([
        { $match: { _id: new Types.ObjectId(id) } },
        {
            $lookup: {
                from: 'user',
                localField: 'createdBy',
                foreignField: '_id',
                as: 'createdBy',
            },
        },
        {
            $unwind: {
                path: '$createdBy',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: 'user',
                localField: 'assignedTelemarketer',
                foreignField: '_id',
                as: 'assignedTelemarketer',
            },
        },
        {
            $unwind: {
                path: '$assignedTelemarketer',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: 'services',
                localField: 'assignedServices',
                foreignField: '_id',
                as: 'assignedServicesDetails',
            },
        },
        {
            $project: {
                'createdBy.password': 0,
                'createdBy.passwordHistory': 0,
                'assignedTelemarketer.password': 0,
                'assignedTelemarketer.passwordHistory': 0,
            },
        },
    ]);
    return result[0] || null;
};

// Get next auto-incremented WB-10001 series client ID
const getNextClientIdFromDB = async (): Promise<string> => {
    const clients = await ClientModel.find({}, { clientId: 1 }).lean();
    let maxNum = 10000;

    for (const client of clients) {
        if (!client.clientId) continue;
        const match = client.clientId.match(/^WB-(\d+)$/i) || client.clientId.match(/(\d+)/);
        if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) {
                maxNum = num;
            }
        }
    }

    let nextNum = maxNum + 1;
    let candidate = `WB-${nextNum}`;

    while (await ClientModel.findOne({ clientId: candidate })) {
        nextNum++;
        candidate = `WB-${nextNum}`;
    }

    return candidate;
};

// Migrate all existing clients to WB-10001, WB-10002... format ordered by creation date
const migrateClientIdsInDB = async (): Promise<{ updatedCount: number; mappings: { id: string; name: string; oldClientId: string; newClientId: string }[] }> => {
    const clients = await ClientModel.find().sort({ createdAt: 1 });
    let currentNum = 10001;
    const mappings: { id: string; name: string; oldClientId: string; newClientId: string }[] = [];

    for (const client of clients) {
        const newClientId = `WB-${currentNum}`;
        const oldClientId = client.clientId || 'unassigned';

        await ClientModel.updateOne(
            { _id: client._id },
            { $set: { clientId: newClientId } }
        );

        mappings.push({
            id: client._id.toString(),
            name: client.name,
            oldClientId,
            newClientId,
        });

        currentNum++;
    }

    return { updatedCount: mappings.length, mappings };
};

// Create client
const createClientInDB = async (
    payload: CreateClientInput & { createdBy: string; assignedTelemarketer?: string | null },
) => {
    // Check if any of the emails already exist
    const emailsToMatch = payload.emails ? payload.emails.map((e) => e.toLowerCase()) : [];
    if (emailsToMatch.length > 0) {
        const existingClient = await ClientModel.findOne({
            emails: { $in: emailsToMatch },
        });
        if (existingClient) {
            throw new Error(
                'One or more of these emails are already associated with another client',
            );
        }
    }

    // Generate clientId if missing or empty
    let finalClientId = (payload as any).clientId;
    if (!finalClientId || !finalClientId.trim()) {
        finalClientId = await getNextClientIdFromDB();
    }

    // Prepare data for creation
    const clientData = {
        clientId: finalClientId,
        name: payload.name,
        emails: emailsToMatch,
        status: payload.status,
        createdBy: new Types.ObjectId(payload.createdBy),
        ...(payload.phone && { phone: payload.phone }),
        ...(payload.address && { address: payload.address }),
        ...(payload.officeAddress && { officeAddress: payload.officeAddress }),
        ...(payload.description && { description: payload.description }),
        ...(payload.teamMembers && { teamMembers: payload.teamMembers }),
        ...(payload.assignedServices && {
            assignedServices: payload.assignedServices.map(
                (id) => new Types.ObjectId(id),
            ),
        }),
        ...(payload.assignedTelemarketer !== undefined && {
            assignedTelemarketer: payload.assignedTelemarketer
                ? new Types.ObjectId(payload.assignedTelemarketer)
                : null,
        }),
    };

    const result = await ClientModel.create(clientData as any);
    return result;
};

// Update client
const updateClientInDB = async (id: string, payload: UpdateClientInput) => {
    // Convert assignedServices string IDs to ObjectIds if provided
    const updateData: Record<string, unknown> = { ...payload };
    
    // If updating emails, check if they are unique
    if (payload.emails) {
        const emailsToMatch = payload.emails.map((e) => e.toLowerCase());
        const existingClient = await ClientModel.findOne({
            emails: { $in: emailsToMatch },
            _id: { $ne: new Types.ObjectId(id) },
        });
        if (existingClient) {
            throw new Error(
                'One or more of these emails are already associated with another client',
            );
        }
        updateData.emails = emailsToMatch;
    }

    if (payload.assignedServices) {
        updateData.assignedServices = payload.assignedServices.map(
            (id) => new Types.ObjectId(id),
        );
    }

    if (payload.assignedTelemarketer !== undefined) {
        updateData.assignedTelemarketer = payload.assignedTelemarketer
            ? new Types.ObjectId(payload.assignedTelemarketer)
            : null;
    }

    const result = await ClientModel.findByIdAndUpdate(id, updateData, {
        new: true,
    });
    return result;
};

// Delete client
const deleteClientFromDB = async (id: string) => {
    const result = await ClientModel.findByIdAndDelete(id);
    return result;
};

// Get client financial stats with optional filters
interface ClientStatsFilters {
    month?: number | undefined;
    year?: number | undefined;
    status?: string | undefined;
    priority?: string | undefined;
    search?: string | undefined;
}

const getClientStatsFromDB = async (
    clientId: string,
    filters?: ClientStatsFilters,
) => {
    const { default: OrderModel } = await import('../models/order.model.js');

    const clientObjectId = new Types.ObjectId(clientId);

    // Build order match query
    const orderMatch: Record<string, unknown> = { clientId: clientObjectId };

    // Add date filters
    if (filters?.month || filters?.year) {
        const dateConditions: Record<string, unknown>[] = [];
        if (filters.month) {
            dateConditions.push({
                $eq: [{ $month: '$orderDate' }, filters.month],
            });
        }
        if (filters.year) {
            dateConditions.push({
                $eq: [{ $year: '$orderDate' }, filters.year],
            });
        }
        orderMatch.$expr = { $and: dateConditions };
    }

    // Add status filter
    if (filters?.status) {
        orderMatch.status = filters.status;
    }

    // Add priority filter
    if (filters?.priority) {
        orderMatch.priority = filters.priority;
    }

    // Add search filter
    if (filters?.search) {
        orderMatch.orderName = {
            $regex: escapeRegex(filters.search),
            $options: 'i',
        };
    }

    // Aggregation pipeline to calculate stats
    const stats = await OrderModel.aggregate([
        { $match: orderMatch },
        {
            $lookup: {
                from: 'earnings',
                localField: '_id',
                foreignField: 'orderIds',
                as: 'earning',
            },
        },
        {
            $unwind: {
                path: '$earning',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalAmount: { $sum: '$totalPrice' },
                totalImages: { $sum: '$imageQuantity' },
                paidAmount: {
                    $sum: {
                        $cond: [
                            { $eq: ['$earning.status', 'paid'] },
                            '$totalPrice',
                            0,
                        ],
                    },
                },
                totalBDT: {
                    $sum: {
                        $cond: [
                            { $eq: ['$earning.status', 'paid'] },
                            {
                                $multiply: [
                                    '$totalPrice',
                                    { $ifNull: ['$earning.conversionRate', 0] },
                                ],
                            },
                            0,
                        ],
                    },
                },
            },
        },
    ]);

    const result = stats[0] || {
        totalOrders: 0,
        totalAmount: 0,
        totalImages: 0,
        paidAmount: 0,
        totalBDT: 0,
    };

    const dueAmount = result.totalAmount - result.paidAmount;

    return {
        totalOrders: result.totalOrders,
        totalAmount: result.totalAmount,
        totalImages: result.totalImages,
        paidAmount: result.paidAmount,
        totalBDT: result.totalBDT,
        dueAmount: Math.max(0, dueAmount),
    };
};

export default {
    getAllClientsFromDB,
    getClientByIdFromDB,
    createClientInDB,
    updateClientInDB,
    deleteClientFromDB,
    getClientStatsFromDB,
    getNextClientIdFromDB,
    migrateClientIdsInDB,
};

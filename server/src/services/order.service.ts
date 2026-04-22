import mongoose from 'mongoose';
import OrderModel, { IOrder, OrderType, OrderStatus } from '../models/order.model.js';
import ProjectModel from '../models/project.model.js';
import ServiceModel from '../models/service.model.js';

async function createOrderInDB(payload: Partial<IOrder>) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Create the Order
        const [newOrder] = await OrderModel.create([payload], { session });

        // 2. If Order is a Project, initialize the Project
        if (newOrder.orderType === OrderType.PROJECT) {
            await ProjectModel.create(
                [
                    {
                        orderId: newOrder._id,
                        clientId: newOrder.clientId,
                        status: 'not_started',
                        milestones: [], // Initially empty, added via update or specific logic
                    },
                ],
                { session },
            );
        }

        await session.commitTransaction();
        return newOrder;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}

async function getAllOrdersFromDB(query: any) {
    const { page = 1, limit = 10, search, status, orderType, clientId } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (search) {
        filter.title = { $regex: search, $options: 'i' };
    }

    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    if (clientId) filter.clientId = clientId;

    const orders = await OrderModel.find(filter)
        .populate('clientId', 'name emails')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    const total = await OrderModel.countDocuments(filter);

    return {
        orders,
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPage: Math.ceil(total / Number(limit)),
        },
    };
}

async function getOrderByIdFromDB(id: string) {
    const order = await OrderModel.findById(id)
        .populate('clientId')
        .populate('items.serviceId');
    return order;
}

async function updateOrderStatusInDB(id: string, status: OrderStatus, userId: string, note?: string) {
    const result = await OrderModel.findByIdAndUpdate(
        id,
        {
            $set: { status },
            $push: {
                statusHistory: {
                    status,
                    changedBy: new mongoose.Types.ObjectId(userId),
                    updatedAt: new Date(),
                    note,
                },
            },
        },
        { new: true },
    );
    return result;
}

export default {
    createOrderInDB,
    getAllOrdersFromDB,
    getOrderByIdFromDB,
    updateOrderStatusInDB,
};

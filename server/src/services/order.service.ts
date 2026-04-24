import mongoose from 'mongoose';
import OrderModel, { type IOrder, OrderType, OrderStatus } from '../models/order.model.js';
import ProjectModel from '../models/project.model.js';


async function createOrderInDB(payload: Partial<IOrder>) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Create the Order
        const [newOrder] = await OrderModel.create([payload], { session });

        // 2. If Order is a Project, initialize the Project
        if (newOrder && newOrder.orderType === OrderType.PROJECT) {
            await ProjectModel.create(
                [
                    {
                        orderId: newOrder._id,
                        clientId: newOrder.clientId,
                        status: 'not_started',
                        milestones: [],
                    },
                ],
                { session },
            );
        }

        await session.commitTransaction();
        return newOrder;
    } catch (err: any) {
        console.error('ORDER CREATION FAILED. Payload:', JSON.stringify(payload, null, 2));
        console.error('Error Details:', err);
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
        .populate('clientId', 'name clientId emails')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

    const total = await OrderModel.countDocuments(filter);

    return {
        data: orders,
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
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

import InvoiceModel, { IInvoice, InvoiceStatus } from '../models/invoice.model.js';
import OrderModel from '../models/order.model.js';
import ProjectModel from '../models/project.model.js';
import mongoose from 'mongoose';

async function generateInvoiceNumber(): Promise<string> {
    const lastInvoice = await InvoiceModel.findOne().sort({ createdAt: -1 });
    const nextNumber = lastInvoice 
        ? parseInt(lastInvoice.invoiceNumber.split('-')[1]) + 1 
        : 1001;
    return `INV-${nextNumber}`;
}

async function createInvoiceFromOrder(orderId: string, dueDate: Date) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    const invoiceNumber = await generateInvoiceNumber();

    const invoiceItems = order.items.map(item => ({
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity || item.hours || 1,
        total: item.totalPrice,
        sourceType: 'order' as const,
        sourceId: order._id
    }));

    const invoice = await InvoiceModel.create({
        invoiceNumber,
        clientId: order.clientId,
        orderId: order._id,
        items: invoiceItems,
        currency: order.currency,
        subtotal: order.totalAmount,
        total: order.totalAmount,
        dueAmount: order.totalAmount,
        dueDate
    });

    return invoice;
}

async function createInvoiceFromMilestone(projectId: string, milestoneId: string, dueDate: Date) {
    const project = await ProjectModel.findById(projectId);
    if (!project) throw new Error('Project not found');

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) throw new Error('Milestone not found');

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await InvoiceModel.create({
        invoiceNumber,
        clientId: project.clientId,
        projectId: project._id,
        orderId: project.orderId,
        items: [{
            name: milestone.title,
            unitPrice: milestone.amount,
            quantity: 1,
            total: milestone.amount,
            sourceType: 'milestone',
            sourceId: milestone._id
        }],
        subtotal: milestone.amount,
        total: milestone.amount,
        dueAmount: milestone.amount,
        dueDate
    });

    // Update milestone with invoiceId
    milestone.invoiceId = invoice._id as mongoose.Types.ObjectId;
    await project.save();

    return invoice;
}

async function getAllInvoicesFromDB(query: any) {
    const { status, clientId } = query;
    const filter: any = {};
    if (status) filter.paymentStatus = status;
    if (clientId) filter.clientId = clientId;

    return await InvoiceModel.find(filter)
        .populate('clientId', 'name')
        .sort({ createdAt: -1 });
}

async function getInvoiceById(id: string) {
    return await InvoiceModel.findById(id).populate('clientId');
}

export default {
    createInvoiceFromOrder,
    createInvoiceFromMilestone,
    getAllInvoicesFromDB,
    getInvoiceById
};

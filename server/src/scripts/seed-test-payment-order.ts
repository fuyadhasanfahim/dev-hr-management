/**
 * One-off dev script: creates a real Client + Quotation + Order (+ the
 * auto-generated zero-payment Receipt) for testing the online-payment flow
 * end-to-end, then mints a payment token for it so you can go straight to
 * the payment page without touching the dashboard UI.
 *
 * Run from server/: node --import tsx src/scripts/seed-test-payment-order.ts
 */
import mongoose, { Types } from 'mongoose';
import envConfig from '../config/env.config.js';
import ClientModel from '../models/client.model.js';
import UserModel from '../models/user.model.js';
import { QuotationService } from '../services/quotation.service.js';
import orderService from '../services/order.service.js';
import { PaymentService } from '../services/payment.service.js';

const CLIENT_EMAIL = 'fuyad56@gmail.com';

const run = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected.');

        // Any admin/super_admin to attribute this test data to — falls back to any user.
        const actor =
            (await UserModel.findOne({ role: { $in: ['super_admin', 'admin'] } })) ||
            (await UserModel.findOne({}));
        if (!actor) {
            throw new Error('No users found in this database — cannot pick a createdBy for the test data.');
        }
        const userId = String(actor._id);
        console.log(`Using actor: ${actor.email || actor._id} (role: ${actor.role || 'n/a'})`);

        let client = await ClientModel.findOne({ emails: CLIENT_EMAIL });
        if (!client) {
            client = await ClientModel.create({
                name: 'Fuyad Test Client',
                emails: [CLIENT_EMAIL],
                currency: 'USD',
                status: 'active',
                createdBy: new Types.ObjectId(userId),
            });
            console.log(`Created client ${client._id}`);
        } else {
            console.log(`Reusing existing client ${client._id}`);
        }

        const today = new Date();
        const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const quotation = await QuotationService.createQuotation(
            {
                serviceType: 'web-development',
                clientId: client._id,
                company: { name: 'WEB BRIKS LLC' },
                client: { contactName: client.name, email: CLIENT_EMAIL },
                details: {
                    title: `Test Payment Flow — ${today.toISOString()}`,
                    date: today.toISOString(),
                    validUntil: validUntil.toISOString(),
                },
                currency: 'USD',
                workflow: [],
                services: [
                    {
                        category: 'web-development',
                        scopeDescription: 'Test service for the online-payment flow',
                        scopeItems: ['Sample deliverable'],
                        basePrice: 100,
                        lineItems: [],
                        discount: 0,
                        taxRate: 0,
                    },
                ],
            } as any,
            userId,
        );
        console.log(`Created quotation ${quotation.quotationNumber} (group ${quotation.quotationGroupId})`);

        const order = await orderService.createOrderFromQuotation(quotation.quotationGroupId, userId);
        console.log(`Created order ${order.orderNumber} (id ${order._id})`);

        const issued = await PaymentService.issueTokenForOrder(String(order._id));
        if (!issued) {
            throw new Error('issueTokenForOrder returned null — order shows as already fully paid?');
        }

        console.log('\n✅ Test data ready.');
        console.log(`Order ID:      ${order._id}`);
        console.log(`Amount due:    ${issued.amountDue} ${issued.currency}`);
        console.log(`Payment token: ${issued.token}`);
        console.log(`Payment page:  http://localhost:3002/payment/${issued.token}`);

        process.exit(0);
    } catch (err) {
        console.error('Seed script failed:', err);
        process.exit(1);
    }
};

run();

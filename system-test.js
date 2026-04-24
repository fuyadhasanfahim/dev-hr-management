/**
 * FULL AUTOMATED SYSTEM TEST SCRIPT
 * 
 * This script simulates the full business lifecycle:
 * Service -> Client -> Quotation -> Convert to Order -> Project -> Invoice -> Payment
 * 
 * Prerequisites:
 * 1. Server must be running at http://localhost:5000
 * 2. You need valid credentials for an Admin/Super Admin user
 */

const BASE_URL = 'http://localhost:5000/api';

// --- CONFIGURATION ---
const AUTH_EMAIL = 'admin@example.com'; // Change this
const AUTH_PASSWORD = 'password123';    // Change this
// ---------------------

let cookie = '';
const report = {
    success: true,
    stepsPassed: [],
    stepsFailed: [],
    errors: [],
    summary: {
        totalSteps: 8,
        passed: 0,
        failed: 0
    }
};

async function api(path, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${BASE_URL}${path}`, options);
    
    // Update cookie if provided in response
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        cookie = setCookie.split(';')[0];
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || `API Error: ${response.status}`);
    }
    return data;
}

async function runTest() {
    console.log('🚀 Starting Full System Automated Test...\n');

    let serviceId, clientId, quotationId, orderId, projectId, invoiceId;

    // STEP 0: Authentication
    try {
        console.log('Step 0: Authenticating...');
        const authData = await api('/auth/sign-in/email', 'POST', {
            email: AUTH_EMAIL,
            password: AUTH_PASSWORD
        });
        console.log('✅ Authenticated successfully.\n');
    } catch (err) {
        console.warn('⚠️ Authentication failed. Please ensure credentials in system-test.js are correct.');
        console.warn('Continuing as guest (test might fail if routes are protected)...\n');
    }

    // STEP 1: Create Service
    await runStep('Create Service', async () => {
        const res = await api('/services', 'POST', {
            name: "Enterprise Web Solution " + Date.now(),
            category: "web-dev",
            pricingModel: "fixed",
            basePrice: 5000,
            currency: "USD",
            isActive: true
        });
        serviceId = res.data._id;
        if (!serviceId) throw new Error('Service ID missing in response');
    });

    // STEP 2: Create Client
    await runStep('Create Client', async () => {
        const res = await api('/clients', 'POST', {
            clientId: "CLT-" + Math.floor(Math.random() * 10000),
            name: "Acme Corp",
            emails: ["billing@acme.corp"],
            phone: "+1234567890",
            currency: "USD"
        });
        clientId = res.data._id;
        if (!clientId) throw new Error('Client ID missing in response');
    });

    // STEP 3: Create Quotation
    await runStep('Create Quotation', async () => {
        const res = await api('/quotations', 'POST', {
            serviceType: "web-development",
            clientId: clientId,
            details: {
                title: "E-commerce Platform Project",
                date: new Date().toISOString(),
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            },
            overview: "Building a high-performance e-commerce platform.",
            totals: {
                packagePrice: 5000,
                additionalTotal: 0,
                taxAmount: 500,
                grandTotal: 5500
            },
            settings: { currency: "USD" }
        });
        quotationId = res.data._id;
        if (!res.data.quotationNumber) throw new Error('Quotation number not generated');
        if (res.data.totals.grandTotal !== 5500) throw new Error('Grand total calculation mismatch');
    });

    // STEP 4: Update Quotation Status
    await runStep('Update Quotation Status', async () => {
        await api(`/quotations/${quotationId}`, 'PATCH', { status: 'sent' });
        const res = await api(`/quotations/${quotationId}`, 'PATCH', { status: 'accepted' });
        if (res.data.status !== 'accepted') throw new Error('Status failed to update to accepted');
    });

    // STEP 5: Convert to Order
    await runStep('Convert to Order', async () => {
        const res = await api(`/quotations/${quotationId}/convert`, 'POST');
        orderId = res.data._id;
        if (!orderId) throw new Error('Order ID missing in conversion response');
        if (res.data.totalAmount !== 5500) throw new Error('Order total does not match quotation');
    });

    // STEP 6: Fetch Project
    await runStep('Fetch Project', async () => {
        const res = await api(`/projects?orderId=${orderId}`);
        const project = res.data.items ? res.data.items[0] : res.data[0]; // Adjust based on actual structure
        if (!project) throw new Error('Project was not automatically created for the order');
        projectId = project._id;
    });

    // STEP 7: Generate Invoice
    await runStep('Generate Invoice', async () => {
        const res = await api('/invoices/generate', 'POST', {
            orderId: orderId,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
        invoiceId = res.data._id;
        if (res.data.total !== 5500) throw new Error('Invoice total mismatch');
        if (res.data.dueAmount !== 5500) throw new Error('Invoice due amount mismatch');
    });

    // STEP 8: Make Payment
    await runStep('Make Payment', async () => {
        const res = await api('/payments', 'POST', {
            invoiceId: invoiceId,
            amount: 2500,
            method: "bank_transfer",
            status: "completed",
            transactionId: "TXN-" + Date.now()
        });
        
        // Validate Invoice update
        const invRes = await api(`/invoices/${invoiceId}`);
        if (invRes.data.paidAmount !== 2500) throw new Error('Invoice paidAmount not updated');
        if (invRes.data.dueAmount !== 3000) throw new Error('Invoice dueAmount not reduced correctly');
        if (invRes.data.paymentStatus !== 'partial') throw new Error('Invoice status should be partial');
    });

    console.log('\n--- FINAL REPORT ---');
    console.log(JSON.stringify(report, null, 2));
}

async function runStep(name, fn) {
    try {
        console.log(`Step: ${name}...`);
        await fn();
        report.stepsPassed.push(name);
        report.summary.passed++;
        console.log(`✅ Passed: ${name}`);
    } catch (err) {
        const errorMsg = `${name}: ${err.message}`;
        report.success = false;
        report.stepsFailed.push(name);
        report.errors.push(errorMsg);
        report.summary.failed++;
        console.log(`❌ Failed: ${errorMsg}`);
    }
}

runTest();

import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const prodUri = 'mongodb+srv://admin:0gp4SvbU092p1rDS@cluster0.atzq3rl.mongodb.net/dev-hr-management?appName=Cluster0';

async function fixProdQuotation() {
  console.log('Connecting to production MongoDB cluster0.atzq3rl.mongodb.net...');
  const conn = await mongoose.createConnection(prodUri).asPromise();
  const db = conn.db!;
  const qColl = db.collection('quotations');

  const targetIdStr = '6a5e5f86843d5e2d7d06ff8b';
  const objId = new mongoose.Types.ObjectId(targetIdStr);

  const doc = await qColl.findOne({
    $or: [
      { _id: objId },
      { _id: targetIdStr }
    ]
  });

  if (!doc) {
    console.log('Target document 6a5e5f86843d5e2d7d06ff8b not found by exact ID. Recent 10 quotations:');
    const recent = await qColl.find({}).sort({ _id: -1 }).limit(10).toArray();
    for (const r of recent) {
      console.log(`ID: ${r._id} | Num: ${r.quotationNumber} | Title: ${r.details?.title} | Totals:`, JSON.stringify(r.totals));
    }
  } else {
    console.log('FOUND PROD QUOTATION 6a5e5f86843d5e2d7d06ff8b:');
    console.log(`ID: ${doc._id} | Num: ${doc.quotationNumber} | Title: ${doc.details?.title}`);
    console.log('Current Totals:', JSON.stringify(doc.totals, null, 2));
    console.log('Current Services:', JSON.stringify(doc.services, null, 2));

    // Fix basePrice double counting in web-development service
    let modified = false;
    if (Array.isArray(doc.services)) {
      for (const service of doc.services) {
        if (service.category === 'web-development' && service.basePrice > 0 && service.lineItems?.length > 0) {
          console.log(`Fixing service '${service.category}': basePrice was ${service.basePrice}, changing to 0.`);
          service.basePrice = 0;
          modified = true;
        }
      }
    }

    if (modified) {
      // Recalculate totals
      let subtotal = 0;
      let discountAmount = 0;
      let taxAmount = 0;

      for (const service of doc.services) {
        const basePrice = service.basePrice || 0;
        const upfrontLineItemsTotal = (service.lineItems || []).reduce((acc: number, item: any) => {
          if (!item.billingCycle || item.billingCycle === 'one-time' || item.billingCycle === 'per-image' || item.billingCycle === 'per-video' || item.billingCycle === 'per-second' || item.billingCycle === 'per-10s') {
            return acc + (item.price || 0) * (item.quantity ?? 1);
          }
          return acc;
        }, 0);

        const serviceBase = basePrice + upfrontLineItemsTotal;
        const sDiscount = (serviceBase * (service.discount || 0)) / 100;
        const sSubtotal = serviceBase - sDiscount;
        const sTax = (sSubtotal * (service.taxRate || 0)) / 100;

        discountAmount += sDiscount;
        subtotal += sSubtotal;
        taxAmount += sTax;
      }

      const grandTotal = subtotal + taxAmount;
      const newTotals = { subtotal, discountAmount, taxAmount, grandTotal };

      console.log('New recomputed totals:', newTotals);

      const updateRes = await qColl.updateOne(
        { _id: doc._id },
        {
          $set: {
            services: doc.services,
            totals: newTotals,
            updatedAt: new Date()
          }
        }
      );
      console.log('Production DB Update Result:', updateRes);
    }
  }

  await conn.close();
  process.exit(0);
}

fixProdQuotation();

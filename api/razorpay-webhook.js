import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Initialization ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();
const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export default async function handler(req, res) {
  console.log("Webhook received...");

  // 1. Verify the signature
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;
  try {
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    shasum.update(JSON.stringify(body));
    const digest = shasum.digest('hex');
    if (digest !== signature) {
      console.error('Signature mismatch!');
      return res.status(403).json({ error: 'Invalid signature' });
    }
    console.log("Signature verified.");
  } catch (error) {
    console.error('Signature validation error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  // 2. Process the event
  const event = body;
  if (event.event === 'payment.captured') {
    const paymentInfo = event.payload.payment.entity;
    
    // 3. Get all the details we sent from the app via the 'notes' field
    const notes = paymentInfo.notes;
    const productName = notes.product_name;
    const productId = notes.product_id;
    const customerName = notes.customer_name;
    const customerPhone = notes.customer_phone; // This is the sanitized phone number from the app
    const amountPaid = paymentInfo.amount / 100;

    if (!productId || !customerPhone) {
        console.warn("Webhook received without product_id or customer_phone in notes. Ignoring.");
        return res.status(200).json({ status: 'ignored_missing_notes' });
    }

    try {
      // 4. CREATE the new order directly in the database with status "paid"
      const orderData = {
          customerName,
          customerPhone,
          productName,
          productId,
          amount: amountPaid,
          status: 'paid', // Set status directly to 'paid'
          createdAt: new Date(),
          paymentId: paymentInfo.id,
          paymentDetails: paymentInfo,
      };

      await db.collection('orders').add(orderData);
      
      console.log(`SUCCESS: Created new PAID order for ${productName} by ${customerName}.`);

    } catch (error) {
      console.error(`Database Error: Could not create order for ${productName}.`, error);
    }
  }

  // 5. Acknowledge receipt
  res.status(200).json({ status: 'ok' });
}

import { buffer } from 'micro';
import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Secure Initialization ---
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('CRITICAL: Firebase Admin initialization failed.', error);
}

const db = admin.firestore();
const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
  console.log("--- [START] WEBHOOK INVOCATION ---");

  if (req.method !== 'POST') {
    console.log("-> [FAIL] Method not POST. Received:", req.method);
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  if (!RAZORPAY_SECRET) {
      console.error("-> [FATAL] RAZORPAY_WEBHOOK_SECRET is not set in Vercel. Function cannot continue.");
      return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    console.log("Step 1: Reading raw body from request...");
    const rawBody = await buffer(req);
    const signature = req.headers['x-razorpay-signature'];
    console.log("Step 1: Raw body read successfully.");

    console.log("Step 2: Verifying signature...");
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    shasum.update(rawBody);
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('-> [FAIL] SIGNATURE MISMATCH.');
      console.error('   Calculated Digest:', digest);
      console.error('   Received Signature:', signature);
      return res.status(403).json({ error: 'Invalid signature.' });
    }
    console.log("Step 2: Signature Verified Successfully.");

    const body = JSON.parse(rawBody.toString());
    const event = body;
    console.log("Step 3: Parsed body. Event Type:", event.event);

    if (event.event === 'payment.captured') {
        console.log("Step 4: 'payment.captured' event found. Processing...");
        const paymentInfo = event.payload.payment.entity;
        
        const notes = paymentInfo.notes;
        const productName = notes.product_name;
        const productId = notes.product_id;
        const customerName = notes.customer_name;
        const customerPhone = notes.customer_phone;
        const amountPaid = paymentInfo.amount / 100;

        console.log("   - Product Name from Notes:", productName);
        console.log("   - Product ID from Notes:", productId);
        console.log("   - Customer Name from Notes:", customerName);
        console.log("   - Customer Phone from Notes:", customerPhone);

        if (!productId || !customerPhone || !productName) {
            console.warn("-> [FAIL] Webhook missing required notes (product_id, customer_phone, or product_name). Ignoring.");
            return res.status(200).json({ status: 'ignored_missing_notes' });
        }

        const orderData = {
            customerName,
            customerPhone,
            productName,
            productId,
            amount: amountPaid,
            status: 'paid',
            createdAt: new Date(),
            paymentId: paymentInfo.id,
            paymentDetails: paymentInfo,
        };
        
        console.log("Step 5: Preparing to create order in Firestore with this data:", JSON.stringify(orderData, null, 2));
        
        await db.collection('orders').add(orderData);
        
        console.log("--- [SUCCESS] Created new PAID order in Firestore. ---");

    } else {
        console.log(`-> [INFO] Received event '${event.event}', which is not 'payment.captured'. Ignoring.`);
    }

    res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('--- [FATAL CRASH] An error occurred in the webhook handler ---', error);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
}

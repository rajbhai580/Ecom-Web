import { buffer } from 'micro';
import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Secure Initialization of Firebase Admin ---
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

// Disable Vercel's default body parser to access the raw body
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
  console.log("--- Webhook Invoked ---");

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  if (!RAZORPAY_SECRET) {
      console.error("FATAL: RAZORPAY_WEBHOOK_SECRET is not set.");
      return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const rawBody = await buffer(req);
    const signature = req.headers['x-razorpay-signature'];
    
    // --- Reliable Validation Method ---
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    shasum.update(rawBody);
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('--- SIGNATURE MISMATCH --- The secret in Vercel does not match Razorpay.');
      return res.status(403).json({ error: 'Invalid signature.' });
    }
    console.log("--- Signature Verified Successfully ---");

    const body = JSON.parse(rawBody.toString());
    const event = body;
    console.log("Event Type:", event.event);

    if (event.event === 'payment.captured') {
        const paymentInfo = event.payload.payment.entity;
        
        // --- CREATE ORDER LOGIC ---
        const notes = paymentInfo.notes;
        const productName = notes.product_name;
        const productId = notes.product_id;
        const customerName = notes.customer_name;
        const customerPhone = notes.customer_phone;
        const customerAddress = notes.customer_address; // Get the address
        const amountPaid = paymentInfo.amount / 100;

        if (!productId || !customerPhone || !customerAddress) {
            console.warn("Webhook received without required notes (productId, customerPhone, or address). Ignoring.");
            return res.status(200).json({ status: 'ignored_missing_notes' });
        }

        const orderData = {
            customerName,
            customerPhone,
            customerAddress, // Save the address
            productName,
            productId,
            amount: amountPaid,
            status: 'paid', // Order is created directly as 'paid'
            createdAt: new Date(),
            paymentId: paymentInfo.id,
            paymentDetails: paymentInfo,
        };

        await db.collection('orders').add(orderData);
        console.log(`--- SUCCESS! Created new PAID order for ${productName} by ${customerName}. ---`);

    } else {
        console.log(`Webhook received for event '${event.event}', which is not 'payment.captured'. Ignoring.`);
    }

    res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('--- FATAL ERROR in Webhook Handler ---', error);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
}

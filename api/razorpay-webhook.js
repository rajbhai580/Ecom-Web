import { buffer } from 'micro';
import admin from 'firebase-admin';
import crypto from 'crypto';

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
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    shasum.update(rawBody);
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('--- SIGNATURE MISMATCH ---');
      return res.status(403).json({ error: 'Invalid signature.' });
    }
    console.log("--- Signature Verified Successfully ---");

    const body = JSON.parse(rawBody.toString());
    const event = body;
    console.log("Event Type:", event.event);

    if (event.event === 'payment.captured') {
        const paymentInfo = event.payload.payment.entity;
        
        // THE FIX IS HERE: We find the order using the order_id from notes
        const orderId = paymentInfo.notes.order_id;

        if (!orderId) {
            console.warn("Webhook received without order_id in notes. Ignoring.");
            return res.status(200).json({ status: 'ignored_missing_order_id' });
        }

        console.log(`Payment captured. Updating order ID: ${orderId}`);

        const orderRef = db.collection('orders').doc(orderId);
        
        // Update the existing order from 'failed' to 'paid'
        await orderRef.update({
            status: 'paid',
            paymentId: paymentInfo.id,
            paymentDetails: paymentInfo,
        });
        
        console.log(`--- SUCCESS! Updated order ${orderId} to 'paid'. ---`);
    } else {
        console.log(`Webhook received for event '${event.event}', which is not 'payment.captured'. Ignoring.`);
    }

    res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('--- FATAL ERROR in Webhook Handler ---', error);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
}

// Start of api/razorpay-webhook.js code
import admin from 'firebase-admin';
import crypto from 'crypto';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;

  try {
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    shasum.update(JSON.stringify(body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('Signature mismatch.');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Signature validation error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  const event = body;

  if (event.event === 'payment_page.paid') { // Event name for Payment Pages
    const paymentInfo = event.payload.payment_page.entity;
    const orderId = paymentInfo.notes.order_id; // Get our order ID
    
    if (!orderId) {
        console.log("Webhook received but no order_id found in notes. Ignoring.");
        return res.status(200).json({ status: 'ignored' });
    }

    try {
      const orderRef = db.collection('orders').doc(orderId);
      await orderRef.update({
          status: 'paid', // Update status to 'paid'
          paymentId: paymentInfo.id,
          paymentDetails: paymentInfo 
      });
      console.log(`Successfully updated order ${orderId} to 'paid'.`);
    } catch (error) {
      console.error(`Error updating database for order ${orderId}:`, error);
    }
  }

  res.status(200).json({ status: 'ok' });
}
// End of api/razorpay-webhook.js code

import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Initialization ---
// Ensure FIREBASE_SERVICE_ACCOUNT_JSON is set in Vercel Environment Variables
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Ensure RAZORPAY_WEBHOOK_SECRET is set in Vercel Environment Variables
const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export default async function handler(req, res) {
  // 1. Verify the request is from Razorpay
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

  // 2. Process the webhook event
  const event = body;
  if (event.event === 'payment.captured') {
    const paymentInfo = event.payload.payment.entity;
    
    // Get customer phone and amount from the payment
    const customerPhone = paymentInfo.contact ? paymentInfo.contact.replace('+91', '') : '';
    const amountPaid = paymentInfo.amount / 100; // Convert from paise to rupees

    if (!customerPhone) {
        console.warn("Webhook received for payment with no contact number. Cannot find order.");
        return res.status(200).json({ status: 'ignored_no_contact' });
    }

    try {
      // 3. Find the LATEST PENDING order that matches the phone and amount
      const ordersRef = db.collection('orders');
      const q = ordersRef
          .where('customerPhone', '==', customerPhone)
          .where('amount', '==', amountPaid)
          .where('status', '==', 'pending')
          .orderBy('createdAt', 'desc')
          .limit(1);

      const querySnapshot = await q.get();

      if (querySnapshot.empty) {
        console.warn(`Webhook received, but no matching PENDING order found for phone ${customerPhone} and amount ${amountPaid}.`);
        return res.status(200).json({ status: 'no_matching_pending_order' });
      }

      // 4. Update the order to "paid"
      const orderDoc = querySnapshot.docs[0];
      await orderDoc.ref.update({
          status: 'paid',
          paymentId: paymentInfo.id,
          paymentDetails: paymentInfo,
      });
      
      console.log(`SUCCESS: Updated order ${orderDoc.id} to 'paid'.`);

    } catch (error) {
      console.error(`Database Error: Could not update order for phone ${customerPhone}.`, error);
      // Still send a 200 to prevent Razorpay from retrying, but log the error for investigation.
    }
  }

  // 5. Acknowledge receipt of the webhook
  res.status(200).json({ status: 'ok' });
}

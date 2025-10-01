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
  console.log("Webhook received. Starting process...");

  // 1. Verify the signature from Razorpay
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;
  try {
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    shasum.update(JSON.stringify(body));
    const digest = shasum.digest('hex');
    if (digest !== signature) {
      console.error('Signature mismatch! Check secrets in Vercel and Razorpay.');
      return res.status(403).json({ error: 'Invalid signature' });
    }
    console.log("Signature verified successfully.");
  } catch (error) {
    console.error('Error during signature validation:', error);
    return res.status(500).json({ error: 'Internal Server Error during validation' });
  }

  // 2. Process the event if the signature is valid
  const event = body;
  if (event.event === 'payment.captured') {
    const paymentInfo = event.payload.payment.entity;
    
    // 3. Standardize the phone number from Razorpay to match our app's format
    const razorpayPhone = paymentInfo.contact || '';
    const customerPhone = razorpayPhone.replace(/\D/g, '').slice(-10);
    const amountPaid = paymentInfo.amount / 100;

    console.log(`Payment captured. Searching for pending order for phone: ${customerPhone} and amount: ${amountPaid}`);

    if (!customerPhone) {
        console.warn("Webhook received for payment with no contact number. Cannot find order.");
        return res.status(200).json({ status: 'ignored_no_contact' });
    }

    try {
      // 4. Find the LATEST PENDING order that matches the standardized phone and amount
      const ordersRef = db.collection('orders');
      const q = ordersRef
          .where('customerPhone', '==', customerPhone)
          .where('amount', '==', amountPaid)
          .where('status', '==', 'pending')
          .orderBy('createdAt', 'desc')
          .limit(1);

      const querySnapshot = await q.get();

      if (querySnapshot.empty) {
        console.warn(`Webhook search complete. No matching PENDING order was found for phone ${customerPhone} and amount ${amountPaid}.`);
        return res.status(200).json({ status: 'no_matching_pending_order' });
      }

      // 5. Update the found order to "paid"
      const orderDoc = querySnapshot.docs[0];
      await orderDoc.ref.update({
          status: 'paid',
          paymentId: paymentInfo.id,
          paymentDetails: paymentInfo,
      });
      
      console.log(`SUCCESS! Updated order ${orderDoc.id} from 'pending' to 'paid'.`);

    } catch (error) {
      console.error(`Database Error: Could not update order for phone ${customerPhone}.`, error);
    }
  } else {
      console.log(`Webhook received for event '${event.event}', which is not 'payment.captured'. Ignoring.`);
  }

  // 6. Acknowledge receipt of the webhook
  res.status(200).json({ status: 'ok' });
}

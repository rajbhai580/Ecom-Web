import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Secure Initialization of Firebase Admin ---
// This pattern prevents re-initialization on Vercel's hot-reloads and ensures it only runs once.
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

// This is the main function Vercel will run.
export default async function handler(req, res) {
  console.log("--- Webhook Invoked ---");

  // Check for secrets first. If they are missing, the function cannot work.
  if (!RAZORPAY_SECRET) {
      console.error("FATAL: RAZORPAY_WEBHOOK_SECRET is not set in Vercel Environment Variables.");
      return res.status(500).json({ error: 'Server configuration error.' });
  }

  // 1. Verify the signature from Razorpay
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;
  
  try {
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    shasum.update(JSON.stringify(body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('--- SIGNATURE MISMATCH --- The secret in Vercel does not match Razorpay.');
      return res.status(403).json({ error: 'Invalid signature.' });
    }
    console.log("--- Signature Verified Successfully ---");

  } catch (error) {
    console.error('--- Error during signature validation ---', error);
    return res.status(500).json({ error: 'Internal Server Error during validation.' });
  }

  // 2. Process the event if the signature is valid
  const event = body;
  console.log("Event Type:", event.event);

  if (event.event === 'payment.captured') {
    const paymentInfo = event.payload.payment.entity;
    console.log("Full Payment Entity:", JSON.stringify(paymentInfo, null, 2));
    
    // 3. Standardize the phone number from Razorpay
    const razorpayPhone = paymentInfo.contact || '';
    const customerPhone = razorpayPhone.replace(/\D/g, '').slice(-10);
    const amountPaid = paymentInfo.amount / 100;

    console.log(`Payment captured. Searching for pending order for phone: ${customerPhone} and amount: ${amountPaid}`);

    if (!customerPhone) {
        console.warn("Webhook received for payment with no contact number. Cannot find order.");
        return res.status(200).json({ status: 'ignored_no_contact' });
    }

    try {
      // 4. Find the LATEST PENDING order that matches
      const ordersRef = db.collection('orders');
      const q = ordersRef
          .where('customerPhone', '==', customerPhone)
          .where('amount', '==', amountPaid)
          .where('status', '==', 'pending')
          .orderBy('createdAt', 'desc')
          .limit(1);

      const querySnapshot = await q.get();

      if (querySnapshot.empty) {
        console.warn(`--- Webhook search complete. No matching PENDING order was found. ---`);
        return res.status(200).json({ status: 'no_matching_pending_order' });
      }

      // 5. Update the found order to "paid"
      const orderDoc = querySnapshot.docs[0];
      await orderDoc.ref.update({
          status: 'paid',
          paymentId: paymentInfo.id,
          paymentDetails: paymentInfo,
      });
      
      console.log(`--- SUCCESS! Updated order ${orderDoc.id} to 'paid'. ---`);

    } catch (error) {
      console.error(`--- Database Error: Could not update order for phone ${customerPhone}. ---`, error);
    }
  } else {
      console.log(`Webhook received for event '${event.event}', which is not 'payment.captured'. Ignoring.`);
  }

  // 6. Acknowledge receipt of the webhook
  res.status(200).json({ status: 'ok' });
}

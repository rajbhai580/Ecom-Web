import crypto from "crypto";
import admin from "firebase-admin";

// ✅ Init Firebase only once
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false, // disable default parser
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    // --- Get raw body buffer ---
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // --- Verify Razorpay signature ---
    const signature = req.headers["x-razorpay-signature"];
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("❌ Signature mismatch!");
      return res.status(400).json({ error: "Invalid signature" });
    }

    console.log("✅ Signature verified");

    // --- Parse body safely ---
    const body = JSON.parse(rawBody.toString());
    const eventType = body.event;
    console.log("Event:", eventType);

    if (eventType === "payment.captured") {
      const payment = body.payload.payment.entity;
      const customerPhone = (payment.contact || "").replace(/\D/g, "").slice(-10);
      const amountPaid = payment.amount / 100;

      console.log(`Captured payment for phone ${customerPhone}, amount ${amountPaid}`);

      // --- Match Firestore order ---
      const ordersRef = db.collection("orders");
      const q = ordersRef
        .where("customerPhone", "==", customerPhone)
        .where("amount", "==", amountPaid)
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .limit(1);

      const snap = await q.get();

      if (snap.empty) {
        console.warn("No matching pending order found");
      } else {
        const doc = snap.docs[0];
        await doc.ref.update({
          status: "paid",
          paymentId: payment.id,
          paymentDetails: payment,
        });
        console.log(`✅ Updated order ${doc.id} to 'paid'`);
      }
    } else {
      console.log(`Ignoring event ${eventType}`);
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

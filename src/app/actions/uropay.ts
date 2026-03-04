
'use server';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

interface InitiatePaymentParams {
  amount: number;
  userId: string;
  userName: string;
  userEmail: string;
}

/**
 * Initiates a payment session with UroPay Gateway.
 */
export async function initiateUropayPayment(params: InitiatePaymentParams) {
  const { amount, userId, userName, userEmail } = params;

  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);

    // Get Credentials from Firestore
    const gatewaySnap = await getDoc(doc(db, "globalSettings", "gateway"));
    const data = gatewaySnap.data();
    const apiKey = data?.uropayApiKey;
    const apiSecret = data?.uropayApiSecret;

    if (!apiKey) {
      return { success: false, error: "UroPay API Key not configured in Admin Panel." };
    }

    const orderId = `UP-${Date.now()}`;
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://' + (process.env.VERCEL_URL || 'localhost:9002')}/chat`;

    // Initialize temporary pending record in DB
    await addDoc(collection(db, "fundRequests"), {
      userId,
      userEmail,
      displayName: userName,
      amount,
      utrId: orderId, 
      status: 'Pending',
      type: 'Automated',
      createdAt: serverTimestamp()
    });

    // For prototype purposes, we construct the redirect URL
    // In production, you would fetch() to UroPay's order creation endpoint with the Secret
    const paymentUrl = `https://uropay.in/checkout?key=${apiKey}&amount=${amount}&client_txn_id=${orderId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    return { 
      success: true, 
      paymentUrl,
      orderId 
    };

  } catch (error: any) {
    console.error("UroPay Action Error:", error);
    return { success: false, error: "Gateway connection failed." };
  }
}

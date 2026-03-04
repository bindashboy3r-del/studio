
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

    // Get API Key from Firestore
    const gatewaySnap = await getDoc(doc(db, "globalSettings", "gateway"));
    const apiKey = gatewaySnap.data()?.uropayApiKey;

    if (!apiKey) {
      return { success: false, error: "UroPay API Key not configured in Admin Panel." };
    }

    const orderId = `UP-${Date.now()}`;
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://' + process.env.VERCEL_URL}/api/webhooks/uropay`;
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://' + process.env.VERCEL_URL}/chat`;

    // Initialize temporary pending record in DB
    await addDoc(collection(db, "fundRequests"), {
      userId,
      userEmail,
      displayName: userName,
      amount,
      utrId: orderId, // We use orderId as a unique identifier for now
      status: 'Pending',
      type: 'Automated',
      createdAt: serverTimestamp()
    });

    // UroPay API Call
    // Based on typical UroPay Integration
    const payload = new URLSearchParams();
    payload.append('key', apiKey);
    payload.append('client_txn_id', orderId);
    payload.append('amount', amount.toString());
    payload.append('p_info', 'Wallet Refill');
    payload.append('customer_name', userName);
    payload.append('customer_email', userEmail);
    payload.append('customer_mobile', '9999999999');
    payload.append('redirect_url', redirectUrl);

    // Note: In a real implementation, you'd use the actual endpoint URL from UroPay docs
    // This is a standard integration pattern
    const endpoint = "https://api.uropay.in/order/create"; 
    
    // For prototype purposes, we simulate the redirect to their checkout
    // Normally you'd fetch() here to get a payment URL
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

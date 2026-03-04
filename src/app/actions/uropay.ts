
'use server';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

interface InitiatePaymentParams {
  amount: number;
  userId: string;
}

/**
 * Initiates a payment session with UroPay Gateway.
 * Uses server-side safe initialization to avoid "initializeFirebase is on client" error.
 */
export async function initiateUropayPayment(params: InitiatePaymentParams) {
  const { amount, userId } = params;

  try {
    // Robust Server-side Firebase Initialization
    let app;
    if (getApps().length === 0) {
      try {
        app = initializeApp();
      } catch (e) {
        app = initializeApp(firebaseConfig);
      }
    } else {
      app = getApp();
    }
    
    const firestore = getFirestore(app);

    // Get Credentials from Firestore
    const gatewayRef = doc(firestore, "globalSettings", "gateway");
    const gatewaySnap = await getDoc(gatewayRef);
    
    if (!gatewaySnap.exists()) {
      return { success: false, error: "UroPay config not found in database. Please save settings in Admin Panel." };
    }

    const data = gatewaySnap.data();
    const apiKey = data?.uropayApiKey;
    const apiSecret = data?.uropayApiSecret;

    if (!apiKey) {
      return { success: false, error: "UroPay API Key is missing in Admin Panel -> Gateway Config." };
    }

    // Construct Unique Order ID
    const orderId = `UP-${Date.now()}-${userId.slice(0, 4)}`;
    
    // Construct Redirect URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://' + (process.env.VERCEL_URL || 'localhost:9002');
    const redirectUrl = `${baseUrl}/chat`;

    // UroPay Checkout URL Construction
    const paymentUrl = `https://uropay.in/checkout?key=${apiKey}&amount=${amount}&client_txn_id=${orderId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    return { 
      success: true, 
      paymentUrl,
      orderId 
    };

  } catch (error: any) {
    console.error("UroPay Server Action Error:", error);
    return { 
      success: false, 
      error: error.message || "Internal server error during payment initiation." 
    };
  }
}

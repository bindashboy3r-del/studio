
'use server';

import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface InitiatePaymentParams {
  amount: number;
  userId: string;
}

/**
 * Initiates a payment session with UroPay Gateway.
 * Fetches credentials from Firestore and returns the constructed payment URL.
 */
export async function initiateUropayPayment(params: InitiatePaymentParams) {
  const { amount, userId } = params;

  try {
    // Use the standard initialization utility
    const { firestore } = initializeFirebase();

    // Get Credentials from Firestore
    // Note: In some environments, server-side client SDK access might require public read rules 
    // or correct App Hosting service account setup.
    const gatewayRef = doc(firestore, "globalSettings", "gateway");
    const gatewaySnap = await getDoc(gatewayRef);
    
    if (!gatewaySnap.exists()) {
      return { success: false, error: "UroPay config not found in database. Please save settings in Admin Panel." };
    }

    const data = gatewaySnap.data();
    const apiKey = data?.uropayApiKey;
    const apiSecret = data?.uropayApiSecret;

    if (!apiKey || !apiSecret) {
      return { success: false, error: "UroPay API Key or Secret is missing in Admin Panel." };
    }

    // Construct Unique Order ID
    const orderId = `UP-${Date.now()}-${userId.slice(0, 4)}`;
    
    // Construct Redirect URL (Where user goes after payment)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://' + (process.env.VERCEL_URL || 'localhost:9002');
    const redirectUrl = `${baseUrl}/chat`;

    // UroPay Checkout URL Construction
    // For production, usually you'd sign this request, but following UroPay's basic redirect pattern:
    const paymentUrl = `https://uropay.in/checkout?key=${apiKey}&amount=${amount}&client_txn_id=${orderId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    return { 
      success: true, 
      paymentUrl,
      orderId 
    };

  } catch (error: any) {
    console.error("UroPay Action Error Details:", error);
    return { 
      success: false, 
      error: error.message || "Could not connect to database for credentials." 
    };
  }
}

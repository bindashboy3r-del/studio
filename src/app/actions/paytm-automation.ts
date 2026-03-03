
'use server';

/**
 * @fileOverview Server action to verify Paytm transactions via UTR/Transaction ID.
 * This simulates the integration with Paytm's Transaction Status API.
 */

export interface VerifyPaytmParams {
  utrId: string;
  amount: number;
  mid: string;
  merchantKey: string;
}

/**
 * Verifies a transaction using Paytm's Merchant API.
 * In a real-world scenario, you would use 'paytmchecksum' library and fetch().
 */
export async function verifyPaytmTransaction(params: VerifyPaytmParams) {
  const { utrId, amount, mid, merchantKey } = params;

  // IMPORTANT: This is a simulation of the Paytm API call.
  // In production, you would call: https://securegw.paytm.in/v3/order/status
  
  try {
    // We simulate a network delay for the API check
    await new Promise(resolve => setTimeout(resolve, 2000));

    // LOGIC: In a real app, you'd check if the response status is 'TXN_SUCCESS'
    // and if the amount matches what the user claims.
    
    // For this prototype, we consider the verification "Passed" if the UTR is 12 digits.
    // Replace this with actual API logic when you have your production credentials.
    const isMockValid = utrId.length === 12 && !utrId.startsWith('000'); 

    if (isMockValid) {
      return {
        success: true,
        txnId: utrId,
        status: 'TXN_SUCCESS',
        bankTxnId: 'BANK_' + utrId,
        message: 'Payment Verified Successfully via Paytm Gateway'
      };
    } else {
      return {
        success: false,
        message: 'Transaction not found or mismatched. Please check your UTR ID.'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: 'Paytm Server Busy. Please try again later.'
    };
  }
}

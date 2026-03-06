
import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * Webhook handler for UroPay payment confirmations.
 * Credits user balance with automatic bonus application.
 */
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { client_txn_id, status, amount, txn_id } = data;

    if (status === 'success' || status === 'TXN_SUCCESS') {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);

      // Find the pending fund request using the client_txn_id
      const q = query(collection(db, "fundRequests"), where("utrId", "==", client_txn_id), where("status", "==", "Pending"));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const requestDoc = snapshot.docs[0];
        const requestData = requestDoc.data();
        const userId = requestData.userId;

        // Fetch Global Bonus Settings
        const financeSnap = await getDoc(doc(db, "globalSettings", "finance"));
        const bonusPct = financeSnap.data()?.bonusPercentage || 0;
        
        // Calculate Total Credit
        const baseAmount = parseFloat(amount);
        const totalToCredit = baseAmount * (1 + bonusPct / 100);

        const batch = writeBatch(db);

        // 1. Update Request Status
        batch.update(requestDoc.ref, {
          status: 'Approved',
          gatewayTxnId: txn_id || 'AUTO',
          finalCreditAmount: totalToCredit,
          autoApproved: true,
          processedAt: serverTimestamp()
        });

        // 2. Increment User Balance
        const userRef = doc(db, "users", userId);
        batch.update(userRef, {
          balance: increment(totalToCredit)
        });

        // 3. Send Notification
        const notifRef = doc(collection(db, "users", userId, "notifications"));
        batch.set(notifRef, {
          title: '💰 Wallet Refill Successful!',
          message: `₹${totalToCredit.toFixed(0)} credited. Includes ${bonusPct}% bonus!`,
          read: false,
          createdAt: serverTimestamp()
        });

        // 4. Handle Referral Commission (5%)
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        if (userData?.referredBy) {
          const referrerId = userData.referredBy;
          const commission = baseAmount * 0.05;
          batch.update(doc(db, "users", referrerId), {
            referralEarnings: increment(commission)
          });
          batch.set(doc(collection(db, "referralTransactions")), {
            referrerId,
            fromUserId: userId,
            fromUserName: userData.displayName || 'Friend',
            depositAmount: baseAmount,
            commissionAmount: commission,
            createdAt: serverTimestamp()
          });
        }

        await batch.commit();
        console.log(`Auto-credited ${totalToCredit} to ${userId}`);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error("UroPay Webhook Error:", error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

'use server';
/**
 * @fileOverview Genkit flow for the SocialBoost Support Bot.
 * Handles order status lookups, pricing queries, and payment info.
 *
 * - supportBot - Main function to handle support queries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit, collectionGroup } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * Tool to retrieve order details from the database.
 */
const getOrderDetails = ai.defineTool(
  {
    name: 'getOrderDetails',
    description: 'Retrieves details for a specific SocialBoost order using its Order ID (e.g., SB-123456).',
    inputSchema: z.object({
      orderId: z.string().describe('The Order ID to look up (starts with SB-).'),
    }),
    outputSchema: z.object({
      found: z.boolean().describe('Whether the order was found.'),
      status: z.string().optional().describe('The current status of the order.'),
      service: z.string().optional().describe('The name of the service ordered.'),
      quantity: z.number().optional().describe('The quantity ordered.'),
      price: z.number().optional().describe('The price paid for the order.'),
      message: z.string().optional().describe('Additional information or error message.'),
    }),
  },
  async (input) => {
    try {
      // Initialize Firebase for server-side lookup
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);

      const cleanId = input.orderId.trim().toUpperCase();
      
      // Use collectionGroup to find the order across all user subcollections
      const q = query(collectionGroup(db, 'orders'), where('orderId', '==', cleanId), limit(1));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return {
          found: true,
          status: data.status || 'Pending',
          service: data.service,
          quantity: data.quantity,
          price: data.price,
        };
      }
      
      return { 
        found: false, 
        message: `Maafi chahte hain, order ID ${cleanId} nahi mil raha hai. Kripya check karein ki ID sahi hai ya History page dekhein. 😔` 
      };
    } catch (e: any) {
      return { 
        found: false, 
        message: "Server busy hai, kripya thodi der baad try karein ya Instagram par contact karein. 😔" 
      };
    }
  }
);

const SupportBotInputSchema = z.object({
  message: z.string().describe('The user\'s message to the support bot.'),
  userId: z.string().describe('The ID of the currently logged-in user.'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string()
  })).optional(),
});

const SupportBotOutputSchema = z.object({
  reply: z.string().describe('The AI bot\'s response text.'),
  action: z.enum(['none', 'show_qr', 'redirect_orders']).default('none').describe('Special UI actions to trigger.'),
});

const supportBotPrompt = ai.definePrompt({
  name: 'supportBotPrompt',
  input: { schema: SupportBotInputSchema },
  output: { schema: SupportBotOutputSchema },
  tools: [getOrderDetails],
  prompt: `You are the SocialBoost Pro AI Assistant. You are friendly, powerful, and talk in Hinglish.

CAPABILITIES:
1. ORDER STATUS: If a user gives an Order ID (like SB-123456), use getOrderDetails to find it. Tell them exactly what is happening (Pending, Processing, or Complete).
2. PAYMENTS: For UPI help, give UPI ID "smmxpressbot@slc".
3. NO MANUAL MONEY ADD: If a user asks "paisa add kar do", "mera balance badha do", or "I paid but money not added", DO NOT try to add money. Tell them clearly that ONLY the admin can do this. Give them the admin's Instagram: @social_boost.bot or tell them to wait 30-60 mins for verification.
4. PRICING: Instagram Followers @ ₹89/1k, Likes @ ₹18/1k, Views @ ₹0.60/1k.
5. TONE: Use emojis, be respectful, and speak in Hinglish (Hindi written in English).

User Message: "{{{message}}}"
User ID: "{{{userId}}}"`,
});

export async function supportBot(input: z.infer<typeof SupportBotInputSchema>): Promise<z.infer<typeof SupportBotOutputSchema>> {
  try {
    const { output } = await supportBotPrompt(input);
    if (!output) throw new Error('No output from model');
    return output;
  } catch (error) {
    console.error('SupportBot Flow Error:', error);
    return {
      reply: "Sorry, kuch technical issue hai. Kripya admin ko @social_boost.bot par contact karein. 😔",
      action: 'none'
    };
  }
}

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
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
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
      userId: z.string().describe('The ID of the currently logged-in user.'),
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
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);

      const cleanId = input.orderId.trim().toUpperCase();
      
      const userOrdersRef = collection(db, 'users', input.userId, 'orders');
      const qUser = query(userOrdersRef, where('orderId', '==', cleanId), limit(1));
      const snapshotUser = await getDocs(qUser);
      
      if (!snapshotUser.empty) {
        const data = snapshotUser.docs[0].data();
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
        message: `Aapka order ${cleanId} abhi nahi mil pa raha hai. Kripya check karein ki ID sahi hai ya thodi der baad koshish karein. Aap @social_boost.bot ko Instagram par bhi contact kar sakte hain. 😔` 
      };
    } catch (e: any) {
      return { 
        found: false, 
        message: "Aapka order detail fetch karne mein dikkat aa rahi hai. Kripya thodi der baad koshish karein ya @social_boost.bot ko Instagram par contact karein. 😔" 
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
  prompt: `You are the SocialBoost Full-Service Support Bot, a professional and friendly AI assistant.
Your goal is to help users with EVERYTHING related to SocialBoost: orders, pricing, payments, and general help.

PRICING DATA (Use this to calculate costs for any quantity):
- Instagram Followers: ₹89 per 1000
- Instagram Likes: ₹18 per 1000
- Instagram Views: ₹0.60 per 1000
- Instagram Shares: ₹7 per 1000
- Instagram Story Views: ₹65 per 1000
- Instagram Comments: ₹260 per 1000
- Instagram Reel Views: ₹0.56 per 1000
- YouTube Likes: ₹136 per 1000
- YouTube Views: ₹124 per 1000
- Others: "Coming Soon"

GUIDELINES:
1. GREETINGS: If the user says "Hi", "Hello", or "Start", respond warmly in Hinglish and ask how you can help. DO NOT call tools for greetings.
2. PRICING QUERIES: If a user asks "How much for X followers/likes?", calculate the price (Qty/1000 * PricePer1000) and tell them clearly.
3. ORDER STATUS: If a user provides an Order ID (SB-XXXXXX), ALWAYS use getOrderDetails.
4. PAYMENTS: For "Add Funds" or "QR code", give UPI ID "smmxpressbot@slc" and suggest clicking "Add Funds" in the header.
5. INSTAGRAM SUPPORT: For manual help, always point to @social_boost.bot on Instagram.
6. TONE: Use Hinglish (Hindi written in English), be helpful, and use emojis! 🚀

User Message: "{{{message}}}"
User ID: "{{{userId}}}"`,
});

export async function supportBot(input: z.infer<typeof SupportBotInputSchema>): Promise<z.infer<typeof SupportBotOutputSchema>> {
  try {
    const { output } = await supportBotPrompt(input);
    if (!output) {
      return {
        reply: "Aapka message samajhne mein thodi dikkat hui. Kripya phir se koshish karein ya @social_boost.bot ko Instagram par contact karein. 😔",
        action: 'none'
      };
    }
    return output;
  } catch (error) {
    return {
      reply: "Aapka order detail fetch karne mein dikkat aa rahi hai. Kripya thodi der baad koshish karein ya @social_boost.bot ko Instagram par contact karein. 😔",
      action: 'none'
    };
  }
}

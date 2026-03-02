'use server';
/**
 * @fileOverview Genkit flow for the SocialBoost Support Bot.
 * Handles order status lookups and payment information queries.
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
      // Ensure Firebase is initialized for server-side execution
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const db = getFirestore(app);

      // Clean the Order ID
      const cleanId = input.orderId.trim().toUpperCase();
      
      // Primary Search: Search the user's specific collection
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
  prompt: `You are the SocialBoost Support Bot, a professional and friendly AI assistant.
Your goal is to help users with their SMM orders and wallet balances.

GUIDELINES:
1. If the user just says "Hi" or greets you, respond politely in Hinglish and ask how you can help. DO NOT call any tools for simple greetings.
2. If a user provides an Order ID (starts with SB-), ALWAYS use the getOrderDetails tool.
3. If the tool finds the order, explain the status (Pending, Processing, Completed, or Rejected) clearly.
4. For payment help, give UPI ID "smmxpressbot@slc" and suggest clicking "Add Funds" in the header.
5. If the user is frustrated or there's an error, suggest contacting @social_boost.bot on Instagram.
6. Keep responses concise. Use Hinglish and emojis! 🚀

User Message: "{{{message}}}"
User ID: "{{{userId}}}"`,
});

const supportBotFlow = ai.defineFlow(
  {
    name: 'supportBotFlow',
    inputSchema: SupportBotInputSchema,
    outputSchema: SupportBotOutputSchema,
  },
  async (input) => {
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
);

export async function supportBot(input: z.infer<typeof SupportBotInputSchema>): Promise<z.infer<typeof SupportBotOutputSchema>> {
  return supportBotFlow(input);
}

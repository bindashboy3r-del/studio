'use server';
/**
 * @fileOverview Genkit flow for the SocialBoost Support Bot.
 * Handles order status lookups and payment information queries.
 *
 * - supportBot - Main function to handle support queries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, collectionGroup, query, where, getDocs, limit } from 'firebase/firestore';
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
      userId: z.string().describe('The ID of the currently logged-in user to help find their specific order.'),
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
      // Initialize Firebase inside the tool to ensure it's ready on the server
      if (!getApps().length) {
        initializeApp(firebaseConfig);
      }
      const db = getFirestore();

      // Clean the Order ID
      const cleanId = input.orderId.trim().toUpperCase();
      
      // Step 1: Try searching the user's specific collection (fastest, no index required)
      const userOrdersRef = collection(db, 'users', input.userId, 'orders');
      const qUser = query(userOrdersRef, where('orderId', '==', cleanId), limit(1));
      const snapshotUser = await getDocs(qUser);
      
      let orderDoc = !snapshotUser.empty ? snapshotUser.docs[0] : null;

      // Step 2: Fallback to collection group search if not found in current user's (e.g. if they logged in with a different email)
      if (!orderDoc) {
        const qGroup = query(
          collectionGroup(db, 'orders'),
          where('orderId', '==', cleanId),
          limit(1)
        );
        const snapshotGroup = await getDocs(qGroup);
        if (!snapshotGroup.empty) {
          orderDoc = snapshotGroup.docs[0];
        }
      }
      
      if (!orderDoc) {
        return { 
          found: false, 
          message: `Aapka order ${cleanId} abhi nahi mil pa raha hai, database mein kuch error aa raha hai. Kripya thodi der baad phir se koshish karein ya @bindash_boy3 ko Instagram par contact karein. 😔` 
        };
      }
      
      const data = orderDoc.data();
      return {
        found: true,
        status: data.status || 'Pending',
        service: data.service,
        quantity: data.quantity,
        price: data.price,
      };
    } catch (e: any) {
      console.error("Support bot tool error:", e);
      return { 
        found: false, 
        message: "Database search failed. Kripya thodi der baad phir se koshish karein ya @bindash_boy3 ko Instagram par contact karein. 😔" 
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
  prompt: `You are the SocialBoost Support Bot, a helpful and professional AI assistant.
Your goal is to help users with their SMM orders and wallet balances.

GUIDELINES:
1. If a user provides an Order ID (e.g., SB-123456), ALWAYS use the getOrderDetails tool. Pass both the Order ID and the current User ID to the tool.
2. If the tool finds the order, explain the current status (Pending, Processing, Completed, or Rejected) clearly to the user.
3. If the tool returns found: false or if there is any error, use the exact Hinglish message provided by the tool to inform the user.
4. If they ask how to add money or for a QR code, provide the UPI ID "smmxpressbot@slc" and suggest they click the "Add Funds" button in the header.
5. If they ask for help or the bot is confused, suggest contacting the owner @bindash_boy3 on Instagram.
6. Keep responses concise and friendly. Use Hinglish (Hindi written in English script) as the user prefers. Use emojis! 🚀

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
    const { output } = await supportBotPrompt(input);
    if (!output) {
      throw new Error('Failed to generate response from Support Bot.');
    }
    return output;
  }
);

export async function supportBot(input: z.infer<typeof SupportBotInputSchema>): Promise<z.infer<typeof SupportBotOutputSchema>> {
  return supportBotFlow(input);
}

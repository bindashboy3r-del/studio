'use server';
/**
 * @fileOverview Genkit flow for the SocialBoost Support Bot.
 * Handles order status lookups and payment information queries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Note: In a real production environment, service account would be configured.
// For this prototype, we assume the environment is pre-configured for Admin SDK access 
// or we use the client-side context passed from the frontend.
// Since we are in a server action, we can use admin SDK to check orders if needed,
// but for simplicity and safety in this studio environment, we will process logic 
// and let the frontend handle the final data display if complex.

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

export async function supportBot(input: z.infer<typeof SupportBotInputSchema>) {
  return supportBotFlow(input);
}

const supportBotPrompt = ai.definePrompt({
  name: 'supportBotPrompt',
  input: { schema: SupportBotInputSchema },
  output: { schema: SupportBotOutputSchema },
  prompt: `You are the SocialBoost Support Bot, a helpful and professional AI assistant.
Your goal is to help users with their SMM orders and wallet balances.

GUIDELINES:
1. If a user asks about an order (especially a cancelled one), ask for their Order ID.
2. If they provide an Order ID (e.g., SB-123456), tell them you can't look up live DB data directly yet but they should check the "Order History" page for the specific rejection reason left by the admin.
3. If they ask how to add money, add funds, or for a QR code, provide the UPI ID "smmxpressbot@slc" and suggest they click the "Add Funds" button in the chat header for an automated QR.
4. Keep responses concise and friendly.
5. Use emojis to be engaging.

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
    return output!;
  }
);

'use server';
/**
 * @fileOverview This file implements a Genkit flow for parsing natural language service requests
 * into structured data for SMM services (Instagram/YouTube).
 *
 * - intelligentOrderParsing - A function to parse user requests.
 * - IntelligentOrderParsingInput - The input type for the intelligentOrderParsing function.
 * - IntelligentOrderParsingOutput - The return type for the intelligentOrderParsing function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IntelligentOrderParsingInputSchema = z.object({
  requestText: z.string().describe('The user\'s natural language request for SMM services.'),
});
export type IntelligentOrderParsingInput = z.infer<typeof IntelligentOrderParsingInputSchema>;

const IntelligentOrderParsingOutputSchema = z.object({
  platform: z.enum(['instagram', 'youtube']).describe('The social media platform for the service. Must be "instagram" or "youtube".'),
  service: z.enum([
    'followers', 'likes', 'views', 'comments', 'shares', 'story_views', 'reel_views', // Instagram services
    'subscribers', // YouTube services
  ]).describe('The specific SMM service requested. Valid services for Instagram: "followers", "likes", "views", "comments", "shares", "story_views", "reel_views". Valid services for YouTube: "subscribers", "likes", "views", "comments", "shares".'),
  quantity: z.number().int().positive().describe('The desired quantity for the service (e.g., 1000 for 1000 followers).'),
  link: z.string().url().or(z.string().regex(/^@[a-zA-Z0-9_.]+$/)).describe('The link (URL to post/video/profile) or username (starting with @) related to the service.'),
}).describe('Parsed service request details including platform, service type, quantity, and associated link.');
export type IntelligentOrderParsingOutput = z.infer<typeof IntelligentOrderParsingOutputSchema>;

const intelligentOrderParsingPrompt = ai.definePrompt({
  name: 'intelligentOrderParsingPrompt',
  input: { schema: IntelligentOrderParsingInputSchema },
  output: { schema: IntelligentOrderParsingOutputSchema },
  prompt: `You are an SMM Panel Bot for SocialBoost designed to understand user requests in natural language and extract specific details for ordering social media marketing services.
Your task is to parse the user's request and identify the 'platform', 'service', 'quantity', and 'link'.

Supported platforms:
- Instagram: "instagram"
- YouTube: "youtube"

Supported Instagram services:
- Followers: "followers"
- Likes: "likes"
- Views: "views"
- Comments: "comments"
- Shares: "shares"
- Story Views: "story_views"
- Reel Views: "reel_views"

Supported YouTube services:
- Subscribers: "subscribers"
- Likes: "likes"
- Views: "views"
- Comments: "comments"
- Shares: "shares"

For the 'link' field:
- If the platform is Instagram, the link can be a URL to a post/profile/story/reel, or an Instagram username starting with '@' (e.g., "@myprofile").
- If the platform is YouTube, the link should be a URL to a video or channel.

Extract the details accurately in a JSON object.

User's Request: "{{{requestText}}}"`,
});

const intelligentOrderParsingFlow = ai.defineFlow(
  {
    name: 'intelligentOrderParsingFlow',
    inputSchema: IntelligentOrderParsingInputSchema,
    outputSchema: IntelligentOrderParsingOutputSchema,
  },
  async (input) => {
    const { output } = await intelligentOrderParsingPrompt(input);
    if (!output) {
      throw new Error('Failed to parse the order request.');
    }
    return output;
  }
);

export async function intelligentOrderParsing(input: IntelligentOrderParsingInput): Promise<IntelligentOrderParsingOutput> {
  return intelligentOrderParsingFlow(input);
}

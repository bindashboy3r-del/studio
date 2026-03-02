export type Platform = 'instagram';

export interface SMMService {
  id: string;
  name: string;
  pricePer1000: number; // -1 indicates unavailable/Coming Soon
}

export const PLATFORMS: Record<Platform, string> = {
  instagram: 'Instagram',
};

export const SERVICES: Record<Platform, SMMService[]> = {
  instagram: [
    { id: 'followers', name: 'Followers', pricePer1000: 89.0 },
    { id: 'likes', name: 'Likes', pricePer1000: 18.0 },
    { id: 'views', name: 'Views', pricePer1000: 0.60 },
    { id: 'comments', name: 'Comments', pricePer1000: 260.0 },
    { id: 'shares', name: 'Shares', pricePer1000: 7.0 },
    { id: 'story_views', name: 'Story Views', pricePer1000: 65.0 },
    { id: 'reel_views', name: 'Reel Views', pricePer1000: 0.56 },
  ],
};

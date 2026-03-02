export type Platform = 'instagram' | 'youtube';

export interface SMMService {
  id: string;
  name: string;
  pricePer1000: number;
}

export const PLATFORMS: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export const SERVICES: Record<Platform, SMMService[]> = {
  instagram: [
    { id: 'followers', name: 'Followers', pricePer1000: 90.0 }, // 100 = ₹9
    { id: 'likes', name: 'Likes', pricePer1000: 40.0 },
    { id: 'views', name: 'Views', pricePer1000: 20.0 },
    { id: 'comments', name: 'Comments', pricePer1000: 250.0 },
    { id: 'shares', name: 'Shares', pricePer1000: 60.0 },
    { id: 'story_views', name: 'Story Views', pricePer1000: 30.0 },
    { id: 'reel_views', name: 'Reel Views', pricePer1000: 25.0 },
  ],
  youtube: [
    { id: 'subscribers', name: 'Subscribers', pricePer1000: 1200.0 },
    { id: 'likes', name: 'Likes', pricePer1000: 350.0 },
    { id: 'views', name: 'Views', pricePer1000: 280.0 },
    { id: 'comments', name: 'Comments', pricePer1000: 500.0 },
  ],
};

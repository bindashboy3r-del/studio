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
    { id: 'followers', name: 'Followers', pricePer1000: 5.0 },
    { id: 'likes', name: 'Likes', pricePer1000: 1.5 },
    { id: 'views', name: 'Views', pricePer1000: 0.5 },
    { id: 'comments', name: 'Comments', pricePer1000: 10.0 },
    { id: 'shares', name: 'Shares', pricePer1000: 2.5 },
    { id: 'story_views', name: 'Story Views', pricePer1000: 0.8 },
    { id: 'reel_views', name: 'Reel Views', pricePer1000: 0.6 },
  ],
  youtube: [
    { id: 'subscribers', name: 'Subscribers', pricePer1000: 45.0 },
    { id: 'likes', name: 'Likes', pricePer1000: 8.0 },
    { id: 'views', name: 'Views', pricePer1000: 4.5 },
    { id: 'comments', name: 'Comments', pricePer1000: 15.0 },
    { id: 'shares', name: 'Shares', pricePer1000: 12.0 },
  ],
};

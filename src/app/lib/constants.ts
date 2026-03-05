export interface SMMService {
  id: string;
  name: string;
  platform: Platform;
  pricePer1000: number; 
  minQuantity: number;
  order?: number;
  isActive?: boolean;
}

export type Platform = 'instagram' | 'youtube' | 'facebook' | 'tiktok' | 'twitter';

export const PLATFORMS: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  twitter: 'Twitter'
};

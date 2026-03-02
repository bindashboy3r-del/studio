
'use server';

/**
 * @fileOverview Server actions for communicating with external SMM Panel APIs.
 */

export interface ApiAddOrderParams {
  apiUrl: string;
  apiKey: string;
  serviceId: string;
  link: string;
  quantity: number;
}

/**
 * Places an order on an external SMM Panel.
 */
export async function placeApiOrder(params: ApiAddOrderParams) {
  const { apiUrl, apiKey, serviceId, link, quantity } = params;

  try {
    const url = new URL(apiUrl);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('action', 'add');
    url.searchParams.append('service', serviceId);
    url.searchParams.append('link', link);
    url.searchParams.append('quantity', quantity.toString());

    const response = await fetch(url.toString(), { method: 'POST' });
    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, order: data.order };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to connect to SMM API' };
  }
}

/**
 * Fetches the current balance from an external SMM Panel.
 */
export async function getApiBalance(apiUrl: string, apiKey: string) {
  try {
    const url = new URL(apiUrl);
    url.searchParams.append('key', apiKey);
    url.searchParams.append('action', 'balance');

    const response = await fetch(url.toString(), { method: 'POST' });
    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, balance: data.balance, currency: data.currency };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch balance' };
  }
}

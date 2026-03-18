
'use server';

/**
 * @fileOverview Server actions for communicating with external SMM Panel APIs.
 * Updated to be fully compatible with standard SMM Panel API v2.
 */

export interface ApiAddOrderParams {
  apiUrl: string;
  apiKey: string;
  serviceId: string;
  link: string;
  quantity: number;
  runs?: number;
  interval?: number;
}

/**
 * Places an order on an external SMM Panel using standard API parameters.
 * Uses application/x-www-form-urlencoded which is mandatory for most panels.
 */
export async function placeApiOrder(params: ApiAddOrderParams) {
  const { apiUrl, apiKey, serviceId, link, quantity, runs, interval } = params;

  try {
    if (!apiUrl || !apiKey || !serviceId) {
      return { success: false, error: 'API credentials or Service ID missing in Admin Hub.' };
    }

    // Ensure URL is clean
    const cleanUrl = apiUrl.trim();
    
    // Standard SMM Panel parameters: key, action, service, link, quantity
    const body = new URLSearchParams();
    body.append('key', apiKey.trim());
    body.append('action', 'add');
    body.append('service', serviceId.trim());
    body.append('link', link.trim());
    body.append('quantity', quantity.toString());

    // Add Drip-Feed parameters if provided and valid
    if (runs && runs > 1) {
      body.append('runs', runs.toString());
      body.append('interval', interval?.toString() || '15');
    }

    console.log(`[API CALL] Connecting to: ${cleanUrl} for Service ID: ${serviceId}`);

    const response = await fetch(cleanUrl, {
      method: 'POST',
      body: body.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SocialBoost-Pro-V1',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Panel Error (${response.status}): ${errorText.slice(0, 50) || 'Unknown Server Error'}` };
    }

    const data = await response.json();

    if (data.error) {
      return { success: false, error: `API Response: ${data.error}` };
    }

    if (!data.order) {
      return { success: false, error: data.message || 'No Order ID returned from API panel. Check credentials.' };
    }

    return { success: true, order: data.order };
  } catch (error: any) {
    console.error('CRITICAL API ERROR:', error);
    return { success: false, error: `Connection Failed: ${error.message || 'Check API URL and Network'}` };
  }
}

/**
 * Fetches the current balance from an external SMM Panel.
 */
export async function getApiBalance(apiUrl: string, apiKey: string) {
  try {
    const body = new URLSearchParams();
    body.append('key', apiKey.trim());
    body.append('action', 'balance');

    const response = await fetch(apiUrl.trim(), {
      method: 'POST',
      body: body.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      cache: 'no-store'
    });
    
    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, balance: data.balance, currency: data.currency };
  } catch (error: any) {
    return { success: false, error: 'Could not connect to provider.' };
  }
}

/**
 * Fetches multiple order statuses from an external SMM Panel.
 */
export async function getApiOrdersStatus(apiUrl: string, apiKey: string, apiOrderIds: string) {
  try {
    const body = new URLSearchParams();
    body.append('key', apiKey.trim());
    body.append('action', 'status');
    body.append('orders', apiOrderIds);

    const response = await fetch(apiUrl.trim(), {
      method: 'POST',
      body: body.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      cache: 'no-store'
    });
    
    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, statuses: data };
  } catch (error: any) {
    return { success: false, error: 'Failed to fetch statuses' };
  }
}

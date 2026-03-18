
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
  runs?: number;
  interval?: number;
}

/**
 * Places an order on an external SMM Panel using standard API parameters.
 * Uses FormData via URLSearchParams for compatibility with zyadatar SMM panels.
 */
export async function placeApiOrder(params: ApiAddOrderParams) {
  const { apiUrl, apiKey, serviceId, link, quantity, runs, interval } = params;

  try {
    // Standard SMM Panel parameters: key, action, service, link, quantity
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('action', 'add');
    formData.append('service', serviceId);
    formData.append('link', link);
    formData.append('quantity', quantity.toString());

    // Add Drip-Feed parameters if provided and valid
    if (runs && runs > 1) {
      formData.append('runs', runs.toString());
      formData.append('interval', interval?.toString() || '15');
    }

    console.log(`Connecting to SMM API: ${apiUrl} for service ${serviceId}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText || 'Server Error'}` };
    }

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    if (!data.order) {
      return { success: false, error: data.message || 'No order ID returned from API panel.' };
    }

    return { success: true, order: data.order };
  } catch (error: any) {
    console.error('CRITICAL API ERROR:', error);
    return { success: false, error: error.message || 'Failed to connect to SMM Provider. Check URL/Key.' };
  }
}

/**
 * Fetches the current balance from an external SMM Panel.
 */
export async function getApiBalance(apiUrl: string, apiKey: string) {
  try {
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('action', 'balance');

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, balance: data.balance, currency: data.currency };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch balance' };
  }
}

/**
 * Fetches multiple order statuses from an external SMM Panel.
 */
export async function getApiOrdersStatus(apiUrl: string, apiKey: string, apiOrderIds: string) {
  try {
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('action', 'status');
    formData.append('orders', apiOrderIds);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, statuses: data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch statuses' };
  }
}

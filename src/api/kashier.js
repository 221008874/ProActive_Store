// src/api/kashier.js - FIXED VERSION
const API_URL = import.meta.env.VITE_API_URL || '';

export const kashierApi = {
  async createPayment(paymentData) {
    try {
      // FIX: Handle URL construction properly
      let endpoint;
      
      if (!API_URL) {
        // Local development - proxy to Vercel
        endpoint = 'https://elhamdindustriesegp.vercel.app/api/payment/kashier';
      } else {
        // Use configured API URL
        endpoint = `${API_URL}/payment/kashier`;
      }
      
      console.log('🚀 Endpoint:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('❌ HTTP Error:', response.status, text);
        throw new Error(`Server error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text.substring(0, 500));
        throw new Error('Server error: Invalid response format');
      }

      const data = await response.json();

      if (!data.success || !data.checkoutUrl) {
        throw new Error(data.error || 'Invalid response from server');
      }

      console.log('✅ Payment session created');
      return data;

    } catch (error) {
      console.error('❌ Kashier API Error:', error);
      throw error;
    }
  }
};

export default kashierApi;
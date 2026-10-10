import { useState } from 'react';
import { kashierApi } from '../api/kashier';

function KashierPayment({ orderDetails }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Prepare payment data
      const paymentData = {
        amount: orderDetails.total,
        currency: 'EGP',
        customerEmail: orderDetails.customerEmail,
        customerPhone: orderDetails.customerPhone,
        orderId: orderDetails.orderId,
        description: `Order #${orderDetails.orderId} - ${orderDetails.storeName}`
      };

      // Call backend to create payment
      const result = await kashierApi.createPayment(paymentData);

      if (result.success && result.checkoutUrl) {
        // Redirect to Kashier hosted checkout
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error('Failed to create checkout session');
      }

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="kashier-payment">
      <div className="order-summary">
        <h3>Order Summary</h3>
        <p>Order ID: {orderDetails.orderId}</p>
        <p>Amount: {orderDetails.total} EGP</p>
        <p>Email: {orderDetails.customerEmail}</p>
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '10px 0' }}>
          {error}
        </div>
      )}

      <button 
        onClick={handlePayment}
        disabled={loading}
        style={{
          padding: '12px 24px',
          backgroundColor: loading ? '#ccc' : '#00a86b',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px'
        }}
      >
        {loading ? 'Processing...' : `Pay ${orderDetails.total} EGP`}
      </button>

      <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        Secure payment powered by Kashier (Test Mode)
      </p>
    </div>
  );
}

export default KashierPayment;
// services/orderService.js
import { db } from './firebase'; // Your existing client config
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function createOrder(orderData) {
  try {
    // 1. Create the main order
    const orderRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      createdAt: serverTimestamp(),
      status: 'pending'
    });

    // 2. Create notifier entry (triggers mobile app)
    await setDoc(doc(db, 'order_notifier', orderRef.id), {
      orderId: orderRef.id,
      customerName: orderData.customerName || 'Guest',
      customerPhone: orderData.customerPhone || '',
      totalAmount: orderData.totalAmount,
      items: orderData.items?.map(i => i.name) || [],
      itemCount: orderData.items?.length || 0,
      status: 'new', // new, processing, ready
      createdAt: serverTimestamp(),
      timestamp: Date.now(), // For easy sorting
      notified: false
    });

    console.log('✅ Order and notifier created:', orderRef.id);
    return { success: true, orderId: orderRef.id };

  } catch (error) {
    console.error('❌ Order creation failed:', error);
    throw error;
  }
}
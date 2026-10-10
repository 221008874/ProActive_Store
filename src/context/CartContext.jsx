// src/context/CartContext.jsx
import { createContext, useContext, useReducer, useCallback, useState, useEffect } from 'react'

const CartContext = createContext()

// Action Types
const ADD_ITEM = 'ADD_ITEM'
const REMOVE_ITEM = 'REMOVE_ITEM'
const UPDATE_QUANTITY = 'UPDATE_QUANTITY'
const CLEAR_CART = 'CLEAR_CART'
const SET_ERROR = 'SET_ERROR'
const CLEAR_ERROR = 'CLEAR_ERROR'
const SET_DELIVERY_INFO = 'SET_DELIVERY_INFO'
const CLEAR_DELIVERY_INFO = 'CLEAR_DELIVERY_INFO'
const SET_APPLIED_COUPON = 'SET_APPLIED_COUPON'  // ADDED
const CLEAR_APPLIED_COUPON = 'CLEAR_APPLIED_COUPON'  // ADDED

const cartReducer = (state, action) => {
  switch (action.type) {
    case SET_DELIVERY_INFO:
      return {
        ...state,
        deliveryInfo: action.payload
      }
    
    case CLEAR_DELIVERY_INFO:
      return {
        ...state,
        deliveryInfo: null
      }

    case SET_APPLIED_COUPON:  // ADDED
      return {
        ...state,
        appliedCoupon: action.payload
      }

    case CLEAR_APPLIED_COUPON:  // ADDED
      return {
        ...state,
        appliedCoupon: null
      }
      
    case ADD_ITEM: {
      const { product, quantity = 1 } = action.payload
      const existingItem = state.items.find(item => item.id === product.id)
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity
        if (newQuantity > product.stock) {
          return {
            ...state,
            error: {
              type: 'STOCK_LIMIT',
              message: `Only ${product.stock} available. You already have ${existingItem.quantity} in cart.`,
              productId: product.id
            }
          }
        }
        
        return {
          ...state,
          items: state.items.map(item =>
            item.id === product.id
              ? { ...item, quantity: newQuantity }
              : item
          ),
          error: null
        }
      } else {
        return {
          ...state,
          items: [...state.items, { ...product, quantity }],
          error: null
        }
      }
    }
    
    case REMOVE_ITEM:
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload.id),
        error: null
      }
      
    case UPDATE_QUANTITY: {
      const { id, quantity, stock } = action.payload
      
      if (quantity > stock) {
        return {
          ...state,
          error: {
            type: 'STOCK_LIMIT',
            message: `Only ${stock} units available`,
            productId: id
          }
        }
      }
      
      return {
        ...state,
        items: state.items.map(item =>
          item.id === id
            ? { ...item, quantity: Math.max(0, quantity) }
            : item
        ).filter(item => item.quantity > 0),
        error: null
      }
    }
    
    case CLEAR_CART:
      return { 
        ...state, 
        items: [],
        error: null,
        appliedCoupon: null  // Also clear coupon when cart is cleared
      }
      
    case SET_ERROR:
      return {
        ...state,
        error: action.payload
      }
      
    case CLEAR_ERROR:
      return {
        ...state,
        error: null
      }
      
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, {
    items: [],
    error: null,
    deliveryInfo: null,
    appliedCoupon: null  // ADDED: Initialize coupon in state
  })

  // FIXED: Use useEffect for localStorage operations (side effects)
  const [appliedCoupon, setAppliedCouponState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('appliedCoupon')
        return saved ? JSON.parse(saved) : null
      } catch (e) {
        console.error('Error parsing saved coupon:', e)
        return null
      }
    }
    return null
  })

  // Persist coupon to localStorage and sync with reducer
  useEffect(() => {
    if (appliedCoupon) {
      localStorage.setItem('appliedCoupon', JSON.stringify(appliedCoupon))
      dispatch({ type: SET_APPLIED_COUPON, payload: appliedCoupon })
    } else {
      localStorage.removeItem('appliedCoupon')
      dispatch({ type: CLEAR_APPLIED_COUPON })
    }
  }, [appliedCoupon])

  const setAppliedCoupon = useCallback((coupon) => {
    setAppliedCouponState(coupon)
  }, [])

  const clearAppliedCoupon = useCallback(() => {
    setAppliedCouponState(null)
  }, [])

  const addToCart = useCallback((product, quantity = 1) => {
    if (!product) {
      dispatch({ 
        type: SET_ERROR, 
        payload: { type: 'INVALID_PRODUCT', message: 'Invalid product' }
      })
      return { success: false, message: 'Invalid product' }
    }

    if (!product.stock || product.stock <= 0) {
      dispatch({ 
        type: SET_ERROR, 
        payload: { 
          type: 'OUT_OF_STOCK', 
          message: `${product.name} is out of stock`,
          productId: product.id
        }
      })
      return { success: false, message: 'Out of stock', type: 'OUT_OF_STOCK' }
    }

    if (quantity > product.stock) {
      dispatch({ 
        type: SET_ERROR, 
        payload: { 
          type: 'INSUFFICIENT_STOCK', 
          message: `Only ${product.stock} units available`,
          productId: product.id
        }
      })
      return { success: false, message: `Only ${product.stock} available`, type: 'INSUFFICIENT_STOCK', availableStock: product.stock }
    }

    const existingItem = cart.items.find(item => item.id === product.id)
    const currentCartQuantity = existingItem ? existingItem.quantity : 0
    
    if (currentCartQuantity + quantity > product.stock) {
      const canAdd = product.stock - currentCartQuantity
      const message = canAdd > 0 
        ? `Only ${canAdd} more can be added (you have ${currentCartQuantity} in cart)`
        : `You already have ${currentCartQuantity} in cart (stock limit: ${product.stock})`
      
      dispatch({ 
        type: SET_ERROR, 
        payload: { type: 'CART_LIMIT', message, productId: product.id, canAdd }
      })
      return { success: false, message, type: 'CART_LIMIT', canAdd, currentInCart: currentCartQuantity, stock: product.stock }
    }

    dispatch({ type: ADD_ITEM, payload: { product, quantity }})
    return { success: true, message: `Added ${quantity} × ${product.name} to cart`, added: quantity, totalInCart: currentCartQuantity + quantity }
  }, [cart.items])

  const removeFromCart = useCallback((productId) => {
    dispatch({ type: REMOVE_ITEM, payload: { id: productId } })
  }, [])

  const updateQuantity = useCallback((productId, quantity, stock) => {
    if (quantity < 0) return
    dispatch({ type: UPDATE_QUANTITY, payload: { id: productId, quantity, stock }})
    const item = cart.items.find(i => i.id === productId)
    if (item && quantity > stock) {
      return { success: false, message: `Only ${stock} available`, maxAllowed: stock }
    }
    return { success: true }
  }, [cart.items])

  const clearCart = useCallback(() => {
    dispatch({ type: CLEAR_CART })
    clearAppliedCoupon()
  }, [clearAppliedCoupon])

  const clearError = useCallback(() => {
    dispatch({ type: CLEAR_ERROR })
  }, [])

  const setDeliveryInfo = useCallback((info) => {
    dispatch({ type: SET_DELIVERY_INFO, payload: info })
  }, [])

  const clearDeliveryInfo = useCallback(() => {
    dispatch({ type: CLEAR_DELIVERY_INFO })
  }, [])

  const validateCart = useCallback((products) => {
    const invalidItems = []
    const updatedItems = cart.items.map(item => {
      const currentProduct = products.find(p => p.id === item.id)
      if (!currentProduct) {
        invalidItems.push({ ...item, reason: 'Product no longer available' })
        return null
      }
      if (currentProduct.stock < item.quantity) {
        invalidItems.push({ ...item, reason: 'Stock reduced', requested: item.quantity, available: currentProduct.stock })
        return { ...item, quantity: currentProduct.stock }
      }
      return item
    }).filter(Boolean)

    if (invalidItems.length > 0) {
      dispatch({ type: SET_ERROR, payload: { type: 'CART_VALIDATION', message: `${invalidItems.length} item(s) updated due to stock changes`, invalidItems }})
    }
    return { valid: invalidItems.length === 0, invalidItems }
  }, [cart.items])

  const getCartStockInfo = useCallback((productId) => {
    const item = cart.items.find(i => i.id === productId)
    const quantity = item ? item.quantity : 0
    return { inCart: quantity, canAddMore: (stock) => stock > quantity, remaining: (stock) => Math.max(0, stock - quantity) }
  }, [cart.items])

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items: cart.items,
        totalItems,
        totalPrice,
        error: cart.error,
        deliveryInfo: cart.deliveryInfo,
        appliedCoupon,  // Now from local state, synced with reducer
        setAppliedCoupon,
        clearAppliedCoupon,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        clearError,
        setDeliveryInfo,
        clearDeliveryInfo,
        validateCart,
        getCartStockInfo
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
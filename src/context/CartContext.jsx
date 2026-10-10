// src/context/CartContext.jsx
import { createContext, useContext, useReducer, useCallback, useState, useEffect } from 'react'
import {
  lineKey,
  addLine,
  removeLine,
  setLineQuantity,
  reconcileCart,
  cartCount,
  cartSubtotal
} from '../utils/cartLogic'

const CartContext = createContext()

// Action Types
const ADD_ITEM = 'ADD_ITEM'
const REMOVE_ITEM = 'REMOVE_ITEM'
const UPDATE_QUANTITY = 'UPDATE_QUANTITY'
const CLEAR_CART = 'CLEAR_CART'
const SET_ITEMS = 'SET_ITEMS'
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
      const { line, quantity = 1 } = action.payload
      const { items, error } = addLine(state.items, line, quantity)
      return { ...state, items, error }
    }
    
    case REMOVE_ITEM:
      return {
        ...state,
        items: removeLine(state.items, action.payload.id),
        error: null
      }
      
    case UPDATE_QUANTITY: {
      const { id, quantity, stock } = action.payload
      const { items, error } = setLineQuantity(state.items, id, quantity, stock)
      return { ...state, items, error }
    }
    
    case SET_ITEMS:
      // Used by reconcileCart to apply live availability in one go.
      return {
        ...state,
        items: action.payload,
        error: null
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

  // product is the parent product; variant is the chosen colour/size (optional,
// so legacy single-variant products still work). The cart line is keyed on the
// composite product+variant id, which lives in `id` so existing call sites that
// use item.id keep working.
  const addToCart = useCallback((product, quantity = 1, variant = null) => {
    if (!product) {
      dispatch({ 
        type: SET_ERROR, 
        payload: { type: 'INVALID_PRODUCT', message: 'Invalid product' }
      })
      return { success: false, message: 'Invalid product' }
    }

    const variantId = variant?.id ?? product.variantId ?? null
    const stock = Number(variant?.stock ?? product.stock ?? 0)
    const name = product.title?.en ?? product.title?.ar ?? product.name ?? 'Product'
    const id = lineKey(product.id, variantId)

    if (!stock || stock <= 0) {
      dispatch({ 
        type: SET_ERROR, 
        payload: { 
          type: 'OUT_OF_STOCK', 
          message: `${name} is out of stock`,
          productId: product.id,
          variantId
        }
      })
      return { success: false, message: 'Out of stock', type: 'OUT_OF_STOCK' }
    }

    const existingItem = cart.items.find(item => item.id === id)
    const currentCartQuantity = existingItem ? existingItem.quantity : 0

    if (currentCartQuantity + quantity > stock) {
      const canAdd = stock - currentCartQuantity
      const message = canAdd > 0 
        ? `Only ${canAdd} more can be added (you have ${currentCartQuantity} in cart)`
        : `You already have ${currentCartQuantity} in cart (stock limit: ${stock})`
      
      dispatch({ 
        type: SET_ERROR, 
        payload: { type: 'CART_LIMIT', message, productId: product.id, variantId, canAdd }
      })
      return { success: false, message, type: 'CART_LIMIT', canAdd, currentInCart: currentCartQuantity, stock }
    }

    dispatch({
      type: ADD_ITEM,
      payload: {
        line: {
          id,
          productId: product.id,
          variantId,
          title: product.title ?? name,
          name,
          image: variant?.image ?? product.images?.[0]?.url ?? product.image ?? null,
          color: variant?.color ?? null,
          size: variant?.size ?? null,
          // Snapshot: the price shown is what the order line will carry.
          price: Number(variant?.priceOverride ?? product.price ?? 0),
          stock
        },
        quantity
      }
    })

    return { success: true, message: `Added ${quantity} × ${name} to cart`, added: quantity, totalInCart: currentCartQuantity + quantity }
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

  // Refreshes the cart against live Firestore data. `catalogue` maps a cart line
// id (productId:variantId) to its live variant data. Lines that vanished or sold
// out are removed, over-stock lines are clamped, and every change is reported
// so the UI can tell the shopper rather than silently altering their order.
  const validateCart = useCallback((catalogue = {}) => {
    const { items, issues } = reconcileCart(cart.items, catalogue)

    if (JSON.stringify(items) !== JSON.stringify(cart.items)) {
      dispatch({ type: 'SET_ITEMS', payload: items })
    }

    if (issues.length > 0) {
      dispatch({
        type: SET_ERROR,
        payload: {
          type: 'CART_VALIDATION',
          message: `${issues.length} item(s) updated due to availability changes`,
          invalidItems: issues
        }
      })
    }

    return { valid: issues.length === 0, issues, items }
  }, [cart.items])

  const getCartStockInfo = useCallback((productId) => {
    const item = cart.items.find(i => i.id === productId)
    const quantity = item ? item.quantity : 0
    return { inCart: quantity, canAddMore: (stock) => stock > quantity, remaining: (stock) => Math.max(0, stock - quantity) }
  }, [cart.items])

  const totalItems = cartCount(cart.items)
  const totalPrice = cartSubtotal(cart.items)

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
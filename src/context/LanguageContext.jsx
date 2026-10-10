// src/context/LanguageContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'

// Translations - Egyptian Arabic (العامية المصرية) and English
const translations = {
  ar: {
    // App & Brand
    appName: 'برو أكتيف ستور',
    'ProActive Store': 'برو أكتيف ستور',

    // Navigation & General
    home: 'الرئيسية',
    products: 'المنتجات',
    aboutUs: 'عنّا',
    contact: 'تواصل معنا',
    contactUs: 'تواصل معنا',
    backToHome: 'رجوع للرئيسية',
    backToProducts: 'رجوع للمنتجات',
    back: 'رجوع',
    viewDetails: 'شوف التفاصيل',
    goToCart: 'روح للعربية',
    continueShopping: 'كمل تسوق',
    edit: 'تعديل',
    save: 'حفظ',
    cancel: 'إلغاء',
    remove: 'إزالة',
    active: 'مفعل',
    loading: 'جاري التحميل...',

    // Hero & Home
    featuredProducts: 'المنتجات المميزة',
    discoverPremium: 'اكتشف تشكيلتنا الفاخرة من الشوكولاتة ✨',
    ourCollection: 'تشكيلتنا',
    noProductsAvailable: 'مفيش منتجات لسه',
    checkBackSoon: 'ارجع تاني قريب إن شاء الله!',
    loadingPremiumChocolates: 'جاري تحميل الشوكولاتة الفاخرة...',

    // Product Details
    piecesPerBox: 'عدد القطع في العلبة',
    pieces: 'قطعة',
    flavors: 'النكهات',
    flavorsAvailable: 'نكهات متاحة',
    selectFlavor: 'اختر النكهة',
    description: 'الوصف',
    price: 'السعر',
    quantity: 'الكمية',
    addToCart: 'حط في العربية',
    addedToCart: 'تم الإضافة للعربية',
    premiumQuality: 'جودة ممتازة',
    loadingProductDetails: 'جاري تحميل تفاصيل المنتج...',
    productImage: 'صورة المنتج',
    review: 'تقييم',
    reviews: 'تقييمات',

    // Stock Management
    outOfStock: 'نفذت الكمية',
    onlyLeft: 'باقي {count} بس!',
    inStock: 'متوفر: {count}',
    availableInStock: 'متوفر في المخزن',
    currentlyUnavailable: 'المنتج ده مش متوفر دلوقتي',
    lowStockAlert: 'الكمية قليلة',
    onlyAvailable: 'متوفر {count} بس',
    maxReached: 'وصلت للحد الأقصى',
    maxAvailable: 'الحد الأقصى {count}',
    increaseQuantity: 'زود الكمية',
    productNotFound: 'المنتج مش موجود',
    insufficientStock: 'الكمية في المخزن مش كفاية',

    // Cart
    cart: 'العربية',
    total: 'الإجمالي',
    checkout: 'أكمل الطلب',
    emptyCart: 'العربية فاضية',
    browseOurCollectionAndAddSomeItems: 'اختار من تشكيلتنا وضيف منتجات للعربية!',
    addProducts: 'ضيف منتجات للعربية!',
    shoppingCart: 'عربية التسوق',
    item: 'منتج',
    items: 'منتجات',
    subtotal: 'المجموع الفرعي',
    shipping: 'الشحن',
    free: 'مجاني',
    processing: 'جاري المعالجة...',
    resolveStockIssues: 'حل مشاكل المخزن',
    stockIssuesDetected: 'تم اكتشاف مشاكل في المخزن',
    dismiss: 'إخفاء',
    qty: 'الكمية',
    each: 'للواحد',
    more: 'أكثر',
    discount: 'الخصم',
    haveCoupon: 'عندك كود خصم؟',
    enterCouponCode: 'ادخل كود الخصم',
    apply: 'تطبيق',
    invalidCoupon: 'الكود غير صحيح',
    couponExpired: 'الكود منتهي الصلاحية',
    couponExhausted: 'تم استنفاد الكود',
    couponCurrencyMismatch: 'الكود مش متاح للعملة دي',
    couponNotFound: 'الكود مش موجود',
    couponError: 'حصل خطأ، حاول تاني',
    discountApplied: 'تم تطبيق الخصم',
    off: 'خصم',
    couponInstructions: 'ادخل كود تاني عشان تستبدله، أو امسح عشان تلغي',
    orderSummary: 'ملخص الطلب',
    adjustQuantitiesBeforeCheckout: 'عدل الكميات قبل أكمل الطلب',
    productNotAvailable: 'المنتج غير متوفر',
    cannotProceed: 'مش ممكن تكمل',
    minOrder: 'الحد الأدنى للطلب',

    // Theme
    theme: 'الوضع',
    lightMode: 'وضع النهار',
    darkMode: 'وضع الليل',

    // About Us
    aboutUsTitle: 'عنّا',
    ourMission: 'مهمتنا',
    missionDescription: 'في لوابل، بنقدم أحلى أنواع الشوكولاتة الفاخرة المصنوعة يدوياً من أجود مكونات الكاكاو. بنجمع بين التقاليد القديمة والابتكار الحديث عشان نخلق تجارب ماتتنساش.',
    ourVision: 'رؤيتنا',
    visionDescription: 'نوصل لكل بيت في مصر والشرق الأوسط، ونبقى العلامة التجارية الأولى للشوكولاتة الفاخرة، مع الحفاظ على أعلى معايير الجودة والاستدامة.',
    ourValues: 'قيمنا',
    valuesDescription: 'الجودة، الأصالة، الابتكار، والاستدامة دي قيمنا الأساسية اللي بنبني عليها كل حاجة بنعملها.',
    joinOurSweetJourney: 'انضم لرحلتنا الحلوة',
    experienceFinest: 'جرب أحلى الشوكولاتة المصنوعة بحب واهتمام. كل قطعة فيها قصة جودة وشغف.',
    exploreOurProducts: 'اكتشف منتجاتنا',

    // Footer
    footerTagline: 'بنصنع الشوكولاتة الفاخرة بشغف وتميز. كل قطعة فيها قصة جودة وطعم رائع.',
    quickLinks: 'لينكات سريعة',
    followUs: 'تابعنا',
    allRightsReserved: 'جميع الحقوق محفوظة',
    handcraftedWith: 'مصنوع بحب',

    // Legal
    privacyPolicy: 'سياسة الخصوصية',
    termsOfService: 'شروط الاستخدام',
    termsOfServiceTitle: 'شروط الاستخدام',
    privacy: 'الخصوصية',
    lastUpdated: 'آخر تحديث',
    informationWeCollect: 'المعلومات اللي بنجمعها',
    infoCollectionText: 'بنجمع معلوماتك لما تستخدم تطبيقنا، زي المنتجات اللي ضفتها للعربية وتفاصيل الطلب. مش بنجمع أي معلومات شخصية حساسة.',
    howWeUseInfo: 'إزاي بنستخدم معلوماتك',
    useInfoText: 'بنستخدم المعلومات اللي بنجمعها عشان نحسن تجربة شرائك، ونعرض منتجات مناسبة، ونوفر دعم فني.',
    dataSharing: 'مشاركة البيانات',
    dataSharingText: 'مش بنشارك بياناتك مع أي طرف تالت. كل المعلومات متخزنة بأمان في قواعد بيانات Firebase بتاعتنا.',
    dataSecurity: 'أمن البيانات',
    securityText: 'بنستخدم أفضل ممارسات الأمان عشان نحمي بياناتك من الوصول غير المصرح بيه أو التعديل أو الإفصاح أو التدمير.',
    yourRights: 'حقوقك',
    rightsText: 'لك الحق تطلب حذف بياناتك أو تصحيحها في أي وقت عن طريق التواصل معانا.',
    contactPrivacyText: 'لأي استفسارات عن سياسة الخصوصية، ابعتنا على: louablefactory@gmail.com',

    // Order Success
    orderConfirmed: 'تم تأكيد الطلب!',
    thankYouPurchase: 'شكراً لشرائك. طلبك تم بنجاح.',
    orderId: 'رقم الطلب:',
    orderDetails: 'تفاصيل الطلب',
    transaction: 'العملية:',
    totalPaid: 'المبلغ المدفوع:',
    downloadPDF: 'تحميل PDF',
    print: 'طباعة',
    backToShop: 'رجوع للمتجر',
    orderNotFound: 'الطلب مش موجود',
    orderInfoMissing: 'معلومات الطلب ناقصة أو انتهت.',
    checkConfirmationEmail: 'اتأكد من إيميل التأكيد اللي بعتنالك.',
    returnHome: 'رجوع للرئيسية',
    billedTo: 'فاتورة لـ',
    invoice: 'فاتورة',
    taxInvoice: 'فاتورة ضريبية',
    description: 'الوصف',
    unitPrice: 'سعر الوحدة',
    amount: 'المبلغ',
    discount: 'خصم',
    totalDue: 'الإجمالي المستحق',
    thankYouOrder: 'شكراً لطلبك',
    questionsContact: 'عندك أسئلة؟ تواصل معانا على',
    secureDocument: 'مستند آمن',
    verified: 'تم التحقق',
    pending: 'معلق',
    paymentPending: 'الدفع معلق - كاش عند الاستلام',
    paymentConfirmed: 'تم تأكيد الدفع - مدفوع بالكامل',
    status: 'الحالة',
    paid: 'مدفوع',
    awaitingPayment: 'في انتظار الدفع',
    region : 'المنطقة',
    invoiceNumber: 'رقم الفاتورة',
    email: 'الإيميل',
    name: 'الاسم',
    date: 'التاريخ',

    // Terms of Service
    acceptanceOfTerms: 'قبول الشروط',
    paymentProcessing: 'معالجة الدفع',
    productInfo: 'معلومات المنتج',
    userResponsibilities: 'مسؤوليات المستخدم',
    limitationOfLiability: 'حدود المسؤولية',

    // Connection Status
    connecting: '⏳ جاري الاتصال...',

    // Delivery
    deliveryInformation: 'معلومات التوصيل',
    fullName: 'الاسم الكامل',
    enterFullName: 'ادخل اسمك الكامل',
    age: 'العمر',
    phoneNumber: 'رقم الهاتف',
    detailedAddress: 'العنوان التفصيلي',
    enterDetailedAddress: 'ادخل العنوان التفصيلي',
    city: 'المدينة',
    enterCityExample: 'ادخل المدينة (مثال: نيويورك)',
    enterCityAreaExample: 'ادخل المدينة أو المنطقة (مثال: مدينة نصر)',
    governorate: 'المحافظة',
    selectGovernorate: 'اختر المحافظة',
    shippingCostVaries: 'سعر الشحن بيختلف حسب المحافظة',
    selectLocationOnMap: 'حدد الموقع على الخريطة',
    geolocationNotSupported: 'الموقع الجغرافي غير مدعوم في متصفحك',
    loadingMap: 'جارٍ تحميل الخريطة',
    clickMapToSelectLocation: 'انقر على الخريطة لتحديد موقعك الدقيق',
    saveDeliveryInfo: 'حفظ معلومات التوصيل',
    completeDeliveryInfo: 'أكمل معلومات التوصيل',
    pleaseCompleteDeliveryInfo: 'يرجى إكمال معلومات التوصيل قبل المتابعة',
    nameRequired: 'الاسم الكامل مطلوب',
    validAgeRequired: 'يرجى إدخال عمر صالح (13-120)',
    validPhoneRequired: 'يرجى إدخال رقم هاتف صالح',
    validEmailRequired: 'يرجى إدخال إيميل صحيح',
    addressRequired: 'العنوان التفصيلي مطلوب',
    addressTooShort: 'العنوان لازم يكون 10 حروف على الأقل',
    locationRequired: 'يرجى تحديد موقعك على الخريطة',
    location: 'الموقع',
    editLocation: 'تعديل الموقع',
    selectLocation: 'اختيار الموقع',
    dragMarkerOrClick: 'اسحب العلامة أو انقر على الخريطة لتحديد موقعك',
    dragToSetLocation: 'اسحب لتحديد الموقع',
    clickMapOrDrag: '🖱️ انقر على الخريطة أو اسحب العلامة لتحديد الموقع',
    latitude: 'خط العرض',
    longitude: 'خط الطول',
    saveLocation: 'حفظ الموقع',
    search: 'بحث',
    searchAreaStreet: 'ابحث عن منطقة، شارع، أو معلم...',
    searchAreaStreetEgypt: 'ابحث عن منطقة، شارع، أو معلم في مصر...',
    locationMap: 'خريطة الموقع',

    // Payment
    paymentMethod: 'طريقة الدفع',
    cashOnDelivery: 'كاش عند الاستلام',
    payWhenReceive: 'ادفع لما تستلم',
    creditDebitCard: 'كريديت/ديبت كارد',
    temporarilyUnavailable: 'مش متاح دلوقتي',
    cardPayment: 'دفع بالكارد',

    // Shipping
    usa: 'أمريكا',
    canada: 'كندا',
    europe: 'أوروبا',
    restOfWorld: 'باقي العالم',
    addMoreForFreeShipping: 'ضيف {amount} عشان تحصل على شحن مجاني!',
    shoppingIn: 'التسوق في',

    // Checkout
    checkoutFailed: 'فشل في إتمام الطلب',
    tryAgain: 'حاول تاني',
  },
  en: {
    // App & Brand
    appName: 'ProActive Store',
    'ProActive Store': 'ProActive Store',

    // Navigation & General
    home: 'Home',
    products: 'Products',
    aboutUs: 'About Us',
    contact: 'Contact',
    contactUs: 'Contact Us',
    backToHome: 'Back to Home',
    backToProducts: 'Back to Products',
    back: 'Back',
    viewDetails: 'View Details',
    goToCart: 'Go to Cart',
    continueShopping: 'Continue Shopping',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    remove: 'Remove',
    active: 'Active',
    loading: 'Loading...',

    // Hero & Home
    featuredProducts: 'Featured Products',
    discoverPremium: 'Discover our premium chocolate collection ✨',
    ourCollection: 'Our Collection',
    noProductsAvailable: 'No products available yet',
    checkBackSoon: 'Check back soon for delicious chocolates!',
    loadingPremiumChocolates: 'Loading premium chocolates...',

    // Product Details
    piecesPerBox: 'Pieces per Box',
    pieces: 'pieces',
    flavors: 'Flavors',
    flavorsAvailable: 'flavors available',
    selectFlavor: 'Select Flavor',
    description: 'Description',
    price: 'Price',
    quantity: 'Quantity',
    addToCart: 'Add to Cart',
    addedToCart: 'Added to cart',
    premiumQuality: 'Premium Quality',
    loadingProductDetails: 'Loading product details...',
    productImage: 'Product Image',
    review: 'review',
    reviews: 'reviews',

    // Stock Management
    outOfStock: 'Out of Stock',
    onlyLeft: 'Only {count} left!',
    inStock: 'In Stock: {count}',
    availableInStock: 'Available in Stock',
    currentlyUnavailable: 'This item is currently unavailable',
    lowStockAlert: 'Low Stock Alert',
    onlyAvailable: 'Only {count} available',
    maxReached: 'Max reached',
    maxAvailable: 'Max {count}',
    increaseQuantity: 'Increase quantity',
    productNotFound: 'Product not found',
    insufficientStock: 'Insufficient stock available',

    // Cart
    cart: 'Cart',
    total: 'Total',
    checkout: 'Proceed to Checkout',
    emptyCart: 'Your cart is empty',
    browseOurCollectionAndAddSomeItems: 'Browse our collection and add some items!',
    addProducts: 'Add some products to your cart!',
    shoppingCart: 'Shopping Cart',
    item: 'item',
    items: 'items',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    free: 'Free',
    processing: 'Processing...',
    resolveStockIssues: 'Resolve Stock Issues',
    stockIssuesDetected: 'Stock Issues Detected',
    dismiss: 'Dismiss',
    qty: 'Qty',
    each: 'each',
    more: 'more',
    discount: 'Discount',
    haveCoupon: 'Have a coupon code?',
    enterCouponCode: 'Enter coupon code',
    apply: 'Apply',
    invalidCoupon: 'Invalid coupon code',
    couponExpired: 'Coupon expired',
    couponExhausted: 'Coupon fully used',
    couponCurrencyMismatch: 'Coupon not valid for this currency',
    couponNotFound: 'Coupon not found',
    couponError: 'Error occurred, please try again',
    discountApplied: 'Discount applied',
    off: 'off',
    couponInstructions: 'Enter a different code above to replace, or remove to clear',
    orderSummary: 'Order Summary',
    adjustQuantitiesBeforeCheckout: 'Adjust quantities before checkout',
    productNotAvailable: 'Product is not available',
    cannotProceed: 'Cannot proceed',
    minOrder: 'Min Order',

    // Theme
    theme: 'Theme',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',

    // About Us
    aboutUsTitle: 'About Us',
    ourMission: 'Our Mission',
    missionDescription: 'At ProActive Store, we are committed to crafting premium artisanal chocolates using the finest cocoa ingredients. We blend time-honored traditions with modern innovation to create unforgettable experiences.',
    ourVision: 'Our Vision',
    visionDescription: 'To become the leading luxury chocolate brand in the Middle East, while maintaining the highest standards of quality and sustainability.',
    ourValues: 'Our Values',
    valuesDescription: 'Quality, authenticity, innovation, and sustainability are our core values that guide everything we do.',
    joinOurSweetJourney: 'Join Our Sweet Journey',
    experienceFinest: 'Experience the finest chocolates crafted with love and dedication. Every piece tells a story of quality and passion.',
    exploreOurProducts: 'Explore Our Products',

    // Footer
    footerTagline: 'Crafting premium chocolates with passion and excellence. Every piece tells a story of quality and taste.',
    quickLinks: 'Quick Links',
    followUs: 'Follow Us',
    allRightsReserved: 'All rights reserved',
    handcraftedWith: 'Handcrafted with',

    // Legal
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    termsOfServiceTitle: 'Terms of Service',
    privacy: 'Privacy',
    lastUpdated: 'Last Updated',
    informationWeCollect: 'Information We Collect',
    infoCollectionText: 'We collect information when you use our app, such as products added to your cart and order details. We do not collect any sensitive personal information.',
    howWeUseInfo: 'How We Use Your Information',
    useInfoText: 'We use the collected information to improve your shopping experience, show relevant products, and provide technical support.',
    dataSharing: 'Data Sharing',
    dataSharingText: 'We do not share your data with any third parties. All information is securely stored in our Firebase databases.',
    dataSecurity: 'Data Security',
    securityText: 'We follow industry best practices to protect your data from unauthorized access, alteration, disclosure, or destruction.',
    yourRights: 'Your Rights',
    rightsText: 'You have the right to request deletion or correction of your data at any time by contacting us.',
    contactPrivacyText: 'For any questions about this Privacy Policy, please email us at: louablefactory@gmail.com',

    // Order Success
    orderConfirmed: 'Order Confirmed!',
    thankYouPurchase: 'Thank you for your purchase. Your order has been successfully processed.',
    orderId: 'Order ID:',
    orderDetails: 'Order Details',
    transaction: 'Transaction:',
    totalPaid: 'Total Paid:',
    downloadPDF: 'Download PDF',
    print: 'Print',
    backToShop: 'Back to Shop',
    orderNotFound: 'Order Not Found',
    orderInfoMissing: 'Order information is missing or has expired.',
    checkConfirmationEmail: 'Please check your confirmation email.',
    returnHome: 'Return Home',
    billedTo: 'Billed To',
    invoice: 'Invoice',
    taxInvoice: 'Tax Invoice',
    description: 'Description',
    unitPrice: 'Unit Price',
    amount: 'Amount',
    discount: 'Discount',
    totalDue: 'Total Due',
    thankYouOrder: 'Thank you for your order',
    questionsContact: 'Questions? Contact us at',
    secureDocument: 'Secure Document',
    verified: 'Verified',
    pending: 'Pending',
    paymentPending: 'Payment Pending — Cash on Delivery',
    paymentConfirmed: 'Payment Confirmed — Paid in Full',
    status: 'Status',
    paid: 'Paid',
    awaitingPayment: 'Awaiting Payment',
    region : 'Region',
    invoiceNumber: 'Invoice No',
    email: 'Email',
    name: 'Name',
    date: 'Date',
    // Terms of Service
    acceptanceOfTerms: 'Acceptance of Terms',
    paymentProcessing: 'Payment Processing',
    productInfo: 'Product Information',
    userResponsibilities: 'User Responsibilities',
    limitationOfLiability: 'Limitation of Liability',

    // Connection Status
    connecting: '⏳ Connecting...',

    // Delivery
    deliveryInformation: 'Delivery Information',
    fullName: 'Full Name',
    enterFullName: 'Enter your full name',
    age: 'Age',
    phoneNumber: 'Phone Number',
    detailedAddress: 'Detailed Address',
    enterDetailedAddress: 'Enter detailed address',
    city: 'City',
    enterCityExample: 'Enter city (e.g., New York)',
    enterCityAreaExample: 'Enter city or area (e.g., Nasr City)',
    governorate: 'Governorate',
    selectGovernorate: 'Select your governorate',
    shippingCostVaries: 'Shipping cost varies by governorate',
    selectLocationOnMap: 'Select Location on Map',
    geolocationNotSupported: 'Geolocation not supported in your browser',
    loadingMap: 'Loading map...',
    clickMapToSelectLocation: 'Click on the map to select your exact location',
    saveDeliveryInfo: 'Save Delivery Information',
    completeDeliveryInfo: 'Complete Delivery Info',
    pleaseCompleteDeliveryInfo: 'Please complete delivery information before checkout',
    nameRequired: 'Full name is required',
    validAgeRequired: 'Please enter a valid age (13-120)',
    validPhoneRequired: 'Please enter a valid phone number',
    validEmailRequired: 'Please enter a valid email',
    addressRequired: 'Detailed address is required',
    addressTooShort: 'Address must be at least 10 characters',
    locationRequired: 'Please select your location on the map',
    location: 'Location',
    editLocation: 'Edit Location',
    selectLocation: 'Select Location',
    dragMarkerOrClick: 'Drag the marker or click on map to set your location',
    dragToSetLocation: 'Drag to set your location',
    clickMapOrDrag: '🖱️ Click map or drag marker to set location',
    latitude: 'Latitude',
    longitude: 'Longitude',
    saveLocation: 'Save Location',
    search: 'Search',
    searchAreaStreet: 'Search for area, street, or landmark...',
    searchAreaStreetEgypt: 'Search for area, street, or landmark in Egypt...',
    locationMap: 'Location Map',

    // Payment
    paymentMethod: 'Payment Method',
    cashOnDelivery: 'Cash on Delivery',
    payWhenReceive: 'Pay when you receive',
    creditDebitCard: 'Credit/Debit Card',
    temporarilyUnavailable: 'Temporarily unavailable',
    cardPayment: 'Card Payment',

    // Shipping
    usa: 'USA',
    canada: 'Canada',
    europe: 'Europe',
    restOfWorld: 'Rest of World',
    addMoreForFreeShipping: 'Add {amount} more for free shipping!',
    shoppingIn: 'Shopping in',

    // Checkout
    checkoutFailed: 'Checkout failed',
    tryAgain: 'Please try again',
  }
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('ar') // Default: Arabic

  // Load saved language
  useEffect(() => {
    const saved = localStorage.getItem('language')
    if (saved === 'ar' || saved === 'en') {
      setLang(saved)
    }
  }, [])

  // Apply direction & language to body
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('language', lang)
  }, [lang])

  // Enhanced translation function with interpolation support
  const t = (key, params = {}) => {
    let text = translations[lang][key] || key

    // Handle interpolation for dynamic values like {count}
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param])
    })

    return text
  }

  const toggleLanguage = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar')
  }

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
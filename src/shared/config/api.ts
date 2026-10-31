export const API_CONFIG = {
  BASE_URL: 'https://twaio.net/api',
  SOCKET_URL: 'https://twaio.net',
  TIMEOUT: 30000,
  ENDPOINTS: {
    // Auth
    AUTH_REGISTER: '/auth/register',
    AUTH_REGISTER_ADMIN: '/auth/register/admin',
    AUTH_LOGIN: '/auth/login',
    AUTH_ADMIN_LOGIN: '/auth/admin/login',
    AUTH_PROFILE: '/auth/profile',
    AUTH_REFRESH: '/auth/refresh',
    AUTH_VERIFY_EMAIL: '/auth/verify-email',
    AUTH_RESEND_CODE: '/auth/resend-code',
    AUTH_GOOGLE: '/auth/google',
    AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
    AUTH_RESET_PASSWORD: '/auth/reset-password',

    // Users
    USERS_BALANCE: '/users/balance',
    USERS_BALANCE_ADD: '/users/balance/add',
    USERS_BALANCE_SET: '/users/balance/set',
    USERS_ADMIN: '/users/admin', // Получить ID админа
    USERS_DELETE_ACCOUNT: '/users/account',

    // Tours
    TOURS: '/tours',
    TOURS_BY_ID: (id: number) => `/tours/${id}`,

    // Documents
    DOCUMENTS: '/documents',
    DOCUMENTS_UPLOAD: '/documents/upload',
    DOCUMENTS_BY_ID: (id: string) => `/documents/${id}`,

    // Admin - Users
    ADMIN_USERS: '/admin/users',
    ADMIN_USER_BY_ID: (id: number) => `/admin/users/${id}`,
    ADMIN_USER_BALANCE: (id: number) => `/admin/users/${id}/balance`,
    ADMIN_USER_ROLE: (id: number) => `/admin/users/${id}/role`,
    ADMIN_USER_DOCUMENTS: (id: number) => `/admin/users/${id}/documents`,

    // Admin - Tours
    ADMIN_TOURS: '/admin/tours',
    ADMIN_TOUR_BY_ID: (id: number) => `/admin/tours/${id}`,
    ADMIN_TOUR_TOGGLE: (id: number) => `/admin/tours/${id}/toggle`,

    // Admin - Documents
    ADMIN_DOCUMENTS: '/admin/documents',
    ADMIN_DOCUMENT_BY_ID: (id: string) => `/admin/documents/${id}`,
    ADMIN_DOCUMENT_ASSIGN: (documentId: string, userId: number) =>
      `/admin/documents/${documentId}/assign/${userId}`,

    // Messages
    MESSAGES: {
      CONVERSATIONS: '/messages/conversations',
      HISTORY: '/messages/history',
      READ: '/messages/read',
      UNREAD_COUNT: '/messages/unread/count',
      CONVERSATION: '/messages/conversation',
      UPLOAD_IMAGE: '/messages/upload-image',
    },

    // Bonus
    BONUS: {
      BALANCE: '/bonus/balance',
      LIMITS: '/bonus/limits',
      CAN_WATCH_AD: '/bonus/can-watch-ad',
      TRANSACTIONS: '/bonus/transactions',
      // SSV Ads
      AD_REQUEST: '/bonus/ad/request',
      AD_REWARD: '/bonus/ad/reward',
      // Legacy earn methods
      EARN_AD_VIEW: '/bonus/earn/ad-view',
      EARN_REGISTRATION: '/bonus/earn/registration',
      EARN_PROFILE_COMPLETE: '/bonus/earn/profile-complete',
      EARN_REFERRAL: '/bonus/earn/referral',
      APPLY: '/bonus/apply',
      CALCULATE_MAX_DISCOUNT: '/bonus/calculate-max-discount',
      UPLOAD: '/bonus/upload',
    },

    // Bonus Shop
    BONUS_SHOP: {
      ITEMS: '/bonus-shop/items',
      PURCHASE: '/bonus-shop/purchase',
      REDEEM_CATALOG: '/bonus-shop/redeem-catalog',
      MY_PURCHASES: '/bonus-shop/my-purchases',
      SETTINGS: '/bonus-shop/settings',
    },

    // Payments (WayForPay)
    PAYMENTS: {
      CREATE: '/payments/wayforpay/create',
      STATUS: (orderReference: string) => `/payments/wayforpay/status/${orderReference}`,
    },

    // Installments
    INSTALLMENTS: {
      LIST: '/installments',
      CREATE: '/installments',
      CALCULATE: '/installments/calculate',
      BY_ID: (id: string) => `/installments/${id}`,
      PAY: (installmentId: string, paymentId: string) =>
        `/installments/${installmentId}/payments/${paymentId}/pay`,
      PAY_CUSTOM: (installmentId: string) => `/installments/${installmentId}/pay-custom`,
      PAYOFF: (installmentId: string) => `/installments/${installmentId}/payoff`,
    },

    // "Оплатить тур" — one-off full payment, not an installment
    TOUR_PAYMENT: '/tours/payment',

    // Push notifications
    NOTIFICATIONS: {
      REGISTER_TOKEN: '/notifications/register-token',
      PREFERENCES: '/notifications/preferences',
      JACKPOT_ALERT: '/notifications/jackpot-alert',
    },
  },
};

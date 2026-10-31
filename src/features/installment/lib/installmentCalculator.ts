export const INSTALLMENT_CURRENCY = 'EUR' as const;

/** Minimum first payment as a fraction of the tour cost — the backend
 *  enforces this too (400 if violated), this is just for client-side
 *  validation before even calling `/installments/calculate`. */
export const MIN_FIRST_PAYMENT_RATIO = 0.3;

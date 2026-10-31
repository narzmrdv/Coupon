/** Every Bonus Shop item — regardless of its nominal price — only takes
 *  this many TWA out of the user's online balance. The rest of the price
 *  is paid in person, in cash, on pickup/redemption. */
export const ONLINE_DEPOSIT_TWA = 3;

export function getOnlineDeposit(price: number): number {
  return Math.min(ONLINE_DEPOSIT_TWA, Math.max(0, price));
}

export function getCashDue(price: number): number {
  return Math.max(0, price - getOnlineDeposit(price));
}

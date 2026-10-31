export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  /** Which endpoint actually failed — shown in error alerts so a report
   *  doesn't need a follow-up round trip to find out which URL 404'd. */
  requestUrl?: string;
  /** Present on 429 responses that represent a timed pause (e.g. ad-view
   *  cooldowns) rather than a generic failure — seconds until retry is
   *  allowed again. */
  nextAvailableInSec?: number;
  /** Machine-readable pause reason accompanying `nextAvailableInSec`. */
  reason?: string;
}

export interface MessageResponse {
  message: string;
}

export type ApiResponse<T> = T | ApiError;

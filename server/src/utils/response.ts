import type { Response } from "express";

export interface ApiResponsePayload<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  count?: number;
}

export class ApiResponse {
  /**
   * Send a successful JSON response
   */
  public static success<T>(
    res: Response, 
    data: T, 
    message = "Operation completed successfully", 
    statusCode = 200
  ): void {
    const payload: ApiResponsePayload<T> = {
      success: true,
      message,
      data,
    };

    if (Array.isArray(data)) {
      payload.count = data.length;
    }

    res.status(statusCode).json(payload);
  }

  /**
   * Send an error JSON response
   */
  public static error(
    res: Response, 
    error: string, 
    statusCode = 400
  ): void {
    const payload: ApiResponsePayload = {
      success: false,
      error,
    };

    res.status(statusCode).json(payload);
  }
}
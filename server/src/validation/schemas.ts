import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Must be a valid 24-character hex Mongo ObjectId');

export const idParamSchema = z.object({
  id: objectIdSchema,
});

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const deviceSchema = z.object({
  name: z.string().min(1, 'Device name is required'),
  category: z.enum(['kitchen', 'laundry', 'lighting', 'entertainment', 'HVAC', 'computing']),
  status: z.enum(['active', 'inactive']).default('active'),
  location: z.string().trim().max(100).optional(),
  ratedWattage: z.coerce.number().min(0, 'Rated wattage must be positive').optional(),
});

export const deviceStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export const telemetrySchema = z.object({
  device: objectIdSchema,
  watts: z.number().nonnegative('Watts must be a non-negative number'),
  kWh: z.number().nonnegative('kWh must be a non-negative number'),
  interval: z.enum(['raw', 'daily', 'weekly', 'monthly']).default('raw'),
});

export const telemetryQuerySchema = z.object({
  interval: z.enum(['raw', 'daily', 'weekly', 'monthly']).optional(),
  date: z.string().optional(),
});

export const telemetrySummaryQuerySchema = z.object({
  from: z.string().min(1, 'from date is required'),
  to: z.string().min(1, 'to date is required'),
});

export const telemetryRangeQuerySchema = z.object({
  from: z.string().min(1, 'from date is required'),
  to: z.string().min(1, 'to date is required'),
  groupBy: z.enum(['hour', 'day']).optional(),
});

export const predictionSchema = z.object({
  device: objectIdSchema.optional(),
  type: z.enum(['bill', 'consumption', 'anomaly']),
  predictedValue: z.number().nonnegative('Predicted value must be a non-negative number'),
  confidence: z.number().min(0, 'Confidence must be between 0 and 1').max(1, 'Confidence must be between 0 and 1'),
  targetDate: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) {
      return new Date(arg);
    }
    return arg;
  }, z.date({ message: 'Target date must be a valid date format' })),
  anomalyDetails: z.string().optional(),
});

export const mlPredictionSchema = z.object({
  userId: objectIdSchema,
  device: objectIdSchema.optional(),
  type: z.enum(['bill', 'consumption', 'anomaly']),
  predictedValue: z.number().nonnegative('Predicted value must be a non-negative number'),
  confidence: z.number().min(0, 'Confidence must be between 0 and 1').max(1, 'Confidence must be between 0 and 1'),
  targetDate: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) {
      return new Date(arg);
    }
    return arg;
  }, z.date({ message: 'Target date must be a valid date format' })),
  anomalyDetails: z.string().optional(),
});

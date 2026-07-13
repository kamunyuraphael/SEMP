import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export const connectDB = async (): Promise<void> => {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw new Error('MongoDB connection string is not configured. Set MONGO_URI');
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      autoIndex: true,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
};

import { Types } from 'mongoose';

export interface ITelemetryData {
    _id: Types.ObjectId;
    device: Types.ObjectId; // Reference
    user: Types.ObjectId;   // Reference
    timestamp: Date;
    watts: number;
    kWh: number;           // Energy consumed in kilowatt-hours
    interval: 'raw' | 'daily' | 'weekly' | 'monthly';
    createdAt?: Date;
    updatedAt?: Date;
}
import { Types } from 'mongoose';

export interface IPrediction {
    _id: Types.ObjectId;
    user: Types.ObjectId;   // Reference to User
    device?: Types.ObjectId; // Optional: device linked to prediction
    type: 'bill' | 'consumption' | 'anomaly';
    predictedValue: number;        // Forecasted kWh or bill amount
    confidence: number;            // Confidence score (0–1)
    timestamp: Date;               // When prediction was made
    targetDate: Date;              // Future date the prediction applies to
    anomalyDetails?: string;       // Extra info if anomaly detected
    resolved: boolean;             // For type: 'anomaly' — has the user acknowledged this?
    createdAt?: Date;
    updatedAt?: Date;
}
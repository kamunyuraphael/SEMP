import { Types } from 'mongoose';

export interface IDevice {
    _id: Types.ObjectId;
    name: string;
    category: 'kitchen' | 'laundry' | 'lighting' | 'entertainment' | 'HVAC' | 'computing';
    status: 'active' | 'inactive';
    location?: string;
    ratedWattage?: number;
    owner: Types.ObjectId; // User ID
    createdAt?: Date;
    updatedAt?: Date;
}
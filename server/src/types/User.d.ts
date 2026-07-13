import { Types } from 'mongoose';

export interface IUser {
    _id: Types.ObjectId;
    username: string;
    email: string;
    password: string; // hashed password
    role: 'user' | 'admin';
    devices: Types.ObjectId[]; // Array of Device IDs
    createdAt?: Date;
    updatedAt?: Date;
}
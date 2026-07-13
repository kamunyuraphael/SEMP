// User.ts - This file defines the Mongoose schema and model for users in the HEMS application. It includes fields for username, email, password, role, associated devices, and timestamps. The model is used to create, read, update, and delete user documents in the MongoDB database.
import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: "user" | "admin";
  devices: Schema.Types.ObjectId[]; // References Device documents
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, // hashed with bcrypt
    role: { type: String, enum: ["user", "admin"], default: "user" },
    devices: [{ type: Schema.Types.ObjectId, ref: "Device" }],
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);

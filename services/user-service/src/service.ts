import jwt from "jsonwebtoken";
import { AppError } from "./errors";
import { publishDeviceToken } from "./Kafka/producers";
import { IAuthData } from "./interfaces";
import {
  deleteUserById,
  getUserById,
  saveUser,
  updateUser,
  verifyUserCredentials,
} from "./db";
import { sendMedicationEvents } from "./Kafka/producers";
import {
  DeviceTokenValue,
  isDevicePlatform,
} from "./Kafka/contracts/device-tokens";
import { JWT_EXPIRES_IN, JWT_SECRET } from "./config";

export interface LoginResult {
  accessToken: string;
  user: { id: string; name: string; email: string };
}

export class UserService {
  constructor() {}

  async registerUser(userData: IAuthData) {
    const user = await saveUser(userData);
    return user;
  }

  /** Authenticates and issues an access token. FCM tokens are NOT handled here any more. */
  async login(credentials: {
    email: string;
    password: string;
  }): Promise<LoginResult> {
    const user = await verifyUserCredentials({
      email: credentials.email,
      password: credentials.password,
    });
    if (!user)
      throw new AppError("Invalid email or password", "INVALID_CREDENTIALS");

    const id = user._id.toString();
    const accessToken = jwt.sign({ sub: id }, JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: JWT_EXPIRES_IN,
    });
    return { accessToken, user: { id, name: user.name, email: user.email } };
  }

  /**
   * Publishes the device token to Kafka. emergency-service and medication-service
   * each store their own copy. Call after login, on app start and on FCM token refresh.
   */
  async registerDevice(
    userId: string,
    device: { fcmToken: string; platform?: string; deviceId?: string },
  ): Promise<void> {
    const value: DeviceTokenValue = {
      userId,
      platform: isDevicePlatform(device.platform) ? device.platform : undefined,
      deviceId: device.deviceId,
      updatedAt: new Date().toISOString(),
    };
    await publishDeviceToken(device.fcmToken, value);
  }

  /** Publishes a tombstone: consumers delete the token. Call on logout. */
  async unregisterDevice(fcmToken: string): Promise<void> {
    await publishDeviceToken(fcmToken, null);
  }

  async getUser(userId: string) {
    try {
      const user = await getUserById(userId);
      if (!user) {
        throw new Error("User not found.");
      }
      return { email: user.email };
    } catch (error) {
      throw new Error(error);
    }
  }

  async updateUser({
    userData,
    userId,
  }: {
    userId: string;
    userData: IAuthData;
  }) {
    try {
      const user = await updateUser(userId, userData);
      return user;
    } catch (error) {
      throw new Error(error);
    }
  }

  async deleteUser(userId: string) {
    try {
      await deleteUserById(userId);
    } catch (error) {
      throw new Error(error);
    }
  }
}

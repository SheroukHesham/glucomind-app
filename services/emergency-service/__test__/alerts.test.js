const admin = require("firebase-admin");

// Mock admin.messaging().send
jest.mock("firebase-admin", () => ({
  messaging: jest.fn().mockReturnThis(),
  initializeApp: jest.fn(),
  credential: { applicationDefault: jest.fn() },
}));

const sendMock = jest.fn();
admin.messaging.mockReturnValue({ send: sendMock });

describe("emergency consumer eachMessage", () => {
  // Import or define the eachMessage function here for testing
  // We'll extract the logic for eachMessage for unit testing

  const eachMessage = async ({ message }) => {
    const payload = JSON.parse(message.value.toString());
    const { userId, glucoseLevel, fcmToken, trend, criticality } = payload;

    if (!userId || !glucoseLevel || !fcmToken) {
      console.error("Missing required fields in message");
      return;
    }

    let notificationTitle = "🚨 Blood Glucose Alert";
    let notificationBody = `Your blood glucose level is ${glucoseLevel} mg/dL. Please take action!`;

    if (criticality === "slightly_abnormal") {
      notificationTitle = "⚠️ Glucose Slightly Abnormal";
      notificationBody = `Your glucose is ${glucoseLevel} mg/dL (${trend}). Monitor closely.`;
    } else if (criticality === "high_low") {
      notificationTitle = "❗ Glucose High/Low";
      notificationBody = `Your glucose is ${glucoseLevel} mg/dL (${trend}). Take action if needed.`;
    } else if (criticality === "critical") {
      notificationTitle = "🚨 Critical Glucose Alert";
      notificationBody = `CRITICAL: ${glucoseLevel} mg/dL (${trend}). Seek help immediately!`;
    }

    const fcmMessage = {
      token: fcmToken,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      android: {
        priority: "high",
        notification: {
          sound: "emergency_alarm",
          channelId: "emergency-channel",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "emergency_alarm.wav",
            contentAvailable: true,
            alert: {
              title: notificationTitle,
              body: notificationBody,
            },
          },
        },
      },
    };

    try {
      await admin.messaging().send(fcmMessage);
      // console.log(`✅ Notification sent to user ${userId} [${criticality}]`);
    } catch (err) {
      // console.error("❌ FCM Error:", err);
    }
  };

  beforeEach(() => {
    sendMock.mockClear();
  });

  it("sends normal notification for default criticality", async () => {
    const msg = {
      value: Buffer.from(
        JSON.stringify({
          userId: "u1",
          glucoseLevel: 120,
          fcmToken: "token123",
          trend: "steady",
        })
      ),
    };
    await eachMessage({ message: msg });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token123",
        notification: expect.objectContaining({
          title: "🚨 Blood Glucose Alert",
          body: expect.stringContaining("120"),
        }),
      })
    );
  });

  it("sends slightly_abnormal notification", async () => {
    const msg = {
      value: Buffer.from(
        JSON.stringify({
          userId: "u2",
          glucoseLevel: 75,
          fcmToken: "token456",
          trend: "falling",
          criticality: "slightly_abnormal",
        })
      ),
    };
    await eachMessage({ message: msg });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token456",
        notification: expect.objectContaining({
          title: "⚠️ Glucose Slightly Abnormal",
          body: expect.stringContaining("75"),
        }),
      })
    );
  });

  it("sends high_low notification", async () => {
    const msg = {
      value: Buffer.from(
        JSON.stringify({
          userId: "u3",
          glucoseLevel: 200,
          fcmToken: "token789",
          trend: "rising",
          criticality: "high_low",
        })
      ),
    };
    await eachMessage({ message: msg });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token789",
        notification: expect.objectContaining({
          title: "❗ Glucose High/Low",
          body: expect.stringContaining("200"),
        }),
      })
    );
  });

  it("sends critical notification", async () => {
    const msg = {
      value: Buffer.from(
        JSON.stringify({
          userId: "u4",
          glucoseLevel: 300,
          fcmToken: "token999",
          trend: "rising",
          criticality: "critical",
        })
      ),
    };
    await eachMessage({ message: msg });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token999",
        notification: expect.objectContaining({
          title: "🚨 Critical Glucose Alert",
          body: expect.stringContaining("CRITICAL"),
        }),
      })
    );
  });

  it("does not send notification if required fields are missing", async () => {
    const msg = {
      value: Buffer.from(
        JSON.stringify({
          userId: "",
          glucoseLevel: 120,
          fcmToken: "",
        })
      ),
    };
    await eachMessage({ message: msg });
    expect(sendMock).not.toHaveBeenCalled();
  });
});

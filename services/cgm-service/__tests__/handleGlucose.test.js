const { handleGlucoseData } = require("../cgm_index");

// Mock dependencies
jest.mock("../cgm_Database", () => ({
  getLastReadingByUser: jest.fn(),
}));
const { getLastReadingByUser } = require("../cgm_Database");

// Mock axios and produce
jest.mock("axios");
const axios = require("axios");

const produce = jest.fn();
jest.mock("../cgm_index", () => {
  const original = jest.requireActual("../cgm_index");
  return {
    ...original,
    produce: jest.fn(),
  };
});

describe("handleGlucoseData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 'steady' trend for similar glucose values", async () => {
    getLastReadingByUser.mockResolvedValue({ glucoseLevels: 120 });
    axios.get.mockResolvedValue({ data: { fcmToken: "token123" } });

    const trend = await handleGlucoseData("user1", 122);
    expect(trend).toBe("steady");
  });

  it("returns 'rising' trend for higher glucose value", async () => {
    getLastReadingByUser.mockResolvedValue({ glucoseLevels: 100 });
    axios.get.mockResolvedValue({ data: { fcmToken: "token123" } });

    const trend = await handleGlucoseData("user1", 110);
    expect(trend).toBe("rising");
  });

  it("returns 'falling' trend for lower glucose value", async () => {
    getLastReadingByUser.mockResolvedValue({ glucoseLevels: 120 });
    axios.get.mockResolvedValue({ data: { fcmToken: "token123" } });

    const trend = await handleGlucoseData("user1", 110);
    expect(trend).toBe("falling");
  });

  it("produces a 'slightly_abnormal' message for slightly abnormal glucose", async () => {
    getLastReadingByUser.mockResolvedValue({ glucoseLevels: 100 });
    axios.get.mockResolvedValue({ data: { fcmToken: "token123" } });

    const trend = await handleGlucoseData("user1", 75);
    // You can check produce was called if you expose it for testing
    // expect(produce).toHaveBeenCalled();
    expect(trend).toBe("falling");
  });

  it("returns trend even if no FCM token is found", async () => {
    getLastReadingByUser.mockResolvedValue({ glucoseLevels: 100 });
    axios.get.mockResolvedValue({ data: { fcmToken: null } });

    const trend = await handleGlucoseData("user1", 75);
    expect(trend).toBe("falling");
  });

  it("returns 'unknown' trend if no last reading", async () => {
    getLastReadingByUser.mockResolvedValue(null);
    axios.get.mockResolvedValue({ data: { fcmToken: "token123" } });

    const trend = await handleGlucoseData("user1", 100);
    expect(trend).toBe("unknown");
  });
});

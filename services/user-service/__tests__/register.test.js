const request = require("supertest");
const express = require("express");
const app = express();
app.use(express.json());

// Mock dependencies
const saveUser = jest.fn();
const producer = { send: jest.fn() };
const User = function (data) {
  Object.assign(this, data);
};

// Inject mocks into route
app.post("/register", async (req, res) => {
  const user = new User(req.body);
  const savedUser = await saveUser(user);
  const message = { user: savedUser };
  try {
    await producer.send({
      topic: "user-creation-events",
      messages: [{ key: "user", value: JSON.stringify(message) }],
    });
  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
  res.status(201).json(savedUser);
});

describe("POST /register", () => {
  beforeEach(() => {
    saveUser.mockClear();
    producer.send.mockClear();
  });

  it("should save user and produce Kafka message", async () => {
    const mockUser = { name: "Test", email: "test@example.com" };
    saveUser.mockResolvedValue({ ...mockUser, _id: "123" });
    producer.send.mockResolvedValue();

    const res = await request(app).post("/register").send(mockUser);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Test",
      email: "test@example.com",
      _id: "123",
    });
    expect(saveUser).toHaveBeenCalled();
    expect(producer.send).toHaveBeenCalledWith({
      topic: "user-creation-events",
      messages: [
        {
          key: "user",
          value: JSON.stringify({ user: { ...mockUser, _id: "123" } }),
        },
      ],
    });
  });

  it("should return 500 if Kafka send fails", async () => {
    const mockUser = { name: "Test", email: "test@example.com" };
    saveUser.mockResolvedValue({ ...mockUser, _id: "123" });
    producer.send.mockRejectedValue(new Error("Kafka error"));

    const res = await request(app).post("/register").send(mockUser);

    expect(res.status).toBe(500);
    expect(res.text).toBe("Internal Server Error");
  });
});

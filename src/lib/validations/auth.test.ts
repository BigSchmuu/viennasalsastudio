import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  profileSchema,
} from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email/password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts a password with exactly 6 characters (Supabase minimum)", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "123456" });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 6 characters", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "12345" });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("rejects a missing email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "123456",
      confirmPassword: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "123456",
      confirmPassword: "654321",
    });
    expect(result.success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("accepts all-empty optional fields", () => {
    const result = profileSchema.safeParse({
      full_name: "",
      phone: "",
      birthdate: "",
      gender: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a past birthdate", () => {
    const result = profileSchema.safeParse({ birthdate: "1990-01-01" });
    expect(result.success).toBe(true);
  });

  // Regression guard: the check used to compare a UTC-parsed date against the
  // current instant, so in a UTC+X timezone today's date counted as future
  // during the first X hours of the day.
  it("accepts today as a birthdate regardless of the hour", () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const result = profileSchema.safeParse({ birthdate: today });
    expect(result.success).toBe(true);
  });

  it("rejects a birthdate in the future", () => {
    const futureYear = new Date().getFullYear() + 1;
    const result = profileSchema.safeParse({ birthdate: `${futureYear}-01-01` });
    expect(result.success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
} from "./auth";
import de from "../../../messages/de.json";

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

describe("loginSchema", () => {
  // Bewusst unveraendert: Bestandskunden mit kuerzerem Passwort muessen sich
  // weiterhin anmelden koennen. Die neue Regel gilt nur fuer *neue* Passwoerter.
  it("nimmt ein kurzes Bestandspasswort beim Anmelden weiterhin an", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "123456" });
    expect(result.success).toBe(true);
  });
});

describe("registerSchema", () => {
  // Acht Zeichen aus drei Zeichenklassen. Dieselbe Regel muss im
  // Supabase-Dashboard stehen, sonst sagt die App "passt" und der Dienst
  // weist ab -- siehe den Kommentar in auth.ts.
  it("nimmt ein Passwort an, das alle drei Zeichenklassen und 8 Zeichen hat", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "Passwort1" });
    expect(result.success).toBe(true);
  });

  it("lehnt sieben Zeichen ab, auch wenn alle Klassen vorkommen", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "Passw1r" });
    expect(result.success).toBe(false);
  });

  it("lehnt ein Passwort ohne Ziffer ab", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "Passwortt" });
    expect(result.success).toBe(false);
  });

  it("lehnt ein Passwort ohne Großbuchstaben ab", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "passwort1" });
    expect(result.success).toBe(false);
  });

  it("lehnt ein Passwort ohne Kleinbuchstaben ab", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "PASSWORT1" });
    expect(result.success).toBe(false);
  });

  it("nennt in der Meldung die vollständige Anforderung, nicht nur die Länge", () => {
    // Seit 2026-09-13 liefert das Schema Schlüssel statt deutscher Sätze (das
    // Formular übersetzt sie). Die Absicht bleibt: Jeder Verstoß — Länge,
    // Ziffer, Groß- oder Kleinbuchstabe — führt auf dieselbe vollständige
    // Anforderung, nie auf eine Meldung, die nur die Länge nennt.
    for (const password of ["Passw1r", "Passwortt", "passwort1", "PASSWORT1"]) {
      const result = registerSchema.safeParse({ email: "a@b.com", password });
      expect(result.success, password).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message, password).toBe("passwordHint");
      }
    }
    // Und der Text hinter dem Schlüssel nennt die Ziffer tatsächlich.
    expect(de.auth.passwordHint).toContain("Ziffer");
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
      password: "Passwort1",
      confirmPassword: "Passwort1",
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

describe("changePasswordSchema (PROJ-73)", () => {
  const gueltig = {
    currentPassword: "Altes2026",
    password: "Neues2026",
    confirmPassword: "Neues2026",
  };

  it("accepts a current password plus a matching new one", () => {
    expect(changePasswordSchema.safeParse(gueltig).success).toBe(true);
  });

  it("rejects a mismatched repetition", () => {
    const result = changePasswordSchema.safeParse({ ...gueltig, confirmPassword: "Neues2027" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("valPasswordsDiffer");
  });

  it("holds the new password to the same rule as a reset", () => {
    const result = changePasswordSchema.safeParse({
      ...gueltig,
      password: "kleinbuchstaben",
      confirmPassword: "kleinbuchstaben",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("passwordHint");
  });

  it("rejects an empty current password", () => {
    const result = changePasswordSchema.safeParse({ ...gueltig, currentPassword: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("valPasswordRequired");
  });

  // Bestandskunden haben teils kürzere Passwörter als die heutige Regel
  // verlangt. Das *aktuelle* Feld darf sie deshalb nicht prüfen — sonst käme
  // niemand von ihnen je zu einem neuen Passwort.
  it("does not hold the current password to the new rule", () => {
    const result = changePasswordSchema.safeParse({ ...gueltig, currentPassword: "kurz" });
    expect(result.success).toBe(true);
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

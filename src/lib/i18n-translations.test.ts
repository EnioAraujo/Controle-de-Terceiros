import { describe, it, expect } from "vitest";
import { mapSupabaseError } from "@/lib/i18n-translations";

describe("mapSupabaseError", () => {
  it("mapeia 'Invalid login credentials' para pt-BR", () => {
    const r = mapSupabaseError("Invalid login credentials", "pt-BR");
    expect(r).not.toBe("Invalid login credentials");
    expect(r.length).toBeGreaterThan(0);
  });

  it("mapeia 'Invalid login credentials' para en-US", () => {
    const r = mapSupabaseError("Invalid login credentials", "en-US");
    expect(r).not.toBe("Invalid login credentials");
    expect(r.length).toBeGreaterThan(0);
  });

  it("mapeia 'Email not confirmed' para ambos os idiomas", () => {
    const ptBR = mapSupabaseError("Email not confirmed", "pt-BR");
    const enUS = mapSupabaseError("Email not confirmed", "en-US");
    expect(ptBR).not.toBe(enUS);
    expect(ptBR.length).toBeGreaterThan(0);
    expect(enUS.length).toBeGreaterThan(0);
  });

  it("mapeia 'over_email_send_rate_limit'", () => {
    const r = mapSupabaseError("over_email_send_rate_limit", "pt-BR");
    expect(r).not.toBe("over_email_send_rate_limit");
  });

  it("mapeia erro de senha repetida", () => {
    const r = mapSupabaseError(
      "New password should be different from the old password",
      "pt-BR"
    );
    expect(r).not.toBe("New password should be different from the old password");
  });

  it("mapeia erro de senha curta", () => {
    const r = mapSupabaseError(
      "Password should be at least 6 characters",
      "pt-BR"
    );
    expect(r).not.toBe("Password should be at least 6 characters");
  });

  it("retorna mensagem original se não mapeada", () => {
    const msg = "Unknown error XYZ-123";
    expect(mapSupabaseError(msg, "pt-BR")).toBe(msg);
    expect(mapSupabaseError(msg, "en-US")).toBe(msg);
  });

  it("faz match parcial (includes) na mensagem", () => {
    const r = mapSupabaseError(
      "AuthApiError: Invalid login credentials (some extra info)",
      "pt-BR"
    );
    expect(r).not.toContain("Invalid login credentials");
  });
});

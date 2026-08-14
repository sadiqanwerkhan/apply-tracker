import { describe, it, expect } from "vitest";
import { findApplicationsInput, getApplicationDetailInput } from "./schemas";

describe("agent tool input schemas", () => {
  it("find_applications: company is optional, must be a string", () => {
    expect(findApplicationsInput.safeParse({ company: "SAP" }).success).toBe(true);
    expect(findApplicationsInput.safeParse({}).success).toBe(true);
    expect(findApplicationsInput.safeParse({ company: 123 }).success).toBe(false);
  });

  it("get_application_detail: id and company both optional strings", () => {
    expect(getApplicationDetailInput.safeParse({ applicationId: "abc" }).success).toBe(true);
    expect(getApplicationDetailInput.safeParse({ company: "Google" }).success).toBe(true);
    expect(getApplicationDetailInput.safeParse({}).success).toBe(true);
    expect(getApplicationDetailInput.safeParse({ applicationId: 5 }).success).toBe(false);
  });
});
import { describe, expect, it, vi } from "vitest";
import { CustomOAuthProvider } from "./custom-oauth";

describe("CustomOAuthProvider email_verified claim", () => {
  async function emailVerifiedFor(claims: Record<string, unknown>, trustEmailVerified?: boolean) {
    const provider = await CustomOAuthProvider.create({
      clientId: "x",
      clientSecret: "y",
      redirectUri: "http://localhost/cb",
      authorizationEndpoint: "https://idp.example.com/authorize",
      tokenEndpoint: "https://idp.example.com/token",
      userinfoEndpoint: "https://idp.example.com/userinfo",
      trustEmailVerified,
    });
    vi.spyOn(provider.oauthClient, "userinfo").mockResolvedValue({
      sub: "account-123",
      email: "victim@example.com",
      ...claims,
    });
    const userInfo = await provider.postProcessUserInfo({ accessToken: "token", accessTokenExpiredAt: null });
    return userInfo.emailVerified;
  }

  it.each([true, "true"])("treats email_verified %j as verified", async (claim) => {
    expect(await emailVerifiedFor({ email_verified: claim })).toBe(true);
  });

  it("falls back to verified_email when email_verified is absent", async () => {
    expect(await emailVerifiedFor({ verified_email: true })).toBe(true);
  });

  // Regression: `!!claim` turned non-spec string claims like "false" into `true`,
  // letting an unverified email link into an existing account.
  it.each([false, "false", "0", "no", "", "True", 1, null, undefined])("treats email_verified %j as unverified", async (claim) => {
    expect(await emailVerifiedFor({ email_verified: claim })).toBe(false);
  });

  it("trusts the admin's toggle when the provider sends no claim", async () => {
    expect(await emailVerifiedFor({}, true)).toBe(true);
  });
});

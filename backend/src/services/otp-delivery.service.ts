export async function sendPhoneOtp(phone: string, code: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production SMS provider is not configured");
  }

  console.info(`[DEV OTP] ${phone}: ${code}`);
}

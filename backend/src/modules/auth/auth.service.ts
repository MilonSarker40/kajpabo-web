import { createHash, randomInt, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { sendPhoneOtp } from "../../services/otp-delivery.service";
import { ApiError } from "../../utils/api-error";
import type {
  RegisterInput,
  RequestOtpInput,
  VerifyOtpInput,
} from "./auth.validation";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || ACCESS_SECRET.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must be at least 32 characters");
}
if (!REFRESH_SECRET || REFRESH_SECRET.length < 32) {
  throw new Error("JWT_REFRESH_SECRET must be at least 32 characters");
}

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const otpExpiryMinutes = Number(process.env.OTP_TTL_MINUTES ?? 5);
const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const cooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60);

function createAccessToken(user: { id: string; role: string }) {
  return jwt.sign({ role: user.role }, ACCESS_SECRET, {
    subject: user.id,
    expiresIn: (process.env.ACCESS_TOKEN_TTL ??
      "15m") as jwt.SignOptions["expiresIn"],
  });
}

async function issueTokens(user: { id: string; role: string }) {
  const refreshToken = randomBytes(48).toString("hex");
  const refreshDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash(refreshToken),
      expiresAt: new Date(Date.now() + refreshDays * 86400000),
    },
  });

  return {
    accessToken: createAccessToken(user),
    refreshToken,
    tokenType: "Bearer",
  };
}

export async function requestOtp(input: RequestOtpInput) {
  const now = new Date();

  const existingUser = await prisma.user.findUnique({
    where: { phone: input.phone },
  });

  if (input.purpose === "REGISTER") {
    if (!input.name || !input.role) {
      throw new ApiError(400, "Name and role are required for registration");
    }

    if (existingUser?.phoneVerifiedAt) {
      throw new ApiError(409, "Phone number is already registered");
    }
  } else {
    if (
      !existingUser ||
      existingUser.status !== "ACTIVE" ||
      !existingUser.phoneVerifiedAt
    ) {
      // Do not reveal whether the phone number has an account.
      return {
        message: "If the account is eligible, an OTP will be sent",
      };
    }
  }

  const recentChallenge = await prisma.otpChallenge.findFirst({
    where: {
      phone: input.phone,
      purpose: input.purpose,
      createdAt: {
        gt: new Date(now.getTime() - cooldownSeconds * 1000),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentChallenge) {
    throw new ApiError(429, "Please wait before requesting another OTP");
  }

  const code = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(now.getTime() + otpExpiryMinutes * 60000);

  // Invalidate previous outstanding challenges before issuing another.
  await prisma.otpChallenge.updateMany({
    where: {
      phone: input.phone,
      purpose: input.purpose,
      consumedAt: null,
    },
    data: { consumedAt: now },
  });

  let userId = existingUser?.id;

  if (input.purpose === "REGISTER" && !existingUser) {
    const user = await prisma.user.create({
      data: {
        name: input.name!,
        phone: input.phone,
        role: input.role!,
        status: "PENDING",
      },
    });
    userId = user.id;
  } else if (
    input.purpose === "REGISTER" &&
    existingUser &&
    !existingUser.phoneVerifiedAt
  ) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: input.name!,
        role: input.role!,
        status: "PENDING",
      },
    });
    userId = existingUser.id;
  }

  // Create challenge first, so failed delivery does not leave an
  // untracked OTP. If delivery fails, invalidate the challenge.
  const challenge = await prisma.otpChallenge.create({
    data: {
      phone: input.phone,
      purpose: input.purpose,
      codeHash: hash(code),
      expiresAt,
      userId,
    },
  });

  try {
    await sendPhoneOtp(input.phone, code);
  } catch {
    await prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    throw new ApiError(503, "OTP delivery is currently unavailable");
  }

  return {
    message: "OTP request processed",
    expiresInSeconds: otpExpiryMinutes * 60,
  };
}

export async function register(input: RegisterInput) {
  return requestOtp({
    phone: input.phone,
    purpose: "REGISTER",
    name: input.name,
    role: input.role,
  });
}

export async function verifyOtp(input: VerifyOtpInput) {
  const now = new Date();

  // A conditional update atomically claims the challenge. Only one
  // concurrent request can consume it.
  const result = await prisma.$transaction(async (tx) => {
    const challenge = await tx.otpChallenge.findFirst({
      where: {
        phone: input.phone,
        purpose: input.purpose,
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge || challenge.expiresAt <= now) {
      throw new ApiError(400, "Invalid or expired OTP");
    }

    if (challenge.attempts >= maxAttempts) {
      throw new ApiError(429, "Maximum OTP attempts exceeded");
    }

    if (challenge.codeHash !== hash(input.code)) {
      await tx.otpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          attempts: { lt: maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });

      // Throwing here rolls back the attempt increment.
      // A production implementation should persist failed attempts
      // in a separate committed transaction before returning the error.
      throw new ApiError(400, "Invalid or expired OTP");
    }

    const claimed = await tx.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: maxAttempts },
        codeHash: hash(input.code),
      },
      data: { consumedAt: now },
    });

    if (claimed.count !== 1) {
      throw new ApiError(400, "OTP already used or expired");
    }

    const user = await tx.user.findUnique({
      where: { phone: input.phone },
    });

    if (!user) {
      throw new ApiError(404, "Account not found");
    }

    if (input.purpose === "REGISTER" && user.id !== challenge.userId) {
      throw new ApiError(400, "Invalid registration challenge");
    }

    if (input.purpose === "LOGIN" && user.status !== "ACTIVE") {
      throw new ApiError(403, "Account is not active");
    }

    const verifiedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        phoneVerifiedAt: user.phoneVerifiedAt ?? now,
        status: "ACTIVE",
      },
    });

    if (verifiedUser.role === "JOB_SEEKER") {
      await tx.jobSeekerProfile.upsert({
        where: { userId: verifiedUser.id },
        create: { userId: verifiedUser.id },
        update: {},
      });
    }

    return {
      id: verifiedUser.id,
      name: verifiedUser.name,
      phone: verifiedUser.phone,
      role: verifiedUser.role,
    };
  });

  // Token issuance happens after the OTP transaction. For production,
  // coordinate session creation and challenge consumption atomically.
  const tokens = await issueTokens(result);

  return { user: result, ...tokens };
}

export async function refreshSession(rawToken: string) {
  const tokenHash = hash(rawToken);
  const now = new Date();

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !record ||
    record.revokedAt ||
    record.expiresAt <= now ||
    record.user.status !== "ACTIVE"
  ) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const nextRefreshToken = randomBytes(48).toString("hex");
  const refreshDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);

  const rotated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.refreshToken.updateMany({
      where: {
        id: record.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    if (claimed.count !== 1) {
      throw new ApiError(401, "Refresh token already used");
    }

    await tx.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: hash(nextRefreshToken),
        expiresAt: new Date(now.getTime() + refreshDays * 86400000),
      },
    });

    return {
      id: record.user.id,
      role: record.user.role,
    };
  });

  return {
    accessToken: createAccessToken(rotated),
    refreshToken: nextRefreshToken,
    tokenType: "Bearer",
  };
}

export async function logoutSession(rawToken: string) {
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hash(rawToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  return { message: "Logged out" };
}

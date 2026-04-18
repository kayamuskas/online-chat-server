import { BadRequestException } from '@nestjs/common';

const MAX_EMAIL_LENGTH = 254;
const MAX_USERNAME_LENGTH = 32;
const MIN_USERNAME_LENGTH = 2;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;
const MAX_TOKEN_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterBody {
  email: unknown;
  username: unknown;
  password: unknown;
}

interface SignInBody {
  email: unknown;
  password: unknown;
  keepSignedIn?: unknown;
}

interface ChangePasswordBody {
  currentPassword: unknown;
  newPassword: unknown;
}

interface ResetRequestBody {
  email: unknown;
}

interface ResetConfirmBody {
  token: unknown;
  newPassword: unknown;
}

function assertObject(body: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('request body must be a JSON object');
  }

  const record = body as Record<string, unknown>;
  const unexpectedKeys = Object.keys(record).filter((key) => !allowedKeys.includes(key));
  if (unexpectedKeys.length > 0) {
    throw new BadRequestException(`unexpected fields: ${unexpectedKeys.join(', ')}`);
  }

  return record;
}

function parseEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('email must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new BadRequestException('email must not be empty');
  }
  if (normalized.length > MAX_EMAIL_LENGTH) {
    throw new BadRequestException(`email must be at most ${MAX_EMAIL_LENGTH} characters`);
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new BadRequestException('email must be a valid email address');
  }

  return normalized;
}

function parseUsername(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('username must be a string');
  }

  const normalized = value.trim();
  if (normalized.length < MIN_USERNAME_LENGTH) {
    throw new BadRequestException(
      `username must be at least ${MIN_USERNAME_LENGTH} characters`,
    );
  }
  if (normalized.length > MAX_USERNAME_LENGTH) {
    throw new BadRequestException(
      `username must be at most ${MAX_USERNAME_LENGTH} characters`,
    );
  }

  return normalized;
}

function parsePassword(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a string`);
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(
      `${fieldName} must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new BadRequestException(
      `${fieldName} must be at most ${MAX_PASSWORD_LENGTH} characters`,
    );
  }

  return value;
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${fieldName} must be a boolean`);
  }
  return value;
}

function parseToken(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('token must be a string');
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new BadRequestException('token must not be empty');
  }
  if (normalized.length > MAX_TOKEN_LENGTH) {
    throw new BadRequestException(`token must be at most ${MAX_TOKEN_LENGTH} characters`);
  }

  return normalized;
}

export function parseRegisterBody(body: unknown) {
  const record = assertObject(body, ['email', 'username', 'password']);
  const typed = record as unknown as RegisterBody;
  return {
    email: parseEmail(typed.email),
    username: parseUsername(typed.username),
    password: parsePassword(typed.password, 'password'),
  };
}

export function parseSignInBody(body: unknown) {
  const record = assertObject(body, ['email', 'password', 'keepSignedIn']);
  const typed = record as unknown as SignInBody;
  return {
    email: parseEmail(typed.email),
    password: parsePassword(typed.password, 'password'),
    keepSignedIn:
      typed.keepSignedIn === undefined
        ? false
        : parseBoolean(typed.keepSignedIn, 'keepSignedIn'),
  };
}

export function parseChangePasswordBody(body: unknown) {
  const record = assertObject(body, ['currentPassword', 'newPassword']);
  const typed = record as unknown as ChangePasswordBody;
  return {
    currentPassword: parsePassword(typed.currentPassword, 'currentPassword'),
    newPassword: parsePassword(typed.newPassword, 'newPassword'),
  };
}

export function parseResetRequestBody(body: unknown) {
  const record = assertObject(body, ['email']);
  const typed = record as unknown as ResetRequestBody;
  return {
    email: parseEmail(typed.email),
  };
}

export function parseResetConfirmBody(body: unknown) {
  const record = assertObject(body, ['token', 'newPassword']);
  const typed = record as unknown as ResetConfirmBody;
  return {
    token: parseToken(typed.token),
    newPassword: parsePassword(typed.newPassword, 'newPassword'),
  };
}

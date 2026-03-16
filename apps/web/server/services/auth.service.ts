import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';

const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
    displayName: z.string().trim().min(1).max(60).optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

export type SafeUser = {
  id: string;
  email: string;
  displayName: string | null;
};

function toSafeUser(user: { id: string; email: string; displayName: string | null }): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

export async function signupUser(input: unknown): Promise<{ user: SafeUser; hasKennel: boolean }> {
  const parsed = signupSchema.parse(input);

  const existing = await db.user.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });

  if (existing) {
    throw new Error('An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const user = await db.user.create({
    data: {
      email: parsed.email,
      passwordHash,
      displayName: parsed.displayName?.trim() || null,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      kennel: {
        select: { id: true },
      },
    },
  });

  return {
    user: toSafeUser(user),
    hasKennel: !!user.kennel,
  };
}

export async function loginUser(input: unknown): Promise<{ user: SafeUser; hasKennel: boolean }> {
  const parsed = loginSchema.parse(input);

  const user = await db.user.findUnique({
    where: { email: parsed.email },
    select: {
      id: true,
      email: true,
      displayName: true,
      passwordHash: true,
      kennel: {
        select: { id: true },
      
      },
    },
  });

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const matches = await bcrypt.compare(parsed.password, user.passwordHash);
  if (!matches) {
    throw new Error('Invalid email or password.');
  }

  return {
    user: toSafeUser(user),
    hasKennel: !!user.kennel,
  };
}

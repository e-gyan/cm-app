import { z } from 'zod';
import { MemberType, MemberStatus } from '../types';

// --- CRYPTOGRAPHY ---

/**
 * Hashes a plaintext passcode using SHA-256.
 * We use the Web Crypto API which is native and secure.
 */
export const hashPasscode = async (plainText: string): Promise<string> => {
  if (!plainText) return '';
  const msgBuffer = new TextEncoder().encode(plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

/**
 * Verifies a plain text against a stored hash.
 */
export const verifyPasscode = async (plainText: string, storedHash: string): Promise<boolean> => {
  if (!storedHash) return false;
  // Fallback for legacy plain text passwords during migration phase
  if (storedHash.length < 64) {
      return plainText === storedHash;
  }
  const newHash = await hashPasscode(plainText);
  return newHash === storedHash;
};

// --- SCHEMA VALIDATION (Zod) ---

// Strict Enums
const MemberTypeEnum = z.nativeEnum(MemberType);
const MemberStatusEnum = z.nativeEnum(MemberStatus);
const ChurchEnum = z.enum(['UJ', 'I', 'K', 'LJ', 'ALL']);
const RoleEnum = z.enum(['ADMIN', 'TEACHER', 'NONE']);

// Member Schema - Strict input validation
export const MemberSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)), // Allow UUID or legacy IDs
  name: z.string().min(1).max(100).trim(), // Prevent massive strings
  type: MemberTypeEnum,
  joinedDate: z.string(),
  status: MemberStatusEnum,
  birthDate: z.string().optional(),
  assignedChurch: ChurchEnum,
  role: RoleEnum.optional().default('NONE'),
  passcode: z.string().max(100).optional(), // Can be hash or plain (during migration)
  isAccessActive: z.boolean().optional(),
});

// Attendance Schema
export const AttendanceRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD strict
  presentMemberIds: z.array(z.string()),
  punctualMemberIds: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(), // Limit notes length
  churchId: ChurchEnum,
});

// Full App Data Schema
export const AppDataSchema = z.object({
  members: z.array(MemberSchema),
  attendance: z.array(AttendanceRecordSchema),
  lastUpdated: z.number().optional(),
});

// --- SANITIZATION ---

export const sanitizeString = (str: string): string => {
  if (!str) return '';
  // Basic HTML entity replacement to prevent simple injection in non-React contexts
  // (React handles this automatically in JSX, but good practice for raw data storage)
  return str.replace(/[&<>"'/]/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return map[char];
  });
};
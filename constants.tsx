
import { QCError, UserRole, User } from './types';

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Mohsin', role: UserRole.MANAGER },
  { id: 'u2', name: 'Venkateshwaran', role: UserRole.MANAGER },
  { id: 'u3', name: 'Jimil', role: UserRole.QC_AGENT },
  { id: 'u4', name: 'Apurva', role: UserRole.QC_AGENT },
  { id: 'u5', name: 'Jash', role: UserRole.AGENT },
  { id: 'u6', name: 'Chaitanya', role: UserRole.AGENT },
  { id: 'u7', name: 'Priyanshu', role: UserRole.AGENT },
  { id: 'u8', name: 'Vivek', role: UserRole.AGENT },
  { id: 'u9', name: 'Manas', role: UserRole.AGENT },
  { id: 'u10', name: 'Admin User', role: UserRole.ADMIN },
];

export const PROJECTS = ['Moveeasy', 'Mfund', 'Altrum'];

export const QC_ERRORS: QCError[] = [
  { id: 'fmt1', name: 'Typo / Grammar Error', category: 'FORMATTING', weight: -5 },
  { id: 'fmt2', name: 'Incorrect Spacing', category: 'FORMATTING', weight: -2 },
  { id: 'fmt3', name: 'Wrong Font / Style', category: 'FORMATTING', weight: -2 },
  { id: 'adh1', name: 'Process Violation', category: 'ADHERENCE', weight: -10 },
  { id: 'adh2', name: 'Critical Data Mismatch', category: 'ADHERENCE', weight: 0 },
  { id: 'ftl1', name: 'Missed Client Instruction', category: 'FATAL', weight: -15 },
  { id: 'src1', name: 'Invalid Source Link', category: 'SOURCE', weight: -10 },
  { id: 'src2', name: 'Source Date Outdated', category: 'SOURCE', weight: -5 },
];

export const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
export const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

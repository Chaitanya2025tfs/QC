
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  QC_AGENT = 'QC_AGENT',
  AGENT = 'AGENT'
}

export enum AgentReviewStatus {
  PENDING = 'PENDING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  DISPUTED = 'DISPUTED'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface QCError {
  id: string;
  name: string;
  category: string;
  weight: number;
}

export interface SubSampleRecord {
  qcCode: string;
  errors: string[]; // IDs of errors
  noError: boolean;
  score: number;
}

export interface QCRecord {
  id: string;
  date: string;
  timeSlot: string; // "12 PM" | "4 PM" | "6 PM"
  tlName: string;
  agentName: string;
  managerName: string;
  qcCheckerName: string;
  projectName: string;
  taskName: string;
  reworkStatus: boolean;
  noWork: boolean;
  noAttachment: boolean;
  notes: string;
  qcCodeRangeStart: string;
  qcCodeRangeEnd: string;
  subSamples: SubSampleRecord[];
  manualScore?: number | null;
  manualErrors?: string[]; // New field for tracked manual errors
  manualNotes?: string; // New field for specific manual feedback
  avgScore: number;
  originalScore: number; 
  createdAt: number;
  agentReviewStatus: AgentReviewStatus;
  agentReviewNote?: string;
}

export interface ProjectStats {
  projectName: string;
  activeAgents: number;
  avgScore: number;
}

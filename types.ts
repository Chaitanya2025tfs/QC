
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  QC_AGENT = 'QC_AGENT',
  AGENT = 'AGENT'
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
  time: {
    hr: string;
    min: string;
    period: 'AM' | 'PM';
  };
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
  avgScore: number;
  createdAt: number;
}

export interface ProjectStats {
  projectName: string;
  activeAgents: number;
  avgScore: number;
}

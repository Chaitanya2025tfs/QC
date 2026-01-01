
import { QCRecord, User, ProductionRecord } from './types';
import { INITIAL_USERS } from './constants.tsx';

const DB_KEYS = {
  RECORDS: 'qc_tool_records',
  USERS: 'qc_tool_users',
  LOGGED_IN: 'qc_tool_current_user',
  PRODUCTION: 'qc_tool_production'
};

export const getRecords = (): QCRecord[] => {
  const data = localStorage.getItem(DB_KEYS.RECORDS);
  return data ? JSON.parse(data) : [];
};

export const saveRecord = (record: QCRecord) => {
  const records = getRecords();
  const index = records.findIndex(r => r.id === record.id);
  if (index > -1) {
    records[index] = record;
  } else {
    records.push(record);
  }
  localStorage.setItem(DB_KEYS.RECORDS, JSON.stringify(records));
};

export const deleteRecord = (id: string) => {
  const records = getRecords().filter(r => r.id !== id);
  localStorage.setItem(DB_KEYS.RECORDS, JSON.stringify(records));
};

export const getProductionRecords = (): ProductionRecord[] => {
  const data = localStorage.getItem(DB_KEYS.PRODUCTION);
  return data ? JSON.parse(data) : [];
};

export const saveProductionRecord = (record: ProductionRecord) => {
  const records = getProductionRecords();
  const index = records.findIndex(r => r.id === record.id);
  if (index > -1) {
    records[index] = record;
  } else {
    records.push(record);
  }
  localStorage.setItem(DB_KEYS.PRODUCTION, JSON.stringify(records));
};

export const deleteProductionRecord = (id: string) => {
  const records = getProductionRecords().filter(r => r.id !== id);
  localStorage.setItem(DB_KEYS.PRODUCTION, JSON.stringify(records));
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(DB_KEYS.USERS);
  if (!data) {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return JSON.parse(data);
};

export const updateUsers = (users: User[]) => {
  localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
};

export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem(DB_KEYS.LOGGED_IN);
  return data ? JSON.parse(data) : null;
};

export const setCurrentUserStore = (user: User | null) => {
  if (user) {
    localStorage.setItem(DB_KEYS.LOGGED_IN, JSON.stringify(user));
  } else {
    localStorage.removeItem(DB_KEYS.LOGGED_IN);
  }
};

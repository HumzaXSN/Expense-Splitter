/**
 * IndexedDB Storage Layer for Expense Splitting App
 * Uses idb library for a cleaner IndexedDB API
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Define the database schema
interface ExpenseSplitDB extends DBSchema {
  settings: {
    key: string;
    value: string;
  };
  groups: {
    key: string;
    value: {
      id: string;
      name: string;
      currency: string;
      members: string[];
      createdAt: string;
      updatedAt: string;
    };
    indexes: { 'by-name': string };
  };
  expenses: {
    key: string;
    value: {
      id: string;
      groupId: string;
      description: string;
      amount: number;
      date: string;
      paidBy: string;
      splitType: 'equal' | 'percentage' | 'fixed';
      splits: { memberId: string; amount: number; percentage?: number }[];
      category?: string;
      receiptNote?: string;
      createdAt: string;
    };
    indexes: { 'by-groupId': string; 'by-date': string };
  };
  settlements: {
    key: string;
    value: {
      id: string;
      groupId: string;
      fromMember: string;
      toMember: string;
      amount: number;
      method: string;
      date: string;
      note?: string;
      createdAt: string;
    };
    indexes: { 'by-groupId': string; 'by-date': string };
  };
}

let db: IDBPDatabase<ExpenseSplitDB> | null = null;

const DB_NAME = 'expense-split-db';
const DB_VERSION = 1;

/**
 * Initialize and open the IndexedDB database
 */
export async function initDB(): Promise<IDBPDatabase<ExpenseSplitDB>> {
  if (db) return db;

  db = await openDB<ExpenseSplitDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Settings store for app-wide settings (like username)
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings');
      }

      // Groups store
      const groupsStore = database.createObjectStore('groups', { keyPath: 'id' });
      groupsStore.createIndex('by-name', 'name');

      // Expenses store
      const expensesStore = database.createObjectStore('expenses', { keyPath: 'id' });
      expensesStore.createIndex('by-groupId', 'groupId');
      expensesStore.createIndex('by-date', 'date');

      // Settlements store
      const settlementsStore = database.createObjectStore('settlements', { keyPath: 'id' });
      settlementsStore.createIndex('by-groupId', 'groupId');
      settlementsStore.createIndex('by-date', 'date');
    },
  });

  return db;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * ================= SETTINGS OPERATIONS =================
 */

export async function getUsername(): Promise<string> {
  const database = await initDB();
  return (await database.get('settings', 'username')) || '';
}

export async function setUsername(username: string): Promise<void> {
  const database = await initDB();
  await database.put('settings', username, 'username');
}

/**
 * ================= GROUP OPERATIONS =================
 */

export async function getAllGroups(): Promise<ExpenseSplitDB['groups']['value'][]> {
  const database = await initDB();
  return database.getAll('groups');
}

export async function getGroup(id: string): Promise<ExpenseSplitDB['groups']['value'] | undefined> {
  const database = await initDB();
  return database.get('groups', id);
}

export async function createGroup(
  group: Omit<ExpenseSplitDB['groups']['value'], 'id' | 'createdAt' | 'updatedAt'>
): Promise<ExpenseSplitDB['groups']['value']> {
  const database = await initDB();
  const now = new Date().toISOString();
  const newGroup = {
    ...group,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  await database.add('groups', newGroup);
  return newGroup;
}

export async function updateGroup(
  id: string,
  updates: Partial<Omit<ExpenseSplitDB['groups']['value'], 'id' | 'createdAt'>>
): Promise<void> {
  const database = await initDB();
  const existing = await database.get('groups', id);
  if (!existing) throw new Error('Group not found');
  
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await database.put('groups', updated);
}

export async function deleteGroup(id: string): Promise<void> {
  const database = await initDB();
  // Delete all related expenses and settlements first
  const expenses = await database.getAllFromIndex('expenses', 'by-groupId', id);
  const settlements = await database.getAllFromIndex('settlements', 'by-groupId', id);
  
  await Promise.all([
    ...expenses.map(e => database.delete('expenses', e.id)),
    ...settlements.map(s => database.delete('settlements', s.id)),
  ]);
  
  await database.delete('groups', id);
}

/**
 * ================= EXPENSE OPERATIONS =================
 */

export async function getGroupExpenses(
  groupId: string
): Promise<ExpenseSplitDB['expenses']['value'][]> {
  const database = await initDB();
  return database.getAllFromIndex('expenses', 'by-groupId', groupId);
}

export async function getExpense(id: string): Promise<ExpenseSplitDB['expenses']['value'] | undefined> {
  const database = await initDB();
  return database.get('expenses', id);
}

export async function createExpense(
  expense: Omit<ExpenseSplitDB['expenses']['value'], 'id' | 'createdAt'>
): Promise<ExpenseSplitDB['expenses']['value']> {
  const database = await initDB();
  const newExpense = {
    ...expense,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  await database.add('expenses', newExpense);
  return newExpense;
}

export async function updateExpense(
  id: string,
  updates: Partial<Omit<ExpenseSplitDB['expenses']['value'], 'id' | 'createdAt'>>
): Promise<void> {
  const database = await initDB();
  const existing = await database.get('expenses', id);
  if (!existing) throw new Error('Expense not found');
  
  const updated = { ...existing, ...updates };
  await database.put('expenses', updated);
}

export async function deleteExpense(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('expenses', id);
}

/**
 * ================= SETTLEMENT OPERATIONS =================
 */

export async function getGroupSettlements(
  groupId: string
): Promise<ExpenseSplitDB['settlements']['value'][]> {
  const database = await initDB();
  return database.getAllFromIndex('settlements', 'by-groupId', groupId);
}

export async function createSettlement(
  settlement: Omit<ExpenseSplitDB['settlements']['value'], 'id' | 'createdAt'>
): Promise<ExpenseSplitDB['settlements']['value']> {
  const database = await initDB();
  const newSettlement = {
    ...settlement,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  await database.add('settlements', newSettlement);
  return newSettlement;
}

export async function deleteSettlement(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('settlements', id);
}

/**
 * ================= DATA EXPORT/IMPORT =================
 */

export async function exportAllData() {
  const database = await initDB();
  const groups = await database.getAll('groups');
  const expenses = await database.getAll('expenses');
  const settlements = await database.getAll('settlements');
  const username = await getUsername();

  return {
    settings: { username },
    groups,
    expenses,
    settlements,
    exportedAt: new Date().toISOString(),
  };
}

export async function importAllData(data: any): Promise<void> {
  const database = await initDB();
  
  // Clear existing data
  await Promise.all([
    database.clear('groups'),
    database.clear('expenses'),
    database.clear('settlements'),
  ]);

  // Import new data
  if (data.settings?.username) {
    await setUsername(data.settings.username);
  }

  if (data.groups?.length) {
    await Promise.all(data.groups.map((group: any) => database.add('groups', group)));
  }

  if (data.expenses?.length) {
    await Promise.all(data.expenses.map((expense: any) => database.add('expenses', expense)));
  }

  if (data.settlements?.length) {
    await Promise.all(data.settlements.map((settlement: any) => database.add('settlements', settlement)));
  }
}

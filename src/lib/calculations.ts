/**
 * Expense Splitting Calculations
 * Handles split calculations, balance tracking, and debt simplification
 */

import { ExpenseSplitDB } from './storage';

export interface Balance {
  memberId: string;
  amount: number; // Positive = they are owed money, Negative = they owe money
}

export interface SimplifiedDebt {
  fromMember: string;
  toMember: string;
  amount: number;
}

export interface MemberBalance {
  memberId: string;
  memberName: string;
  totalOwed: number; // Total amount this person owes others
  totalReceivable: number; // Total amount others owe this person
  netBalance: number; // Positive = net receivable, Negative = net owed
  owesTo: { memberId: string; memberName: string; amount: number }[];
  owedBy: { memberId: string; memberName: string; amount: number }[];
}

/**
 * Calculate balances for all members in a group
 * Considers both expenses and settlements
 */
export function calculateBalances(
  members: string[],
  expenses: ExpenseSplitDB['expenses']['value'][],
  settlements: ExpenseSplitDB['settlements']['value'][]
): Balance[] {
  // Initialize all balances to zero
  const balances: Record<string, number> = {};
  members.forEach(member => {
    balances[member] = 0;
  });

  // Process expenses
  expenses.forEach(expense => {
    // Add the full amount to the payer's balance (they paid, so they're owed)
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;

    // Subtract each person's share from their balance
    expense.splits.forEach(split => {
      balances[split.memberId] = (balances[split.memberId] || 0) - split.amount;
    });
  });

  // Process settlements
  settlements.forEach(settlement => {
    // Payer (fromMember) has already paid, so they're owed
    balances[settlement.fromMember] = (balances[settlement.fromMember] || 0) + settlement.amount;
    // Receiver (toMember) received the payment, so they owe less
    balances[settlement.toMember] = (balances[settlement.toMember] || 0) - settlement.amount;
  });

  // Convert to array format
  return members.map(memberId => ({
    memberId,
    amount: balances[memberId] || 0,
  }));
}

/**
 * Simplify debts using a greedy algorithm
 * Minimizes the number of transactions needed to settle all debts
 * 
 * Algorithm:
 * 1. Separate members into creditors (positive balance) and debtors (negative balance)
 * 2. Sort both groups by amount (descending for creditors, ascending for debtors)
 * 3. Match largest creditor with largest debtor repeatedly
 * 4. This minimizes the number of transactions
 */
export function simplifyDebts(balances: Balance[]): SimplifiedDebt[] {
  const simplified: SimplifiedDebt[] = [];
  
  // Create working copies
  const creditors = balances
    .filter(b => b.amount > 0.01) // Filter out very small amounts due to floating point
    .map(b => ({ ...b }))
    .sort((a, b) => b.amount - a.amount); // Sort descending

  const debtors = balances
    .filter(b => b.amount < -0.01)
    .map(b => ({ memberId: b.memberId, amount: -b.amount })) // Make positive for easier handling
    .sort((a, b) => b.amount - a.amount); // Sort descending

  // Match creditors with debtors
  let cIndex = 0;
  let dIndex = 0;

  while (cIndex < creditors.length && dIndex < debtors.length) {
    const creditor = creditors[cIndex];
    const debtor = debtors[dIndex];

    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0.01) {
      simplified.push({
        fromMember: debtor.memberId,
        toMember: creditor.memberId,
        amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
      });
    }

    // Update remaining amounts
    creditor.amount -= amount;
    debtor.amount -= amount;

    // Move to next if amount is exhausted
    if (creditor.amount < 0.01) cIndex++;
    if (debtor.amount < 0.01) dIndex++;
  }

  return simplified;
}

/**
 * Get detailed balance information for a specific member
 */
export function getMemberBalance(
  memberId: string,
  memberName: string,
  simplifiedDebts: SimplifiedDebt[]
): MemberBalance {
  let totalOwed = 0;
  let totalReceivable = 0;
  const owesTo: MemberBalance['owesTo'] = [];
  const owedBy: MemberBalance['owedBy'] = [];

  (simplifiedDebts || []).forEach(debt => {
    if (debt.fromMember === memberId) {
      // This member owes money
      totalOwed += debt.amount;
      owesTo.push({
        memberId: debt.toMember,
        memberName: debt.toMember, // Will be replaced with actual name by caller
        amount: debt.amount,
      });
    } else if (debt.toMember === memberId) {
      // This member is owed money
      totalReceivable += debt.amount;
      owedBy.push({
        memberId: debt.fromMember,
        memberName: debt.fromMember, // Will be replaced with actual name by caller
        amount: debt.amount,
      });
    }
  });

  const netBalance = totalReceivable - totalOwed;

  return {
    memberId,
    memberName,
    totalOwed,
    totalReceivable,
    netBalance,
    owesTo,
    owedBy,
  };
}

/**
 * Calculate expense splits based on split type
 */
export function calculateExpenseSplits(
  totalAmount: number,
  members: string[],
  splitType: 'equal' | 'percentage' | 'fixed',
  customSplits?: { memberId: string; value: number }[]
): { memberId: string; amount: number; percentage?: number }[] {
  const splits: { memberId: string; amount: number; percentage?: number }[] = [];

  if (splitType === 'equal') {
    if (members.length === 0) {
      throw new Error('Cannot split with no members');
    }
    const share = totalAmount / members.length;
    const percentage = 100 / members.length;
    members.forEach(memberId => {
      splits.push({
        memberId,
        amount: Math.round(share * 100) / 100,
        percentage,
      });
    });
  } else if (splitType === 'percentage') {
    if (!customSplits) throw new Error('Custom splits required for percentage split');

    if (customSplits.length === 0) {
      throw new Error('At least one member must have a percentage');
    }

    // Check that all splits are for valid members
    const validMembers = new Set(members);
    customSplits.forEach(split => {
      if (!validMembers.has(split.memberId)) {
        throw new Error(`Member "${split.memberId}" is not in this group`);
      }
    });

    // Validate percentages sum to 100
    const totalPercentage = customSplits.reduce((sum, s) => sum + s.value, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Percentages must sum to 100% (current: ${totalPercentage.toFixed(2)}%)`);
    }

    customSplits.forEach(split => {
      splits.push({
        memberId: split.memberId,
        amount: Math.round((totalAmount * split.value / 100) * 100) / 100,
        percentage: split.value,
      });
    });
  } else if (splitType === 'fixed') {
    if (!customSplits) throw new Error('Custom splits required for fixed split');

    if (customSplits.length === 0) {
      throw new Error('At least one member must have an amount');
    }

    // Check that all splits are for valid members
    const validMembers = new Set(members);
    customSplits.forEach(split => {
      if (!validMembers.has(split.memberId)) {
        throw new Error(`Member "${split.memberId}" is not in this group`);
      }
    });

    // Validate amounts sum to total
    const totalSplitAmount = customSplits.reduce((sum, s) => sum + s.value, 0);
    if (Math.abs(totalSplitAmount - totalAmount) > 0.01) {
      throw new Error(`Split amounts must equal total (split: ${totalSplitAmount.toFixed(2)}, total: ${totalAmount.toFixed(2)})`);
    }

    customSplits.forEach(split => {
      const percentage = (split.value / totalAmount) * 100;
      splits.push({
        memberId: split.memberId,
        amount: Math.round(split.value * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
      });
    });
  }

  return splits;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'PKR'): string {
  const formatter = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount);
}

/**
 * Get currency symbol for display in input fields
 */
export function getCurrencySymbol(currency: string = 'PKR'): string {
  const formatter = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  // Get the formatted version of 1 currency unit and extract the symbol
  const parts = formatter.formatToParts(1);
  const symbolPart = parts.find(part => part.type === 'currency');
  return symbolPart?.value || currency;
}

/**
 * Generate WhatsApp share text for balances
 * Includes trip overview, categories, recent expenses, and settlements
 */
export function generateWhatsAppShareText(
  groupName: string,
  currency: string,
  simplifiedDebts: SimplifiedDebt[],
  expenses?: ExpenseSplitDB['expenses']['value'][]
): string {
  let text = `💰 *${groupName} - Settlement Summary*\n\n`;

  // Add expenses summary if available
  if (expenses && expenses.length > 0) {
    // Calculate total spent
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Group expenses by category
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      const category = exp.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + exp.amount;
    });

    // Show total
    text += `📊 *Trip Overview*\n`;
    text += `💵 Total Spent: ${formatCurrency(totalSpent, currency)}\n`;
    text += `📝 Total Expenses: ${expenses.length}\n\n`;

    // Show category breakdown
    text += `📂 *Categories*\n`;
    Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, amount]) => {
        text += `• ${category}: ${formatCurrency(amount, currency)}\n`;
      });

    // Show some example expenses (up to 5)
    const recentExpenses = expenses.slice(0, 5);
    text += `\n📋 *Recent Expenses*\n`;
    recentExpenses.forEach((exp, index) => {
      const category = exp.category ? ` [${exp.category}]` : '';
      text += `${index + 1}. ${exp.description}${category}: ${formatCurrency(exp.amount, currency)}\n`;
    });
    if (expenses.length > 5) {
      text += `... and ${expenses.length - 5} more expenses\n`;
    }

    text += '\n';
  }

  // Show settlement summary
  if (!simplifiedDebts || simplifiedDebts.length === 0) {
    text += `✅ *All Settled Up!* 🎉\n\nEveryone's balances are clear!`;
  } else {
    text += `💸 *Settlements Needed*\n`;
    simplifiedDebts.forEach((debt, index) => {
      const amount = formatCurrency(debt.amount, currency);
      text += `${index + 1}. ${debt.fromMember} → ${debt.toMember}: ${amount}\n`;
    });
  }

  text += `\n_Generated by Expense Splitter_`;
  return text;
}

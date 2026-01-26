'use client';

/**
 * Expense Splitter PWA
 * A complete expense splitting application like Splitwise
 * 100% client-side with IndexedDB storage
 */

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Plus,
  Users,
  Wallet,
  History,
  Home,
  Settings,
  Edit2,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Download,
  Upload,
  Share2,
  X,
  Check,
  Calendar,
  DollarSign,
  User,
  LogOut,
  ChevronLeft,
  Search,
  Filter,
  Receipt,
  Clock,
} from 'lucide-react';

// Import storage and calculation utilities
import {
  getUsername,
  setUsername,
  getAllGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getGroupSettlements,
  createSettlement,
  deleteSettlement,
  exportAllData,
  importAllData,
} from '@/lib/storage';
import {
  calculateBalances,
  simplifyDebts,
  getMemberBalance,
  calculateExpenseSplits,
  formatCurrency,
  getCurrencySymbol,
  generateWhatsAppShareText,
  type SimplifiedDebt,
  type MemberBalance,
} from '@/lib/calculations';

// UI Components from shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type View = 'dashboard' | 'groups' | 'group-detail';
type GroupView = 'balances' | 'add-expense' | 'history';

interface Group {
  id: string;
  name: string;
  currency: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

interface Expense {
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
}

interface Settlement {
  id: string;
  groupId: string;
  fromMember: string;
  toMember: string;
  amount: number;
  method: string;
  date: string;
  note?: string;
  createdAt: string;
}

const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR'];
const EXPENSE_CATEGORIES = [
  'Food',
  'Rent',
  'Utilities',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Medical',
  'Other',
];
const PAYMENT_METHODS = ['Cash', 'JazzCash', 'EasyPaisa', 'Bank Transfer', 'UPI', 'PayPal', 'Other'];

export default function ExpenseSplitter() {
  const { toast } = useToast();
  
  // App state
  const [username, setUsernameState] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupView, setGroupView] = useState<GroupView>('balances');
  
  // Group data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState<SimplifiedDebt[]>([]);
  
  // Modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showEditExpenseModal, setShowEditExpenseModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Form states
  const [newGroupName, setNewGroupName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // All expenses and settlements for dashboard summary
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allSettlements, setAllSettlements] = useState<Settlement[]>([]);

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paidBy: '',
    splitType: 'equal' as 'equal' | 'percentage' | 'fixed',
    category: '',
    receiptNote: '',
    customSplits: [] as { memberId: string; value: number }[],
  });

  // Settlement form state
  const [settlementForm, setSettlementForm] = useState({
    fromMember: '',
    toMember: '',
    amount: '',
    method: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });

  // Load functions
  const loadUsername = useCallback(async () => {
    const name = await getUsername();
    if (name) {
      setUsernameState(name);
    } else {
      setShowUsernameModal(true);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    const loadedGroups = await getAllGroups();
    setGroups(loadedGroups);
  }, []);

  const loadGroupData = useCallback(async (groupId: string) => {
    const [loadedExpenses, loadedSettlements] = await Promise.all([
      getGroupExpenses(groupId),
      getGroupSettlements(groupId),
    ]);
    setExpenses(loadedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setSettlements(loadedSettlements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, []);

  const loadAllExpensesAndSettlements = useCallback(async () => {
    const loadedGroups = await getAllGroups();
    const allExpensesPromises = loadedGroups.map(group => getGroupExpenses(group.id));
    const allSettlementsPromises = loadedGroups.map(group => getGroupSettlements(group.id));

    const [allExpensesData, allSettlementsData] = await Promise.all([
      Promise.all(allExpensesPromises),
      Promise.all(allSettlementsPromises),
    ]);

    setAllExpenses(allExpensesData.flat());
    setAllSettlements(allSettlementsData.flat());
  }, []);

  // Load username on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsername();

    loadGroups();
  }, [loadUsername, loadGroups]);

  // Load all expenses and settlements for dashboard when groups are loaded
  useEffect(() => {
    if (groups.length > 0 && view === 'dashboard') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAllExpensesAndSettlements();
    }
  }, [groups, view, loadAllExpensesAndSettlements]);

  // Load group data when selected
  useEffect(() => {
    if (selectedGroup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadGroupData(selectedGroup.id);
    }
  }, [selectedGroup, loadGroupData]);

  // Recalculate balances when expenses or settlements change
  useEffect(() => {
    if (selectedGroup) {
      const balances = calculateBalances(selectedGroup.members, expenses, settlements);
      const simplified = simplifyDebts(balances);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSimplifiedDebts(simplified);
    }
  }, [expenses, settlements, selectedGroup]);

  const handleSetUsername = async () => {
    if (!username.trim()) {
      toast({ title: 'Error', description: 'Please enter a username', variant: 'destructive' });
      return;
    }
    await setUsername(username);
    setUsernameState(username);
    setShowUsernameModal(false);
    toast({ title: 'Success', description: 'Username saved!' });
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ title: 'Error', description: 'Please enter a group name', variant: 'destructive' });
      return;
    }
    const group = await createGroup({
      name: newGroupName,
      currency: 'PKR',
      members: [username],
    });
    setGroups([...groups, group]);
    setNewGroupName('');
    setShowCreateGroupModal(false);
    toast({ title: 'Success', description: 'Group created!' });
    // Reload all expenses and settlements for dashboard
    await loadAllExpensesAndSettlements();
  };

  const handleUpdateGroup = async (updates: { name?: string; currency?: string }) => {
    if (!selectedGroup) return;
    await updateGroup(selectedGroup.id, updates);
    const updatedGroup = await getGroup(selectedGroup.id);
    if (updatedGroup) {
      setSelectedGroup(updatedGroup);
      setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    }
    toast({ title: 'Success', description: 'Group updated!' });
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    await deleteGroup(selectedGroup.id);
    setGroups(groups.filter(g => g.id !== selectedGroup.id));
    setSelectedGroup(null);
    setView('dashboard');
    toast({ title: 'Success', description: 'Group deleted!' });
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !newMemberName.trim()) {
      toast({ title: 'Error', description: 'Please enter a member name', variant: 'destructive' });
      return;
    }
    if (selectedGroup.members.includes(newMemberName.trim())) {
      toast({ title: 'Error', description: 'Member already exists', variant: 'destructive' });
      return;
    }
    await updateGroup(selectedGroup.id, {
      members: [...selectedGroup.members, newMemberName.trim()],
    });
    const updatedGroup = await getGroup(selectedGroup.id);
    if (updatedGroup) {
      setSelectedGroup(updatedGroup);
      setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    }
    setNewMemberName('');
    setShowAddMemberModal(false);
    toast({ title: 'Success', description: 'Member added!' });
  };

  const handleRemoveMember = async (memberName: string) => {
    if (!selectedGroup) return;
    if (selectedGroup.members.length <= 1) {
      toast({ title: 'Error', description: 'Cannot remove the last member', variant: 'destructive' });
      return;
    }
    await updateGroup(selectedGroup.id, {
      members: selectedGroup.members.filter(m => m !== memberName),
    });
    const updatedGroup = await getGroup(selectedGroup.id);
    if (updatedGroup) {
      setSelectedGroup(updatedGroup);
      setGroups(groups.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    }
    toast({ title: 'Success', description: 'Member removed!' });
  };

  const handleAddExpense = async () => {
    if (!selectedGroup) return;

    try {
      // Validate inputs
      if (!expenseForm.description.trim()) {
        toast({ title: 'Error', description: 'Please enter a description', variant: 'destructive' });
        return;
      }
      if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
        toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
        return;
      }
      if (!expenseForm.paidBy) {
        toast({ title: 'Error', description: 'Please select who paid', variant: 'destructive' });
        return;
      }

      const amount = parseFloat(expenseForm.amount);
      
      // Calculate splits
      let splits;
      try {
        splits = calculateExpenseSplits(
          amount,
          selectedGroup.members,
          expenseForm.splitType,
          expenseForm.customSplits
        );
      } catch (error) {
        toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
        return;
      }

      await createExpense({
        groupId: selectedGroup.id,
        description: expenseForm.description,
        amount,
        date: expenseForm.date,
        paidBy: expenseForm.paidBy,
        splitType: expenseForm.splitType,
        splits,
        category: expenseForm.category || undefined,
        receiptNote: expenseForm.receiptNote || undefined,
      });

      await loadGroupData(selectedGroup.id);
      resetExpenseForm();
      setShowAddExpenseModal(false);
      toast({ title: 'Success', description: 'Expense added!' });
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({ title: 'Error', description: 'Failed to add expense', variant: 'destructive' });
    }
  };

  const handleEditExpense = async () => {
    if (!editingExpense || !selectedGroup) return;

    try {
      // Validate inputs
      if (!expenseForm.description.trim()) {
        toast({ title: 'Error', description: 'Please enter a description', variant: 'destructive' });
        return;
      }
      if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
        toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
        return;
      }
      if (!expenseForm.paidBy) {
        toast({ title: 'Error', description: 'Please select who paid', variant: 'destructive' });
        return;
      }

      const amount = parseFloat(expenseForm.amount);
      
      // Calculate splits
      let splits;
      try {
        splits = calculateExpenseSplits(
          amount,
          selectedGroup.members,
          expenseForm.splitType,
          expenseForm.customSplits
        );
      } catch (error) {
        toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
        return;
      }

      await updateExpense(editingExpense.id, {
        description: expenseForm.description,
        amount,
        date: expenseForm.date,
        paidBy: expenseForm.paidBy,
        splitType: expenseForm.splitType,
        splits,
        category: expenseForm.category || undefined,
        receiptNote: expenseForm.receiptNote || undefined,
      });

      await loadGroupData(selectedGroup.id);
      resetExpenseForm();
      setEditingExpense(null);
      setShowEditExpenseModal(false);
      toast({ title: 'Success', description: 'Expense updated!' });
    } catch (error) {
      console.error('Error editing expense:', error);
      toast({ title: 'Error', description: 'Failed to update expense', variant: 'destructive' });
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      if (selectedGroup) {
        await loadGroupData(selectedGroup.id);
      }
      toast({ title: 'Success', description: 'Expense deleted!' });
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({ title: 'Error', description: 'Failed to delete expense', variant: 'destructive' });
    }
  };

  const handleSettle = async () => {
    if (!selectedGroup) return;

    try {
      if (!settlementForm.fromMember || !settlementForm.toMember) {
        toast({ title: 'Error', description: 'Please select both members', variant: 'destructive' });
        return;
      }
      if (!settlementForm.amount || parseFloat(settlementForm.amount) <= 0) {
        toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
        return;
      }
      if (!settlementForm.method) {
        toast({ title: 'Error', description: 'Please select a payment method', variant: 'destructive' });
        return;
      }
      if (settlementForm.fromMember === settlementForm.toMember) {
        toast({ title: 'Error', description: 'Cannot settle with yourself', variant: 'destructive' });
        return;
      }

      await createSettlement({
        groupId: selectedGroup.id,
        fromMember: settlementForm.fromMember,
        toMember: settlementForm.toMember,
        amount: parseFloat(settlementForm.amount),
        method: settlementForm.method,
        date: settlementForm.date,
        note: settlementForm.note || undefined,
      });

      await loadGroupData(selectedGroup.id);
      resetSettlementForm();
      setShowSettleModal(false);
      toast({ title: 'Success', description: 'Settlement recorded!' });
    } catch (error) {
      console.error('Error recording settlement:', error);
      toast({ title: 'Error', description: 'Failed to record settlement', variant: 'destructive' });
    }
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    try {
      await deleteSettlement(settlementId);
      if (selectedGroup) {
        await loadGroupData(selectedGroup.id);
      }
      toast({ title: 'Success', description: 'Settlement deleted!' });
    } catch (error) {
      console.error('Error deleting settlement:', error);
      toast({ title: 'Error', description: 'Failed to delete settlement', variant: 'destructive' });
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paidBy: '',
      splitType: 'equal',
      category: '',
      receiptNote: '',
      customSplits: [],
    });
  };

  const resetSettlementForm = () => {
    setSettlementForm({
      fromMember: '',
      toMember: '',
      amount: '',
      method: '',
      date: new Date().toISOString().split('T')[0],
      note: '',
    });
  };

  const handleExportData = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense-splitter-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Success', description: 'Data exported successfully!' });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({ title: 'Error', description: 'Failed to export data', variant: 'destructive' });
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data);
      await loadGroups();
      if (selectedGroup) {
        await loadGroupData(selectedGroup.id);
      }
      toast({ title: 'Success', description: 'Data imported successfully!' });
    } catch (error) {
      console.error('Error importing data:', error);
      toast({ title: 'Error', description: 'Failed to import data. Please check the file format.', variant: 'destructive' });
    }
    event.target.value = '';
  };

  const handleWhatsAppShare = () => {
    if (!selectedGroup) return;
    const text = generateWhatsAppShareText(selectedGroup.name, selectedGroup.currency, simplifiedDebts, expenses);
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/?text=${encodedText}`;
    window.open(url, '_blank');
    toast({ title: 'Sharing...', description: 'Opening WhatsApp' });
  };

  const handleEditExpenseClick = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date.split('T')[0],
      paidBy: expense.paidBy,
      splitType: expense.splitType,
      category: expense.category || '',
      receiptNote: expense.receiptNote || '',
      customSplits: expense.splits.map(s => ({
        memberId: s.memberId,
        value: expense.splitType === 'percentage' ? s.percentage || 0 : s.amount,
      })),
    });
    setShowEditExpenseModal(true);
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.paidBy.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || expense.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredSettlements = settlements.filter(settlement => {
    return settlement.fromMember.toLowerCase().includes(searchQuery.toLowerCase()) ||
      settlement.toMember.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getMemberBalanceInfo = (memberName: string): MemberBalance => {
    const balance = getMemberBalance(memberName, memberName, simplifiedDebts || []);
    return balance;
  };

  const getYourBalances = (): MemberBalance | null => {
    if (!selectedGroup || !selectedGroup.members.includes(username)) {
      return null;
    }
    return getMemberBalance(username, username, simplifiedDebts || []);
  };

  // Render username modal
  if (showUsernameModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to Expense Splitter</CardTitle>
            <CardDescription>Enter your name to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Your Name</Label>
                <Input
                  id="username"
                  placeholder="e.g., Ahmed"
                  value={username}
                  onChange={(e) => setUsernameState(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSetUsername()}
                  autoFocus
                />
              </div>
              <Button onClick={handleSetUsername} className="w-full" size="lg">
                Get Started
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render dashboard view
  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Expense Splitter</h1>
                  <p className="text-sm text-muted-foreground">Split expenses easily</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {username}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSettingsModal(true)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Your Groups</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAllExpensesAndSettlements}
                  title="Refresh groups data"
                >
                  <ArrowDownCircle className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button onClick={() => setShowCreateGroupModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Group
                </Button>
              </div>
            </div>

            {groups.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first group to start splitting expenses
                  </p>
                  <Button onClick={() => setShowCreateGroupModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Group
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => {
                  const groupExpenses = allExpenses.filter(e => e.groupId === group.id);
                  const groupSettlements = allSettlements.filter(s => s.groupId === group.id);
                  const totalSpent = groupExpenses.reduce((sum, exp) => sum + exp.amount, 0);
                  const yourExpenses = groupExpenses.filter(e => e.paidBy === username);
                  const yourTotalSpent = yourExpenses.reduce((sum, exp) => sum + exp.amount, 0);

                  // Calculate your net balance in this group
                  const groupBalances = calculateBalances(group.members, groupExpenses, groupSettlements);
                  const yourBalance = groupBalances.find(b => b.memberId === username);
                  const netBalance = yourBalance?.amount || 0;

                  return (
                    <Card
                      key={group.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => {
                        setSelectedGroup(group);
                        setView('group-detail');
                        setGroupView('balances');
                      }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              <Users className="w-5 h-5 text-primary" />
                              {group.name}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {group.members.length} member{group.members.length !== 1 ? 's' : ''} • {group.currency}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Receipt className="w-4 h-4" />
                                {groupExpenses.length}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {groupSettlements.length}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Total Spent</span>
                              <span className="font-semibold">{formatCurrency(totalSpent, group.currency)}</span>
                            </div>
                            {group.members.includes(username) && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Your Balance</span>
                                <span className={`font-semibold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance, group.currency)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Create Group Modal */}
        <Dialog open={showCreateGroupModal} onOpenChange={setShowCreateGroupModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Create a group to start splitting expenses with friends
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  placeholder="e.g., Roommates, Trip to Lahore"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateGroupModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGroup}>Create Group</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Settings Modal */}
        <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>Manage your account and data</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Your Name</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsernameState(e.target.value)}
                  placeholder="Your name"
                />
                <Button
                  onClick={async () => {
                    await setUsername(username);
                    toast({ title: 'Success', description: 'Username updated!' });
                  }}
                  className="mt-2"
                  size="sm"
                >
                  Update Name
                </Button>
              </div>
              <Separator />
              <div>
                <Label className="mb-2 block">Data Management</Label>
                <div className="space-y-2">
                  <Button onClick={handleExportData} variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Export All Data
                  </Button>
                  <div>
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSettingsModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Render group detail view
  if (view === 'group-detail' && selectedGroup) {
    const yourBalances = getYourBalances();

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView('dashboard')}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-xl font-bold">{selectedGroup.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedGroup.members.length} member{selectedGroup.members.length !== 1 ? 's' : ''} • {selectedGroup.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAddMemberModal(true)}
                  title="Add member"
                >
                  <User className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSettingsModal(true)}
                  title="Group settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6">
          {/* Your Balance Card */}
          {yourBalances && (
            <Card className="mb-6 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              <CardHeader>
                <CardTitle className="text-lg">Your Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-blue-100 text-sm">Total Owed</p>
                    <p className="text-2xl font-bold">{formatCurrency(yourBalances.totalOwed, selectedGroup.currency)}</p>
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm">Total Receivable</p>
                    <p className="text-2xl font-bold">{formatCurrency(yourBalances.totalReceivable, selectedGroup.currency)}</p>
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm">Net Balance</p>
                    <p className={`text-2xl font-bold ${yourBalances.netBalance >= 0 ? '' : 'text-red-200'}`}>
                      {yourBalances.netBalance >= 0 ? '+' : ''}{formatCurrency(yourBalances.netBalance, selectedGroup.currency)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs value={groupView} onValueChange={(v) => setGroupView(v as GroupView)} className="mb-6">
            <TabsList className="grid w-full grid-cols-3" style={{ display: 'inherit' }}>
              <TabsTrigger value="balances">
                <ArrowDownCircle className="w-4 h-4 mr-2" />
                Balances
              </TabsTrigger>
              <TabsTrigger value="add-expense">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Balances Tab */}
            <TabsContent value="balances" className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Settlement Summary</h2>
                <Button variant="outline" onClick={handleWhatsAppShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>

              {simplifiedDebts.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <h3 className="text-lg font-semibold text-green-600 mb-2">All Settled Up!</h3>
                    <p className="text-muted-foreground">Everyone's balances are clear</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {simplifiedDebts.map((debt, index) => (
                    <Card key={index} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className={`font-medium ${debt.fromMember === username ? 'text-red-600' : ''}`}>
                                {debt.fromMember === username ? 'You' : debt.fromMember}
                              </span>
                            </div>
                            <ArrowDownCircle className="w-4 h-4 text-muted-foreground mx-auto my-2" />
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className={`font-medium ${debt.toMember === username ? 'text-green-600' : ''}`}>
                                {debt.toMember === username ? 'You' : debt.toMember}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">
                              {formatCurrency(debt.amount, selectedGroup.currency)}
                            </p>
                            <Button
                              size="sm"
                              className="mt-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium shadow-md"
                              onClick={() => {
                                setSettlementForm({
                                  fromMember: debt.fromMember,
                                  toMember: debt.toMember,
                                  amount: debt.amount.toString(),
                                  method: '',
                                  date: new Date().toISOString().split('T')[0],
                                  note: '',
                                });
                                setShowSettleModal(true);
                              }}
                            >
                              Record Payment
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* All Members Balances */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>All Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {selectedGroup.members.map((member) => {
                        const balance = getMemberBalanceInfo(member);
                        return (
                          <div
                            key={member}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {member === username ? 'You' : member}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {balance.netBalance >= 0 ? 'Gets back' : 'Owes'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xl font-bold ${balance.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balance.netBalance >= 0 ? '+' : ''}{formatCurrency(Math.abs(balance.netBalance), selectedGroup.currency)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Add Expense Tab */}
            <TabsContent value="add-expense" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Expense</CardTitle>
                  <CardDescription>Record a new expense for the group</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="expense-description">Description</Label>
                    <Input
                      id="expense-description"
                      placeholder="e.g., Dinner at restaurant"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="expense-amount">Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground flex items-center justify-center">
                          {selectedGroup ? getCurrencySymbol(selectedGroup.currency) : 'Rs'}
                        </span>
                        <Input
                          id="expense-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="expense-date">Date</Label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="expense-paid-by">Paid By</Label>
                    <Select
                      value={expenseForm.paidBy}
                      onValueChange={(value) => setExpenseForm({ ...expenseForm, paidBy: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select who paid" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedGroup.members.map((member) => (
                          <SelectItem key={member} value={member}>
                            {member === username ? 'You' : member}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expense-split">Split Type</Label>
                    <Select
                      value={expenseForm.splitType}
                      onValueChange={(value: any) => setExpenseForm({ ...expenseForm, splitType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equal">Equally among all</SelectItem>
                        <SelectItem value="percentage">By percentage</SelectItem>
                        <SelectItem value="fixed">Unequal / Fixed amounts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(expenseForm.splitType === 'percentage' || expenseForm.splitType === 'fixed') && (
                    <div className="space-y-3 p-4 bg-muted rounded-lg">
                      <Label>
                        {expenseForm.splitType === 'percentage' ? 'Percentage' : 'Amount'} per member
                        {expenseForm.splitType === 'percentage' && ' (must sum to 100%)'}
                      </Label>
                      {selectedGroup.members.map((member) => (
                        <div key={member} className="flex items-center gap-2">
                          <span className="flex-1 text-sm">{member === username ? 'You' : member}</span>
                          <div className="relative w-32">
                            <Input
                              type="number"
                              step={expenseForm.splitType === 'percentage' ? '0.01' : '0.01'}
                              min="0"
                              placeholder={expenseForm.splitType === 'percentage' ? '%' : '0.00'}
                              value={expenseForm.customSplits.find(s => s.memberId === member)?.value || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setExpenseForm({
                                  ...expenseForm,
                                  customSplits: [
                                    ...expenseForm.customSplits.filter(s => s.memberId !== member),
                                    { memberId: member, value }
                                  ]
                                });
                              }}
                            />
                            {expenseForm.splitType === 'percentage' && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {expenseForm.splitType === 'percentage' && (
                        <p className="text-sm text-muted-foreground">
                          Total: {expenseForm.customSplits.reduce((sum, s) => sum + s.value, 0).toFixed(2)}%
                        </p>
                      )}
                      {expenseForm.splitType === 'fixed' && (
                        <p className="text-sm text-muted-foreground">
                          Total: {formatCurrency(expenseForm.customSplits.reduce((sum, s) => sum + s.value, 0), selectedGroup.currency)}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="expense-category">Category (Optional)</Label>
                    <Select
                      value={expenseForm.category}
                      onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expense-note">Receipt Note (Optional)</Label>
                    <Textarea
                      id="expense-note"
                      placeholder="Add any notes about the receipt or expense..."
                      value={expenseForm.receiptNote}
                      onChange={(e) => setExpenseForm({ ...expenseForm, receiptNote: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleAddExpense} className="w-full" size="lg">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Expense
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search expenses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filteredExpenses.length === 0 && filteredSettlements.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <History className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold mb-2">No history yet</h3>
                    <p className="text-muted-foreground">
                      Add your first expense to see it here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {filteredExpenses.map((expense) => (
                      <Card key={expense.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {expense.category && (
                                  <Badge variant="secondary">{expense.category}</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(expense.date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <h3 className="font-semibold mb-1">{expense.description}</h3>
                              <p className="text-sm text-muted-foreground">
                                Paid by {expense.paidBy === username ? 'you' : expense.paidBy} • Split {expense.splitType}
                              </p>
                              {expense.receiptNote && (
                                <p className="text-sm text-muted-foreground mt-1 italic">
                                  "{expense.receiptNote}"
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-primary">
                                {formatCurrency(expense.amount, selectedGroup.currency)}
                              </p>
                              <div className="flex items-center gap-1 mt-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditExpenseClick(expense)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteExpense(expense.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {filteredSettlements.map((settlement) => (
                      <Card key={settlement.id} className="bg-green-50 dark:bg-green-900/20">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                  Settlement
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(settlement.date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <h3 className="font-semibold mb-1">
                                {settlement.fromMember === username ? 'You paid' : settlement.fromMember} →{' '}
                                {settlement.toMember === username ? 'you' : settlement.toMember}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Via {settlement.method}
                              </p>
                              {settlement.note && (
                                <p className="text-sm text-muted-foreground mt-1 italic">
                                  "{settlement.note}"
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-green-600">
                                {formatCurrency(settlement.amount, selectedGroup.currency)}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="mt-2"
                                onClick={() => handleDeleteSettlement(settlement.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </main>

        {/* Add Member Modal */}
        <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Member</DialogTitle>
              <DialogDescription>Add a new member to this group</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="member-name">Member Name</Label>
                <Input
                  id="member-name"
                  placeholder="e.g., Ali"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                  autoFocus
                />
              </div>
              <div>
                <Label>Current Members</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedGroup.members.map((member) => (
                    <Badge
                      key={member}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {member === username ? 'You' : member}
                      {member !== username && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMemberModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMember}>Add Member</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Settlement Modal */}
        <Dialog open={showSettleModal} onOpenChange={setShowSettleModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>Record a settlement between members</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>From (payer)</Label>
                <Select
                  value={settlementForm.fromMember}
                  onValueChange={(value) => setSettlementForm({ ...settlementForm, fromMember: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payer" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedGroup.members.map((member) => (
                      <SelectItem key={member} value={member}>
                        {member === username ? 'You' : member}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>To (receiver)</Label>
                <Select
                  value={settlementForm.toMember}
                  onValueChange={(value) => setSettlementForm({ ...settlementForm, toMember: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select receiver" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedGroup.members
                      .filter(m => m !== settlementForm.fromMember)
                      .map((member) => (
                        <SelectItem key={member} value={member}>
                          {member === username ? 'You' : member}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="settlement-amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground flex items-center justify-center">
                    {selectedGroup ? getCurrencySymbol(selectedGroup.currency) : 'Rs'}
                  </span>
                  <Input
                    id="settlement-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={settlementForm.amount}
                    onChange={(e) => setSettlementForm({ ...settlementForm, amount: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="settlement-date">Date</Label>
                <Input
                  id="settlement-date"
                  type="date"
                  value={settlementForm.date}
                  onChange={(e) => setSettlementForm({ ...settlementForm, date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="settlement-method">Payment Method</Label>
                <Select
                  value={settlementForm.method}
                  onValueChange={(value) => setSettlementForm({ ...settlementForm, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="settlement-note">Note (Optional)</Label>
                <Textarea
                  id="settlement-note"
                  placeholder="Add a note about this payment..."
                  value={settlementForm.note}
                  onChange={(e) => setSettlementForm({ ...settlementForm, note: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettleModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSettle}>Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Expense Modal */}
        <Dialog open={showEditExpenseModal} onOpenChange={setShowEditExpenseModal}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
              <DialogDescription>Update the expense details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  placeholder="e.g., Dinner at restaurant"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground flex items-center justify-center">
                      {selectedGroup ? getCurrencySymbol(selectedGroup.currency) : 'Rs'}
                    </span>
                    <Input
                      id="edit-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-paid-by">Paid By</Label>
                <Select
                  value={expenseForm.paidBy}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, paidBy: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who paid" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedGroup.members.map((member) => (
                      <SelectItem key={member} value={member}>
                        {member === username ? 'You' : member}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-split">Split Type</Label>
                <Select
                  value={expenseForm.splitType}
                  onValueChange={(value: any) => setExpenseForm({ ...expenseForm, splitType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">Equally among all</SelectItem>
                    <SelectItem value="percentage">By percentage</SelectItem>
                    <SelectItem value="fixed">Unequal / Fixed amounts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(expenseForm.splitType === 'percentage' || expenseForm.splitType === 'fixed') && (
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <Label>
                    {expenseForm.splitType === 'percentage' ? 'Percentage' : 'Amount'} per member
                  </Label>
                  {selectedGroup.members.map((member) => (
                    <div key={member} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{member === username ? 'You' : member}</span>
                      <div className="relative w-32">
                        <Input
                          type="number"
                          step={expenseForm.splitType === 'percentage' ? '0.01' : '0.01'}
                          min="0"
                          placeholder={expenseForm.splitType === 'percentage' ? '%' : '0.00'}
                          value={expenseForm.customSplits.find(s => s.memberId === member)?.value || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setExpenseForm({
                              ...expenseForm,
                              customSplits: [
                                ...expenseForm.customSplits.filter(s => s.memberId !== member),
                                { memberId: member, value }
                              ]
                            });
                          }}
                        />
                        {expenseForm.splitType === 'percentage' && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {expenseForm.splitType === 'percentage' && (
                    <p className="text-sm text-muted-foreground">
                      Total: {expenseForm.customSplits.reduce((sum, s) => sum + s.value, 0).toFixed(2)}%
                    </p>
                  )}
                  {expenseForm.splitType === 'fixed' && (
                    <p className="text-sm text-muted-foreground">
                      Total: {formatCurrency(expenseForm.customSplits.reduce((sum, s) => sum + s.value, 0), selectedGroup.currency)}
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="edit-category">Category (Optional)</Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-note">Receipt Note (Optional)</Label>
                <Textarea
                  id="edit-note"
                  placeholder="Add any notes about the receipt or expense..."
                  value={expenseForm.receiptNote}
                  onChange={(e) => setExpenseForm({ ...expenseForm, receiptNote: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEditExpenseModal(false);
                resetExpenseForm();
                setEditingExpense(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleEditExpense}>Update Expense</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Group Settings Modal */}
        <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Group Settings</DialogTitle>
              <DialogDescription>Manage group settings</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-group-name">Group Name</Label>
                <Input
                  id="edit-group-name"
                  value={selectedGroup.name}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                />
                <Button
                  onClick={async () => {
                    const name = (document.getElementById('edit-group-name') as HTMLInputElement)?.value;
                    if (name) {
                      await handleUpdateGroup({ name });
                    }
                  }}
                  className="mt-2"
                  size="sm"
                >
                  Update Name
                </Button>
              </div>

              <div>
                <Label htmlFor="edit-currency">Currency</Label>
                <Select
                  defaultValue={selectedGroup.currency}
                  onValueChange={async (value) => {
                    await handleUpdateGroup({ currency: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <Label className="text-red-600">Danger Zone</Label>
                <Button
                  variant="destructive"
                  className="mt-2 w-full"
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this group? This cannot be undone.')) {
                      await handleDeleteGroup();
                      setShowSettingsModal(false);
                    }
                  }}
                >
                  Delete Group
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSettingsModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return null;
}

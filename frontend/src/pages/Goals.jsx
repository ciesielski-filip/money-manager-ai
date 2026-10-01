/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';
import useStore from '../store';
import { API_URL } from '../config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GoldInvestments from '../components/GoldInvestments';

const GOAL_COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#6366f1', '#ef4444'];
const GOAL_ICONS = ['PiggyBank', 'Target', 'Plane', 'Laptop', 'Home', 'Car', 'HeartPulse', 'GraduationCap', 'Gift', 'ShieldCheck', 'Gem', 'Briefcase'];
const STATUSES = {
  in_progress: 'W trakcie',
  completed: 'Osiągnięty 🎉',
  cancelled: 'Anulowany',
};

const money = (value) => new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
}).format(Number(value || 0));

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const DynamicIcon = ({ name, ...props }) => {
  const Icon = LucideIcons[name] || LucideIcons.PiggyBank;
  return <Icon {...props} />;
};

const mergeTransactions = (current = [], incoming = []) => {
  const byId = new Map();
  [...current, ...incoming].forEach(transaction => {
    if (transaction?._id) byId.set(transaction._id, transaction);
  });
  return Array.from(byId.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
};

const FieldLabel = ({ children }) => (
  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</label>
);

const calculateMonthlyHint = (targetAmount, currentAmount, deadline) => {
  const target = Number(targetAmount || 0);
  const current = Number(currentAmount || 0);
  if (!target || !deadline) return 0;
  const days = Math.max(0, differenceInCalendarDays(deadline, new Date()));
  const months = Math.max(1, Math.ceil(days / 30));
  return roundMoney(Math.max(0, target - current) / months);
};

const TransferRow = ({ transaction, goal, compact = false }) => {
  const isDeposit = transaction.type === 'goal_deposit';
  const WalletIcon = LucideIcons[transaction.walletId?.icon] || LucideIcons.Wallet;

  return (
    <div className={`rounded-lg border border-border/70 bg-card ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} flex shrink-0 items-center justify-center rounded-lg text-white`}
            style={{ backgroundColor: transaction.walletId?.color || '#64748b' }}
          >
            <WalletIcon size={compact ? 16 : 19} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {transaction.walletId?.name || 'Portfel'}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(transaction.date), compact ? 'd MMM' : 'd MMMM yyyy, HH:mm', { locale: pl })}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${isDeposit ? 'bg-emerald-500/15 text-emerald-500' : 'bg-destructive/15 text-destructive'}`}>
          {isDeposit ? '+' : '-'}{money(transaction.amount)}
        </span>
      </div>

      {!compact && transaction.description && (
        <p className="mt-3 text-sm text-foreground">{transaction.description}</p>
      )}

      {!compact && goal.isShared && transaction.userId?.name && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <LucideIcons.User size={13} />
          {transaction.userId.name}
        </div>
      )}
    </div>
  );
};

const GoalFormModal = ({ open, onClose, onSubmit, initialGoal }) => {
  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    deadline: null,
    color: GOAL_COLORS[0],
    icon: 'PiggyBank',
    isShared: false,
    status: 'in_progress',
  });

  useEffect(() => {
    if (initialGoal) {
      setForm({
        name: initialGoal.name || '',
        targetAmount: String(initialGoal.targetAmount || ''),
        deadline: initialGoal.deadline ? new Date(initialGoal.deadline) : null,
        color: initialGoal.color || GOAL_COLORS[0],
        icon: initialGoal.icon || 'PiggyBank',
        isShared: Boolean(initialGoal.isShared),
        status: initialGoal.status || 'in_progress',
      });
    } else {
      setForm({
        name: '',
        targetAmount: '',
        deadline: null,
        color: GOAL_COLORS[0],
        icon: 'PiggyBank',
        isShared: false,
        status: 'in_progress',
      });
    }
  }, [initialGoal, open]);

  const monthlyHint = calculateMonthlyHint(form.targetAmount, initialGoal?.currentAmount || 0, form.deadline);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.targetAmount || !form.deadline) return;
    onSubmit({
      ...form,
      targetAmount: roundMoney(parseFloat(form.targetAmount)),
      deadline: form.deadline.toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialGoal ? 'Edytuj cel' : 'Nowy cel'}</DialogTitle>
          <DialogDescription>Ustaw kwotę, termin i wygląd skarbonki.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel>Nazwa</FieldLabel>
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Wakacje w Hiszpanii" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Kwota docelowa</FieldLabel>
              <Input type="number" min="0.01" step="0.01" value={form.targetAmount} onChange={(e) => update('targetAmount', e.target.value)} placeholder="5000" required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data końcowa</FieldLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start font-normal">
                    <LucideIcons.CalendarIcon size={16} />
                    {form.deadline ? format(form.deadline, 'dd.MM.yyyy') : 'Wybierz datę'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.deadline}
                    onSelect={(date) => date && update('deadline', date)}
                    disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                    captionLayout="dropdown"
                    startMonth={new Date()}
                    endMonth={new Date(new Date().getFullYear() + 25, 11)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <p className="text-sm text-muted-foreground">Wymagane odkładanie</p>
            <p className="text-lg font-bold text-foreground">~{money(monthlyHint)} miesięcznie</p>
          </div>

          <div className="space-y-2">
            <FieldLabel>Ikona</FieldLabel>
            <div className="grid grid-cols-6 gap-2">
              {GOAL_ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => update('icon', icon)}
                  className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${form.icon === icon ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}
                  title={icon}
                >
                  <DynamicIcon name={icon} size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>Kolor</FieldLabel>
            <div className="grid grid-cols-10 gap-2">
              {GOAL_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => update('color', color)}
                  className={`h-8 rounded-lg border-2 ${form.color === color ? 'border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {initialGoal && (
            <div className="space-y-1.5">
              <FieldLabel>Status</FieldLabel>
              <Select value={form.status} onValueChange={(value) => update('status', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">W trakcie</SelectItem>
                  <SelectItem value="completed">Osiągnięty</SelectItem>
                  <SelectItem value="cancelled">Anulowany</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 p-3">
            <Checkbox checked={form.isShared} onCheckedChange={(checked) => update('isShared', Boolean(checked))} />
            <span className="text-sm font-medium">Współdzielony w budżecie domowym</span>
          </label>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit">{initialGoal ? 'Zapisz' : 'Utwórz cel'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const MoveMoneyModal = ({ open, onClose, goal, wallets, mode, onSubmit }) => {
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setWalletId(wallets[0]?._id || '');
      setAmount('');
      setDescription('');
    }
  }, [open, wallets]);

  if (!goal) return null;

  const wallet = wallets.find(item => item._id === walletId);
  const isDeposit = mode === 'deposit';
  const withdrawableAmount = goal.cashAmount ?? goal.currentAmount ?? 0;
  const maxAmount = isDeposit ? wallet?.balance || 0 : withdrawableAmount;

  const submit = (e) => {
    e.preventDefault();
    const value = roundMoney(parseFloat(amount));
    if (!walletId || !Number.isFinite(value) || value <= 0 || value > roundMoney(maxAmount)) return;
    onSubmit(goal, { walletId, amount: value, description });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDeposit ? 'Wpłać na cel' : 'Wypłać z celu'}</DialogTitle>
          <DialogDescription>{goal.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel>{isDeposit ? 'Portfel źródłowy' : 'Portfel docelowy'}</FieldLabel>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger><SelectValue placeholder="Wybierz portfel" /></SelectTrigger>
              <SelectContent>
                {wallets.map(item => (
                  <SelectItem key={item._id} value={item._id}>
                    {item.name} · {money(item.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Kwota</FieldLabel>
            <Input type="number" min="0.01" max={maxAmount} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
            <p className="text-xs text-muted-foreground">Maksymalnie: {money(maxAmount)}</p>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Opis</FieldLabel>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcjonalny opis" />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={!walletId || wallets.length === 0}>{isDeposit ? 'Wpłać' : 'Wypłać'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DeleteGoalModal = ({ open, onClose, goal, wallets, onDelete }) => {
  const [refundWalletId, setRefundWalletId] = useState('');

  useEffect(() => {
    if (open) setRefundWalletId(wallets[0]?._id || '');
  }, [open, wallets]);

  if (!goal) return null;

  const refundableAmount = goal.cashAmount ?? goal.currentAmount ?? 0;
  const hasMoney = Number(refundableAmount || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuń cel</DialogTitle>
          <DialogDescription>
            Czy na pewno chcesz usunąć cel „{goal.name}”?
          </DialogDescription>
        </DialogHeader>

        {hasMoney && (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm font-medium text-foreground">Gdzie przelać zgromadzone {money(refundableAmount)}?</p>
            <Select value={refundWalletId} onValueChange={setRefundWalletId}>
              <SelectTrigger><SelectValue placeholder="Wybierz portfel" /></SelectTrigger>
              <SelectContent>
                {wallets.map(wallet => (
                  <SelectItem key={wallet._id} value={wallet._id}>
                    {wallet.name} · {money(wallet.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button variant="destructive" disabled={hasMoney && !refundWalletId} onClick={() => onDelete(goal, hasMoney ? refundWalletId : undefined)}>
            Usuń
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const GoalDetailsModal = ({ open, onClose, goal, transactions, loading }) => {
  if (!goal) return null;

  const weeklyTarget = roundMoney((goal.monthlyTarget || 0) / 4.345);
  const progress = Math.max(0, Math.min(100, goal.progressPercentage || 0));
  const statusText = goal.isOverdue ? 'Po terminie' : STATUSES[goal.status] || 'W trakcie';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg text-white" style={{ backgroundColor: goal.color }}>
            <DynamicIcon name={goal.icon} size={32} />
          </div>
          <DialogTitle className="text-xl">{goal.name}</DialogTitle>
          <DialogDescription>{statusText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Zebrano</p>
                <p className="text-xl font-black text-foreground">{money(goal.currentAmount)}</p>
              </div>
              <p className="text-sm font-semibold text-muted-foreground">z {money(goal.targetAmount)}</p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-background">
              <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%`, backgroundColor: goal.color }} />
            </div>
            <p className="mt-2 text-right text-xs font-semibold text-muted-foreground">{progress}%</p>
            {Number(goal.assignedGoldValue || 0) > 0 && (
              <div className="mt-3 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
                W tym złoto: {money(goal.assignedGoldValue)} ({Number(goal.assignedGoldGrams || 0).toLocaleString('pl-PL')} g)
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/70 bg-card p-3">
              <p className="text-xs text-muted-foreground">Termin</p>
              <p className="mt-1 font-bold text-foreground">{format(new Date(goal.deadline), 'dd.MM.yyyy', { locale: pl })}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card p-3">
              <p className="text-xs text-muted-foreground">Pozostało</p>
              <p className="mt-1 font-bold text-foreground">{Math.max(0, goal.monthsRemaining || 0)} mies.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card p-3">
              <p className="text-xs text-muted-foreground">Miesięcznie</p>
              <p className="mt-1 font-bold text-foreground">{money(goal.monthlyTarget)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card p-3">
              <p className="text-xs text-muted-foreground">Tygodniowo</p>
              <p className="mt-1 font-bold text-foreground">{money(weeklyTarget)}</p>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Pełna historia</h3>
              <span className="text-xs text-muted-foreground">{transactions.length} wpisów</span>
            </div>
            {loading ? (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Ładowanie historii...
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <LucideIcons.History size={24} />
                </div>
                <p className="text-sm font-medium text-foreground">Brak historii przelewów dla tego celu.</p>
              </div>
            ) : (
              <div className="max-h-[34vh] space-y-3 overflow-y-auto pr-1">
                {transactions.map(transaction => (
                  <TransferRow key={transaction._id} transaction={transaction} goal={goal} />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const GoalCard = ({ goal, transactions, historyLoading, onDeposit, onWithdraw, onEdit, onDelete, onDetails }) => {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const weeklyTarget = roundMoney((goal.monthlyTarget || 0) / 4.345);
  const statusText = goal.isOverdue ? 'Po terminie' : STATUSES[goal.status] || 'W trakcie';
  const progress = Math.max(0, Math.min(100, goal.progressPercentage || 0));
  const withdrawableAmount = goal.cashAmount ?? goal.currentAmount ?? 0;

  return (
    <Card className="overflow-hidden rounded-lg border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: goal.color }}>
              <DynamicIcon name={goal.icon} size={24} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-foreground">{goal.name}</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${goal.isOverdue ? 'bg-destructive/15 text-destructive' : goal.status === 'completed' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                  {statusText}
                </span>
                {goal.isShared && <LucideIcons.Users size={14} className="text-muted-foreground" />}
              </div>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" title="Opcje">
                <LucideIcons.MoreVertical size={18} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              <button type="button" onClick={() => onDetails(goal)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                <LucideIcons.History size={15} /> Szczegóły celu
              </button>
              <button type="button" onClick={() => onEdit(goal)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                <LucideIcons.Pencil size={15} /> Edytuj cel
              </button>
              <button type="button" onClick={() => onDelete(goal)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                <LucideIcons.Trash2 size={15} /> Usuń cel
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">{money(goal.currentAmount)} / {money(goal.targetAmount)}</p>
            <p className="text-xs text-muted-foreground">pozostało {money(remaining)}</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%`, backgroundColor: goal.color }} />
          </div>
          <p className="text-right text-xs font-semibold text-muted-foreground">{progress}%</p>
          {Number(goal.assignedGoldValue || 0) > 0 && (
            <p className="text-xs font-medium text-amber-500">
              W tym złoto: {money(goal.assignedGoldValue)}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-muted/45 p-3 text-sm">
          <p className="text-muted-foreground">📅 Pozostało: {Math.max(0, goal.monthsRemaining || 0)} mies. do {format(new Date(goal.deadline), 'dd.MM.yyyy', { locale: pl })}</p>
          <p className="mt-1 font-semibold text-foreground">💡 Odłóż {money(goal.monthlyTarget)} / miesiąc, ok. {money(weeklyTarget)} / tydzień</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={() => onDeposit(goal)} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <LucideIcons.ArrowDownToLine size={16} /> Wpłać
          </Button>
          <Button type="button" variant="outline" onClick={() => onWithdraw(goal)} disabled={!withdrawableAmount}>
            <LucideIcons.ArrowUpFromLine size={16} /> Wypłać
          </Button>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ostatnie przelewy</h4>
            <button type="button" onClick={() => onDetails(goal)} className="text-xs font-semibold text-foreground hover:text-primary">
              Zobacz więcej
            </button>
          </div>
          {historyLoading ? (
            <p className="py-2 text-sm text-muted-foreground">Ładowanie...</p>
          ) : transactions.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Brak przelewów</p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 3).map(transaction => (
                <TransferRow key={transaction._id} transaction={transaction} goal={goal} compact />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Goals = () => {
  const { householdId, userId } = useStore();
  const [goals, setGoals] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [moveMode, setMoveMode] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [deleteGoal, setDeleteGoal] = useState(null);
  const [detailsGoal, setDetailsGoal] = useState(null);
  const [goalTransactions, setGoalTransactions] = useState({});
  const [goalTransactionsLoading, setGoalTransactionsLoading] = useState({});

  const fetchGoalTransactions = useCallback(async (goalId) => {
    if (!goalId || !userId) return [];

    setGoalTransactionsLoading(prev => ({ ...prev, [goalId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/goals/${goalId}/transactions?userId=${userId}&_=${Date.now()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Nie udało się pobrać historii');

      const transactions = Array.isArray(data) ? data : [];
      setGoalTransactions(prev => ({
        ...prev,
        [goalId]: transactions.length > 0 ? mergeTransactions(prev[goalId], transactions) : (prev[goalId] || []),
      }));
      return transactions;
    } catch (err) {
      console.error(err);
      setGoalTransactions(prev => ({ ...prev, [goalId]: prev[goalId] || [] }));
      return [];
    } finally {
      setGoalTransactionsLoading(prev => ({ ...prev, [goalId]: false }));
    }
  }, [userId]);

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const [goalsRes, walletsRes] = await Promise.all([
        fetch(`${API_URL}/api/goals?householdId=${householdId}&userId=${userId}`),
        fetch(`${API_URL}/api/wallets?householdId=${householdId}&userId=${userId}`),
      ]);

      const goalsData = await goalsRes.json();
      const walletsData = await walletsRes.json();

      if (!goalsRes.ok) throw new Error(goalsData?.error || 'Nie udało się pobrać celów');
      if (!walletsRes.ok) throw new Error(walletsData?.error || 'Nie udało się pobrać portfeli');

      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setWallets(Array.isArray(walletsData) ? walletsData : []);
      if (Array.isArray(goalsData) && goalsData.length > 0) {
        await Promise.all(goalsData.map(goal => fetchGoalTransactions(goal._id)));
      } else {
        setGoalTransactions({});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [householdId, userId, fetchGoalTransactions]);

  useEffect(() => {
    if (householdId && userId) fetchData();
  }, [householdId, userId, fetchData]);

  const summary = useMemo(() => {
    return goals.reduce((acc, goal) => {
      acc.saved += Number(goal.currentAmount || 0);
      acc.monthly += goal.status === 'in_progress' ? Number(goal.monthlyTarget || 0) : 0;
      if (goal.status === 'completed') acc.completed += 1;
      if (goal.status === 'in_progress') acc.active += 1;
      return acc;
    }, { saved: 0, monthly: 0, active: 0, completed: 0 });
  }, [goals]);

  const request = async (url, options) => {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Operacja nie powiodła się');
    return data;
  };

  const handleSaveGoal = async (payload) => {
    try {
      if (editingGoal) {
        await request(`${API_URL}/api/goals/${editingGoal._id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...payload, userId }),
        });
      } else {
        await request(`${API_URL}/api/goals`, {
          method: 'POST',
          body: JSON.stringify({ ...payload, householdId, userId }),
        });
      }
      setFormOpen(false);
      setEditingGoal(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMoveMoney = async (goal, payload) => {
    try {
      const updatedGoal = await request(`${API_URL}/api/goals/${goal._id}/${moveMode}`, {
        method: 'POST',
        body: JSON.stringify({ ...payload, userId }),
      });
      const selectedWallet = wallets.find(wallet => wallet._id === payload.walletId);
      const fallbackTransaction = {
        _id: `local-${goal._id}-${Date.now()}`,
        amount: payload.amount,
        type: moveMode === 'deposit' ? 'goal_deposit' : 'goal_withdraw',
        description: payload.description || (moveMode === 'deposit' ? `Wpłata na cel: ${goal.name}` : `Wypłata z celu: ${goal.name}`),
        date: new Date().toISOString(),
        walletId: selectedWallet ? {
          _id: selectedWallet._id,
          name: selectedWallet.name,
          color: selectedWallet.color,
          icon: selectedWallet.icon,
        } : payload.walletId,
      };
      setSelectedGoal(null);
      setMoveMode(null);
      await fetchData();
      const transactionToShow = updatedGoal?.latestTransaction || fallbackTransaction;
      if (transactionToShow) {
        setGoalTransactions(prev => {
          const current = prev[goal._id] || [];
          return {
            ...prev,
            [goal._id]: mergeTransactions(current, [transactionToShow]),
          };
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteGoal = async (goal, refundWalletId) => {
    try {
      await request(`${API_URL}/api/goals/${goal._id}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId, refundWalletId }),
      });
      setDeleteGoal(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGoldGoalUpdated = (updatedGoal) => {
    if (!updatedGoal?._id) {
      fetchData();
      return;
    }

    setGoals(prev => prev.map(goal => goal._id === updatedGoal._id ? updatedGoal : goal));
    if (updatedGoal.latestTransaction) {
      setGoalTransactions(prev => ({
        ...prev,
        [updatedGoal._id]: mergeTransactions(prev[updatedGoal._id] || [], [updatedGoal.latestTransaction]),
      }));
    }
    fetchData();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background pb-28">
      <div className="sticky top-0 z-20 border-b border-border/40 bg-background px-4 pb-4 pt-14 shadow-sm sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Skarbonki</p>
            <h1 className="text-2xl font-black text-foreground">Cele</h1>
          </div>
          <Button onClick={() => { setEditingGoal(null); setFormOpen(true); }}>
            <LucideIcons.Plus size={17} /> Nowy cel
          </Button>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4 sm:px-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <p className="text-xs text-muted-foreground">Odłożone</p>
            <p className="mt-1 text-lg font-bold text-foreground">{money(summary.saved)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <p className="text-xs text-muted-foreground">Aktywne / gotowe</p>
            <p className="mt-1 text-lg font-bold text-foreground">{summary.active} / {summary.completed}</p>
          </div>
          <div className="col-span-2 rounded-lg border border-border/70 bg-card p-3">
            <p className="text-xs text-muted-foreground">Sugerowana kwota w tym miesiącu</p>
            <p className="mt-1 text-xl font-black text-foreground">{money(summary.monthly)}</p>
          </div>
        </section>

        {loading ? (
          <div className="rounded-lg border border-border/70 bg-card p-6 text-center text-sm text-muted-foreground">Ładowanie celów...</div>
        ) : goals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <LucideIcons.Target size={28} />
            </div>
            <h2 className="text-lg font-bold text-foreground">Brak celów</h2>
            <p className="mt-1 text-sm text-muted-foreground">Dodaj pierwszą skarbonkę i zobacz, ile odkładać co miesiąc.</p>
            <Button className="mt-5" onClick={() => setFormOpen(true)}>
              <LucideIcons.Plus size={17} /> Nowy cel
            </Button>
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            {goals.map(goal => (
              <GoalCard
                key={goal._id}
                goal={goal}
                transactions={goalTransactions[goal._id] || []}
                historyLoading={Boolean(goalTransactionsLoading[goal._id])}
                onDeposit={(item) => { setSelectedGoal(item); setMoveMode('deposit'); }}
                onWithdraw={(item) => { setSelectedGoal(item); setMoveMode('withdraw'); }}
                onEdit={(item) => { setEditingGoal(item); setFormOpen(true); }}
                onDelete={setDeleteGoal}
                onDetails={(item) => { setDetailsGoal(item); fetchGoalTransactions(item._id); }}
              />
            ))}
          </section>
        )}

        <GoldInvestments onGoalUpdated={handleGoldGoalUpdated} />
      </main>

      <GoalFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingGoal(null); }}
        onSubmit={handleSaveGoal}
        initialGoal={editingGoal}
      />
      <MoveMoneyModal
        open={Boolean(selectedGoal && moveMode)}
        onClose={() => { setSelectedGoal(null); setMoveMode(null); }}
        goal={selectedGoal}
        wallets={wallets}
        mode={moveMode}
        onSubmit={handleMoveMoney}
      />
      <DeleteGoalModal
        open={Boolean(deleteGoal)}
        onClose={() => setDeleteGoal(null)}
        goal={deleteGoal}
        wallets={wallets}
        onDelete={handleDeleteGoal}
      />
      <GoalDetailsModal
        open={Boolean(detailsGoal)}
        onClose={() => setDetailsGoal(null)}
        goal={detailsGoal}
        transactions={detailsGoal ? goalTransactions[detailsGoal._id] || [] : []}
        loading={detailsGoal ? Boolean(goalTransactionsLoading[detailsGoal._id]) : false}
      />
    </div>
  );
};

export default Goals;

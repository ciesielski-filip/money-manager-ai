import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, addMonths, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';
import useStore from '../store';
import { API_URL } from '../config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const money = (value) => new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
}).format(Number(value || 0));

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const currentMonth = () => format(new Date(), 'yyyy-MM');
const previousMonth = (month) => format(addMonths(parseISO(`${month}-01`), -1), 'yyyy-MM');
const monthLabel = (month) => format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: pl }).toUpperCase();

const DynamicIcon = ({ name, ...props }) => {
  const Icon = LucideIcons[name] || LucideIcons.Circle;
  return <Icon {...props} />;
};

const readApi = async (res) => {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Operacja nie powiodła się');
  return data;
};

const progressTone = (percentage) => {
  if (percentage === null || percentage === undefined) return 'bg-muted';
  if (percentage > 100) return 'bg-red-500';
  if (percentage >= 90) return 'bg-orange-500';
  if (percentage >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const FieldLabel = ({ children }) => (
  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</label>
);

const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const PlanDateInput = ({ value, onChange }) => {
  const selectedDate = parseDateValue(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal">
          <LucideIcons.CalendarIcon size={16} />
          {selectedDate ? format(selectedDate, 'dd.MM.yyyy') : 'Termin'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
          captionLayout="dropdown"
          startMonth={new Date(2000, 0)}
          endMonth={new Date(new Date().getFullYear() + 10, 11)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

const StatTile = ({ label, value, tone = 'text-foreground' }) => (
  <div className="rounded-lg border border-border/70 bg-card p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`mt-1 text-lg font-black ${tone}`}>{value}</p>
  </div>
);

const BudgetEditor = ({ open, onClose, data, onSave, onCopyPrevious }) => {
  const expenseCategories = useMemo(() => (data?.allCategories || []).filter(category => category.type === 'expense'), [data]);
  const [totalBudget, setTotalBudget] = useState('');
  const [rows, setRows] = useState({});

  useEffect(() => {
    if (!open || !data) return;
    setTotalBudget(data.totalBudget === null || data.totalBudget === undefined ? '' : String(data.totalBudget));
    const nextRows = {};
    expenseCategories.forEach(category => {
      const current = data.categories?.find(row => row.categoryId === category._id);
      nextRows[category._id] = {
        enabled: current?.budget !== null && current?.budget !== undefined,
        limit: current?.budget !== null && current?.budget !== undefined ? String(current.budget) : '',
        costType: current?.costType || 'variable',
      };
    });
    setRows(nextRows);
  }, [open, data, expenseCategories]);

  const updateRow = (categoryId, patch) => {
    setRows(prev => ({ ...prev, [categoryId]: { ...(prev[categoryId] || {}), ...patch } }));
  };

  const submit = (e) => {
    e.preventDefault();
    const categoryBudgets = Object.entries(rows)
      .filter(([, row]) => row.enabled)
      .map(([categoryId, row]) => ({
        categoryId,
        limit: roundMoney(parseFloat(row.limit || 0)),
        costType: row.costType || 'variable',
      }));
    onSave({ totalBudget, categoryBudgets });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edytuj budżet</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel>Budżet miesiąca</FieldLabel>
            <Input type="number" min="0" step="0.01" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="Opcjonalnie" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel>Limity kategorii</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={onCopyPrevious}>
                <LucideIcons.Copy size={14} /> Kopiuj poprzedni
              </Button>
            </div>
            {expenseCategories.map(category => {
              const row = rows[category._id] || {};
              return (
                <div key={category._id} className="rounded-lg border border-border/70 p-3">
                  <label className="flex items-center gap-3">
                    <Checkbox checked={Boolean(row.enabled)} onCheckedChange={(checked) => updateRow(category._id, { enabled: Boolean(checked) })} />
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ backgroundColor: category.color }}>
                        <DynamicIcon name={category.icon} size={15} />
                      </span>
                      <span className="truncate">{category.name}</span>
                    </span>
                  </label>
                  {row.enabled && (
                    <div className="mt-3 grid grid-cols-[1fr_130px] gap-2">
                      <Input type="number" min="0" step="0.01" value={row.limit || ''} onChange={(e) => updateRow(category._id, { limit: e.target.value })} placeholder="Limit" />
                      <Select value={row.costType || 'variable'} onValueChange={(costType) => updateRow(category._id, { costType })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="variable">Zmienne</SelectItem>
                          <SelectItem value="fixed">Stałe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit">Zapisz</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const PlannedItemModal = ({ open, onClose, data, initialItem, onSave }) => {
  const [form, setForm] = useState({
    type: 'expense',
    name: '',
    categoryId: '',
    plannedAmount: '',
    dueDate: '',
    description: '',
  });

  const categories = useMemo(() => (data?.allCategories || []).filter(category => category.type === form.type), [data, form.type]);

  useEffect(() => {
    if (!open) return;
    if (initialItem) {
      setForm({
        type: initialItem.type || 'expense',
        name: initialItem.name || '',
        categoryId: initialItem.categoryId || '',
        plannedAmount: String(initialItem.plannedAmount || ''),
        dueDate: initialItem.dueDate ? format(new Date(initialItem.dueDate), 'yyyy-MM-dd') : '',
        description: initialItem.description || '',
      });
    } else {
      const firstExpense = (data?.allCategories || []).find(category => category.type === 'expense');
      setForm({ type: 'expense', name: '', categoryId: firstExpense?._id || '', plannedAmount: '', dueDate: '', description: '' });
    }
  }, [open, initialItem, data]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some(category => category._id === form.categoryId)) {
      setForm(prev => ({ ...prev, categoryId: categories[0]._id }));
    }
  }, [categories, form.categoryId]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.categoryId || !form.plannedAmount) return;
    onSave(initialItem?.id, {
      ...form,
      plannedAmount: roundMoney(parseFloat(form.plannedAmount)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialItem ? 'Edytuj pozycję' : 'Dodaj planowaną pozycję'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={form.type === 'expense' ? 'default' : 'outline'} onClick={() => update('type', 'expense')}>Wydatek</Button>
            <Button type="button" variant={form.type === 'income' ? 'default' : 'outline'} onClick={() => update('type', 'income')}>Dochód</Button>
          </div>
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Nazwa" required />
          <Select value={form.categoryId} onValueChange={(categoryId) => update('categoryId', categoryId)}>
            <SelectTrigger><SelectValue placeholder="Kategoria" /></SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input type="number" min="0" step="0.01" value={form.plannedAmount} onChange={(e) => update('plannedAmount', e.target.value)} placeholder="Planowana kwota" required />
            <PlanDateInput value={form.dueDate} onChange={(dueDate) => update('dueDate', dueDate)} />
          </div>
          <Input value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Opis" />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit">Zapisz</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const PlanItemRow = ({ item, onComplete, onUncomplete, onEdit, onDelete }) => {
  const isCompleted = item.status === 'completed';
  const statusLabel = item.status === 'completed'
    ? 'Zrealizowano'
    : item.status === 'partial'
      ? 'Częściowo'
      : item.status === 'cancelled'
        ? 'Anulowano'
        : 'Oczekuje';

  return (
    <div className="rounded-lg bg-muted/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Checkbox
            className="mt-0.5 h-5 w-5"
            checked={item.status === 'partial' ? 'indeterminate' : isCompleted}
            onCheckedChange={(checked) => (checked ? onComplete(item) : onUncomplete(item))}
            aria-label={isCompleted ? 'Oznacz jako niezrealizowane' : 'Oznacz jako zrealizowane'}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === 'completed' ? 'bg-emerald-500/15 text-emerald-500' : item.status === 'partial' ? 'bg-amber-500/15 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {money(item.actualAmount)} / {money(item.plannedAmount)}
              {item.dueDate ? ` · ${format(new Date(item.dueDate), 'dd.MM')}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(item)} title="Edytuj">
            <LucideIcons.Pencil size={15} />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(item)} title="Usuń">
            <LucideIcons.Trash2 size={15} className="text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const PlanItemsSection = ({ title, emptyText, items, ...itemActions }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <span className="text-xs text-muted-foreground">{items.length}</span>
    </div>
    {items.length === 0 ? (
      <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{emptyText}</p>
    ) : (
      items.map(item => (
        <PlanItemRow
          key={item.id}
          item={item}
          {...itemActions}
        />
      ))
    )}
  </div>
);

const CategoryBudgetCard = ({ row }) => {
  const percentage = row.percentage === null || row.percentage === undefined ? null : Math.min(140, row.percentage);
  const over = row.budget !== null && row.spent > row.budget;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex w-full items-start justify-between gap-3 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: row.color }}>
              <DynamicIcon name={row.icon} size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.costType === 'fixed' ? 'Stałe koszty' : 'Zmienne koszty'}</p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              {money(row.spent)} {row.budget !== null ? `/ ${money(row.budget)}` : ''}
            </p>
            <p className={`text-xs font-semibold ${over ? 'text-red-500' : 'text-muted-foreground'}`}>
              {row.budget === null ? 'Budżet nie ustawiono' : over ? `+${money(row.spent - row.budget)} ponad budżet` : `pozostało ${money(row.remaining)}`}
            </p>
          </div>
          {row.budget !== null && (
            <>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${progressTone(row.percentage)}`} style={{ width: `${Math.min(100, percentage || 0)}%` }} />
              </div>
              <p className="mt-1 text-right text-xs text-muted-foreground">{Math.round(row.percentage || 0)}%</p>
            </>
          )}
        </div>

        {row.budget === null && (
          <p className="mt-3 text-xs text-muted-foreground">Ustaw limit w edycji budżetu, aby zobaczyć wykorzystanie kategorii.</p>
        )}
      </CardContent>
    </Card>
  );
};

const Budget = () => {
  const { householdId, userId } = useStore();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [previousData, setPreviousData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [costsOpen, setCostsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchBudget = useCallback(async () => {
    if (!householdId || !userId) return;
    try {
      setLoading(true);
      setError('');
      const prevMonth = previousMonth(month);
      const [budgetRes, previousRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/budgets/${month}?householdId=${householdId}&userId=${userId}`),
        fetch(`${API_URL}/api/budgets/${prevMonth}?householdId=${householdId}&userId=${userId}`),
        fetch(`${API_URL}/api/budgets/history/list?householdId=${householdId}&userId=${userId}&limit=6`),
      ]);
      setData(await readApi(budgetRes));
      setPreviousData(await readApi(previousRes));
      setHistory(await readApi(historyRes));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [householdId, userId, month]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const request = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    return readApi(res);
  };

  const replaceData = (nextData) => {
    setData(nextData);
    setEditorOpen(false);
    setItemModalOpen(false);
    setEditingItem(null);
  };

  const saveBudget = async (payload) => {
    try {
      const nextData = await request(`${API_URL}/api/budgets/${month}`, {
        method: 'PUT',
        body: JSON.stringify({ ...payload, householdId, userId }),
      });
      replaceData(nextData);
    } catch (err) {
      setError(err.message);
    }
  };

  const copyPrevious = async () => {
    try {
      const nextData = await request(`${API_URL}/api/budgets/${month}/copy`, {
        method: 'POST',
        body: JSON.stringify({ householdId, userId, fromMonth: previousMonth(month) }),
      });
      replaceData(nextData);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveItem = async (itemId, item) => {
    try {
      const nextData = await request(`${API_URL}/api/budgets/${month}/items${itemId ? `/${itemId}` : ''}`, {
        method: itemId ? 'PUT' : 'POST',
        body: JSON.stringify({ householdId, userId, item }),
      });
      replaceData(nextData);
    } catch (err) {
      setError(err.message);
    }
  };

  const itemAction = async (item, action, extra = {}) => {
    try {
      const url = action === 'delete'
        ? `${API_URL}/api/budgets/${month}/items/${item.id}`
        : `${API_URL}/api/budgets/${month}/items/${item.id}/${action}`;
      const nextData = await request(url, {
        method: action === 'delete' ? 'DELETE' : 'POST',
        body: JSON.stringify({ householdId, userId, ...extra }),
      });
      replaceData(nextData);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch(`${API_URL}/api/budgets/${month}/export.csv?householdId=${householdId}&userId=${userId}`);
      if (!res.ok) throw new Error('Nie udało się wyeksportować CSV');
      const csv = await res.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budget-${month}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const incomeItems = useMemo(() => (data?.plannedItems || []).filter(item => item.type === 'income'), [data]);
  const expenseItems = useMemo(() => (data?.plannedItems || []).filter(item => item.type === 'expense'), [data]);

  const monthProgress = data?.daysInMonth ? roundMoney((data.daysElapsed / data.daysInMonth) * 100) : 0;
  const totalUsage = data?.budgetUsagePercentage;
  const previousExpenseDiff = previousData ? roundMoney((data?.expenses || 0) - previousData.expenses) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-background pb-28">
      <div className="sticky top-0 z-20 border-b border-border/40 bg-background px-4 pb-4 pt-14 shadow-sm sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => setMonth(previousMonth(month))} title="Poprzedni miesiąc">
            <LucideIcons.ChevronLeft size={20} />
          </Button>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Budżet</p>
            <h1 className="text-xl font-black text-foreground">{monthLabel(month)}</h1>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setMonth(format(addMonths(parseISO(`${month}-01`), 1), 'yyyy-MM'))} title="Następny miesiąc">
            <LucideIcons.ChevronRight size={20} />
          </Button>
        </div>
        <div className="mt-3 flex gap-2">
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <Button type="button" variant="outline" onClick={exportCsv} title="Eksport CSV">
            <LucideIcons.Download size={17} />
          </Button>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4 sm:px-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading || !data ? (
          <div className="rounded-lg border border-border/70 bg-card p-6 text-center text-sm text-muted-foreground">Ładowanie budżetu...</div>
        ) : (
          <>
            <Card className="overflow-hidden rounded-lg border-border/70 bg-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{monthLabel(month)}</p>
                    <h2 className="mt-1 text-2xl font-black text-foreground">Kontrola miesiąca</h2>
                  </div>
                  <Button type="button" size="sm" onClick={() => setEditorOpen(true)}>
                    <LucideIcons.SlidersHorizontal size={15} /> Ustaw budżet
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <StatTile label="Dochody" value={money(data.income)} tone="text-emerald-500" />
                  <StatTile label="Wydatki" value={money(data.expenses)} tone="text-red-500" />
                  <StatTile label="Pozostało" value={money(data.totalBudget === null ? data.balance : data.remainingBudget)} />
                </div>

                {data.totalBudget === null ? (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm font-medium text-foreground">Nie masz jeszcze ustawionego limitu miesiąca.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Kliknij „Ustaw budżet”, wpisz kwotę całkowitą i limity kategorii.</p>
                    <Button type="button" className="mt-3 w-full" onClick={() => setEditorOpen(true)}>
                      <LucideIcons.SlidersHorizontal size={16} /> Ustaw budżet
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${progressTone(totalUsage)}`} style={{ width: `${Math.min(100, totalUsage || 0)}%` }} />
                    </div>
                    <p className="mt-2 text-right text-xs font-semibold text-muted-foreground">{Math.round(totalUsage || 0)}% wykorzystania budżetu</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <LucideIcons.Coins size={18} className="text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Limit dzienny</h3>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Do końca miesiąca: {data.daysRemaining} dni</p>
                  <p className="mt-1 text-2xl font-black text-foreground">{data.dailyLimit === null ? 'Ustaw budżet' : `${money(data.dailyLimit)} / dzień`}</p>
                  {data.dailyLimit === null && (
                    <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setEditorOpen(true)}>
                      <LucideIcons.SlidersHorizontal size={16} /> Ustaw limit miesiąca
                    </Button>
                  )}
                  {data.isCurrentMonth && data.totalBudget !== null && (
                    <p className="mt-2 text-xs text-muted-foreground">Minęło {Math.round(monthProgress)}% miesiąca, wykorzystano {Math.round(totalUsage || 0)}% budżetu.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Plan miesiąca</h3>
                  <Button type="button" size="sm" onClick={() => { setEditingItem(null); setItemModalOpen(true); }}>
                    <LucideIcons.Plus size={15} /> Dodaj
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <StatTile label="Planowane dochody" value={money(data.planSummary.plannedIncome)} />
                  <StatTile label="Otrzymane" value={money(data.planSummary.actualIncome)} tone="text-emerald-500" />
                  <StatTile label="Planowane wydatki" value={money(data.planSummary.plannedExpenses)} />
                  <StatTile label="Pozostało wydatków" value={money(data.planSummary.remainingExpenses)} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Pozycje: {data.planSummary.completed} zrealizowanych, {data.planSummary.partial} częściowych, {data.planSummary.planned} oczekujących.
                </p>
                <div className="mt-4 space-y-4">
                  <PlanItemsSection
                    title="Planowane dochody"
                    emptyText="Brak planowanych dochodów."
                    items={incomeItems}
                    onComplete={(target) => itemAction(target, 'complete')}
                    onUncomplete={(target) => itemAction(target, 'uncomplete')}
                    onEdit={(target) => { setEditingItem(target); setItemModalOpen(true); }}
                    onDelete={(target) => itemAction(target, 'delete')}
                  />
                  <PlanItemsSection
                    title="Planowane wydatki"
                    emptyText="Brak planowanych wydatków."
                    items={expenseItems}
                    onComplete={(target) => itemAction(target, 'complete')}
                    onUncomplete={(target) => itemAction(target, 'uncomplete')}
                    onEdit={(target) => { setEditingItem(target); setItemModalOpen(true); }}
                    onDelete={(target) => itemAction(target, 'delete')}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <LucideIcons.AlertTriangle size={18} className="text-amber-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Uwagi</h3>
                </div>
                <div className="mt-3 space-y-2">
                  {data.alerts.map((alert, index) => (
                    <p key={`${alert}-${index}`} className="rounded-lg bg-muted/35 p-3 text-sm text-foreground">{alert}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Budżety kategorii</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditorOpen(true)}>Ustaw budżet</Button>
              </div>
              {data.categories.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  Brak wydatków i limitów kategorii w tym miesiącu.
                </div>
              ) : (
                data.categories.map(row => (
                  <CategoryBudgetCard
                    key={row.categoryId}
                    row={row}
                  />
                ))
              )}
            </section>

            <Card>
              <CardContent className="p-4">
                <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setCostsOpen(prev => !prev)}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Koszty miesiąca</h3>
                  <LucideIcons.ChevronDown size={18} className={`transition-transform ${costsOpen ? 'rotate-180' : ''}`} />
                </button>
                {costsOpen && (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <StatTile label="Stałe" value={money(data.fixedExpenses)} />
                    <StatTile label="Zmienne" value={money(data.variableExpenses)} />
                    <StatTile label="Razem" value={money(data.expenses)} />
                  </div>
                )}
              </CardContent>
            </Card>

            {previousData && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{monthLabel(month)} vs {monthLabel(previousMonth(month))}</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <StatTile label="Wydatki" value={money(data.expenses)} />
                    <StatTile label="Poprzednio" value={money(previousData.expenses)} />
                    <StatTile label="Różnica" value={`${previousExpenseDiff > 0 ? '+' : ''}${money(previousExpenseDiff)}`} tone={previousExpenseDiff > 0 ? 'text-red-500' : 'text-emerald-500'} />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setHistoryOpen(prev => !prev)}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Historia budżetu</h3>
                  <LucideIcons.ChevronDown size={18} className={`transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                </button>
                {historyOpen && (
                  <div className="mt-3 space-y-2">
                    {history.map(item => (
                      <button key={item.month} type="button" className="w-full rounded-lg bg-muted/35 p-3 text-left" onClick={() => setMonth(item.month)}>
                        <p className="text-sm font-bold text-foreground">{monthLabel(item.month)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Dochody: {money(item.income)} · Wydatki: {money(item.expenses)} · Nadwyżka: {money(item.balance)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <BudgetEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        data={data}
        onSave={saveBudget}
        onCopyPrevious={copyPrevious}
      />
      <PlannedItemModal
        open={itemModalOpen}
        onClose={() => { setItemModalOpen(false); setEditingItem(null); }}
        data={data}
        initialItem={editingItem}
        onSave={saveItem}
      />
    </div>
  );
};

export default Budget;

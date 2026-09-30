import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import * as LucideIcons from 'lucide-react';
import useStore from '../store';
import { API_URL } from '../config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const emptyForm = {
  name: '',
  weight: '',
  unit: 'g',
  purchasePrice: '',
  purchaseDate: '',
};

const moneyPln = (value) => new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
}).format(Number(value || 0));

const weightPl = (value, digits = 2) => Number(value || 0).toLocaleString('pl-PL', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const toWeightGrams = (weight, unit) => {
  const parsed = parseFloat(weight);
  if (!Number.isFinite(parsed) || parsed <= 0) return NaN;
  return unit === 'oz' ? parsed * 31.1035 : parsed;
};

const readApiResponse = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text ? { error: text.slice(0, 180) } : null;
  }
};

const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const PurchaseDateInput = ({ value, onChange }) => {
  const selectedDate = parseDateValue(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal">
          <LucideIcons.CalendarIcon size={16} />
          {selectedDate ? format(selectedDate, 'dd.MM.yyyy') : 'Data zakupu'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
          disabled={{ after: new Date(new Date().setHours(23, 59, 59, 999)) }}
          captionLayout="dropdown"
          startMonth={new Date(1900, 0)}
          endMonth={new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

const GoldFormModal = ({ isOpen, onClose, error, form, setForm, editingId, setEditingId, onSave }) => {
  const setPreset = (presetWeight, unit = 'g') => {
    setForm(prev => ({ ...prev, weight: String(presetWeight), unit }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.weight) return;
    const ok = await onSave(editingId, form);
    if (ok) {
      setForm(emptyForm);
      setEditingId(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md overflow-visible">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
            <LucideIcons.Coins size={30} />
          </div>
          <DialogTitle>{editingId ? 'Edytuj złoto' : 'Dodaj sztabkę / monetę'}</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Sztabka 10g Valcambi" required />
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <Input type="number" min="0.0001" step="0.0001" value={form.weight} onChange={(e) => setForm(prev => ({ ...prev, weight: e.target.value }))} placeholder="Waga" required />
            <Select value={form.unit} onValueChange={(unit) => setForm(prev => ({ ...prev, unit }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="g">Gramy</SelectItem>
                <SelectItem value="oz">Uncje oz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 5, 10].map(value => (
              <Button key={value} type="button" variant="outline" size="sm" onClick={() => setPreset(value, 'g')}>{value}g</Button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setPreset(1, 'oz')}>1 oz</Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => setForm(prev => ({ ...prev, purchasePrice: e.target.value }))} placeholder="Cena zakupu PLN" />
            <PurchaseDateInput value={form.purchaseDate} onChange={(purchaseDate) => setForm(prev => ({ ...prev, purchaseDate }))} />
          </div>
          <DialogFooter className="gap-2">
            {editingId && (
              <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Anuluj edycję
              </Button>
            )}
            <Button type="submit">{editingId ? 'Zapisz' : 'Dodaj'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const GoldInvestments = ({ onGoalUpdated }) => {
  const { householdId, userId } = useStore();
  const [goldData, setGoldData] = useState(null);
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedHoldingId, setSelectedHoldingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const fetchGoldData = async () => {
    if (!householdId || !userId) return;
    try {
      setLoading(true);
      setError('');
      const [goldRes, goalsRes] = await Promise.all([
        fetch(`${API_URL}/api/gold?householdId=${householdId}&userId=${userId}`),
        fetch(`${API_URL}/api/goals?householdId=${householdId}&userId=${userId}`),
      ]);
      const goldPayload = await readApiResponse(goldRes);
      const goalsPayload = await readApiResponse(goalsRes);
      if (!goldRes.ok) throw new Error(goldPayload?.error || 'Nie udało się pobrać danych złota');
      if (!goalsRes.ok) throw new Error(goalsPayload?.error || 'Nie udało się pobrać celów');
      setGoldData(goldPayload);
      setGoals(Array.isArray(goalsPayload) ? goalsPayload : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoldData();
  }, [householdId, userId]);

  const saveHolding = async (holdingId, nextForm) => {
    try {
      setError('');
      const weight = parseFloat(nextForm.weight);
      const weightGrams = toWeightGrams(nextForm.weight, nextForm.unit);
      if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(weightGrams)) {
        throw new Error('Podaj poprawną wagę złota');
      }

      const res = await fetch(`${API_URL}/api/gold${holdingId ? `/${holdingId}` : ''}`, {
        method: holdingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nextForm.name,
          weight,
          weightGrams,
          unit: nextForm.unit,
          purchasePrice: nextForm.purchasePrice,
          purchaseDate: nextForm.purchaseDate,
          householdId,
          userId,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data?.error || `Nie udało się zapisać pozycji złota (${res.status})`);
      await fetchGoldData();
      if (onGoalUpdated) onGoalUpdated(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const deleteHolding = async (holdingId) => {
    try {
      setError('');
      const res = await fetch(`${API_URL}/api/gold/${holdingId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data?.error || 'Nie udało się usunąć pozycji złota');
      await fetchGoldData();
      if (onGoalUpdated) onGoalUpdated(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const editHolding = (holding) => {
    setEditingId(holding._id);
    setForm({
      name: holding.name || '',
      weight: String(holding.weightGrams || ''),
      unit: 'g',
      purchasePrice: holding.purchasePrice ? String(holding.purchasePrice) : '',
      purchaseDate: holding.purchaseDate ? format(new Date(holding.purchaseDate), 'yyyy-MM-dd') : '',
    });
    setIsFormOpen(true);
  };

  const addGoldValueToGoal = async () => {
    try {
      setError('');
      if (!selectedGoalId) throw new Error('Wybierz cel');
      if (!selectedHoldingId) throw new Error('Wybierz sztabkę lub monetę');

      const res = await fetch(`${API_URL}/api/goals/${selectedGoalId}/gold-value`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          goldHoldingId: selectedHoldingId,
        }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data?.error || 'Nie udało się przypiąć złota do celu');
      setSelectedHoldingId('');
      await fetchGoldData();
      if (onGoalUpdated) onGoalUpdated(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeGoldFromGoal = async (holding) => {
    try {
      setError('');
      const goalId = holding.goalId?._id || holding.goalId;
      if (!goalId) throw new Error('Ta pozycja nie jest przypięta do celu');

      const res = await fetch(`${API_URL}/api/goals/${goalId}/gold-value/${holding._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) throw new Error(data?.error || 'Nie udało się odpiąć złota od celu');
      await fetchGoldData();
      if (onGoalUpdated) onGoalUpdated(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const summary = goldData?.summary || {};
  const rate = goldData?.currentRate || {};
  const holdings = goldData?.holdings || [];
  const unassignedHoldings = holdings.filter(holding => !holding.goalId);
  const selectedHolding = holdings.find(holding => holding._id === selectedHoldingId);
  const selectedHoldingValue = selectedHolding ? selectedHolding.weightGrams * (rate.pricePerGram || 0) : 0;
  const profitLoss = summary.profitLoss;

  return (
    <div className="mb-6 space-y-4">
      <Card className="overflow-hidden rounded-2xl border-amber-500/30 bg-gradient-to-br from-[#2a2111] via-[#1f1b14] to-[#121212] text-white shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                <LucideIcons.Coins size={26} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-200/80">Fizyczne Złoto</p>
                <p className="mt-0.5 text-sm text-amber-100/70">
                  {loading ? 'Ładowanie kursu...' : `${moneyPln(rate.pricePerGram)} / gram`}
                </p>
              </div>
            </div>
            <Button type="button" size="sm" onClick={() => { setEditingId(null); setForm(emptyForm); setIsFormOpen(true); }}>
              <LucideIcons.Plus size={15} /> Dodaj
            </Button>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-amber-100/60">Posiadana ilość</p>
              <p className="text-2xl font-black">{weightPl(summary.totalGrams)} g</p>
              <p className="text-xs text-amber-100/60">~{weightPl(summary.totalOunces, 4)} oz</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-amber-100/60">Wartość SPOT</p>
              <p className="text-2xl font-black">{moneyPln(summary.spotValue)}</p>
              <p className="text-xs text-amber-100/60">{rate.date || 'NBP'}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-amber-100/60">Dealer 95-97%</p>
              <p className="text-sm font-bold text-amber-200">{moneyPln(summary.dealerBuybackMin)} - {moneyPln(summary.dealerBuybackMax)}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-xs text-amber-100/60">Skup / lombard</p>
              <p className="text-sm font-bold">{moneyPln(summary.scrapBuyback)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-amber-100/60">Zysk / strata</p>
              <p className={`text-sm font-bold ${profitLoss === null ? 'text-amber-100/60' : profitLoss >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {profitLoss === null ? 'Brak ceny zakupu' : moneyPln(profitLoss)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Twoje sztabki i monety</h3>
            <span className="text-xs text-muted-foreground">{holdings.length} pozycji</span>
          </div>
          {holdings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Brak zapisanych pozycji złota.
            </div>
          ) : (
            <div className="space-y-2">
              {holdings.map(holding => {
                const estimatedValue = holding.weightGrams * (rate.pricePerGram || 0);
                const assignedGoal = holding.goalId && typeof holding.goalId === 'object' ? holding.goalId : null;
                return (
                  <div key={holding._id} className="rounded-lg bg-muted/35 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{holding.name}</p>
                        <p className="text-xs text-muted-foreground">{weightPl(holding.weightGrams)} g · {moneyPln(estimatedValue)}</p>
                        {holding.purchaseDate && <p className="text-xs text-muted-foreground">Zakup: {format(new Date(holding.purchaseDate), 'dd.MM.yyyy')}</p>}
                        {assignedGoal ? (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                            <LucideIcons.Target size={13} />
                            {assignedGoal.name}
                          </div>
                        ) : (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-500">
                            <LucideIcons.Unlock size={13} />
                            Dostępna do celu
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {assignedGoal && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeGoldFromGoal(holding)} title="Odepnij od celu">
                            <LucideIcons.Unlink size={15} />
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" onClick={() => editHolding(holding)} title="Edytuj">
                          <LucideIcons.Pencil size={15} />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => deleteHolding(holding._id)} title="Usuń">
                          <LucideIcons.Trash2 size={15} className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Zalicz złoto na cel</h3>
          <div className="grid grid-cols-1 gap-2">
            <Select value={selectedHoldingId} onValueChange={setSelectedHoldingId}>
              <SelectTrigger><SelectValue placeholder="Wybierz dostępną sztabkę" /></SelectTrigger>
              <SelectContent>
                {unassignedHoldings.map(holding => (
                  <SelectItem key={holding._id} value={holding._id}>
                    {holding.name} · {weightPl(holding.weightGrams)} g · {moneyPln(holding.weightGrams * (rate.pricePerGram || 0))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
              <SelectTrigger><SelectValue placeholder="Wybierz cel" /></SelectTrigger>
              <SelectContent>
                {goals.map(goal => (
                  <SelectItem key={goal._id} value={goal._id}>{goal.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Do celu zostanie doliczona wartość wybranej pozycji wg bieżącego kursu NBP. To nie tworzy przelewu w historii i możesz odpiąć ją w każdej chwili.
          </p>
          {unassignedHoldings.length === 0 && (
            <p className="mt-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              Wszystkie zapisane pozycje złota są już przypięte do celów.
            </p>
          )}
          <Button type="button" className="mt-3 w-full" onClick={addGoldValueToGoal} disabled={!selectedGoalId || !selectedHoldingId}>
            <LucideIcons.Target size={16} /> Przypnij wartość {moneyPln(selectedHoldingValue)} do celu
          </Button>
        </CardContent>
      </Card>

      <GoldFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        error={error}
        form={form}
        setForm={setForm}
        editingId={editingId}
        setEditingId={setEditingId}
        onSave={saveHolding}
      />
    </div>
  );
};

export default GoldInvestments;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import { API_URL } from '../config';
import * as LucideIcons from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, isSameWeek, isSameMonth, isSameYear, isWithinInterval, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { pl } from "date-fns/locale";

import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  LeadingActions,
  Type
} from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = LucideIcons[name] || LucideIcons.Circle;
  return <IconComponent {...props} />;
};

const DeleteTransactionDialog = ({ isOpen, onClose, transaction, onDelete }) => {
  const [adjustBalance, setAdjustBalance] = useState(true);

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <LucideIcons.AlertTriangle size={32} />
          </div>
          <DialogTitle className="text-xl">Usuń transakcję</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Czy na pewno chcesz usunąć tę transakcję <br/> 
            <strong className="text-foreground">{transaction.description || transaction.categoryId?.name}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex justify-center">
          <label className="flex items-center gap-3 cursor-pointer bg-muted/50 p-4 rounded-xl border border-border/50 hover:bg-muted transition-colors">
            <Checkbox checked={adjustBalance} onCheckedChange={setAdjustBalance} className="scale-110" />
            <span className="text-sm font-medium">Cofnij zmianę salda ({transaction.amount.toFixed(2)} zł) na portfelu</span>
          </label>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center w-full">
          <Button variant="outline" className="flex-1" onClick={onClose}>Anuluj</Button>
          <Button variant="destructive" className="flex-1" onClick={() => onDelete(transaction._id, adjustBalance)}>Usuń trwale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditTransactionDialog = ({ isOpen, onClose, transaction, allWallets, allCategories, onEdit }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setDescription(transaction.description || '');
      setWalletId(transaction.walletId?._id || transaction.walletId || '');
      setCategoryId(transaction.categoryId?._id || transaction.categoryId || '');
      setDate(new Date(transaction.date));
    }
  }, [transaction]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !walletId || !categoryId || !date) return;
    onEdit(transaction._id, {
      amount: parseFloat(amount),
      description,
      walletId,
      categoryId,
      date: date.toISOString()
    });
  };

  if (!transaction) return null;

  const validCategories = allCategories.filter(c => !c.isAdjustment && c.name !== 'Korekta');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col items-center gap-2 mb-2">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2">
            <LucideIcons.Edit2 size={32} />
          </div>
          <DialogTitle className="text-xl">Edytuj transakcję</DialogTitle>
          <DialogDescription>Wprowadź nowe dane dla tej transakcji</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Kwota (zł)</label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                required 
                className="text-lg font-semibold"
              />
            </div>
            <div className="space-y-1 flex flex-col">
              <label className="text-xs font-medium text-muted-foreground">Data</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal pl-3">
                    {date ? format(date, "PPP", { locale: pl }) : <span>Wybierz datę</span>}
                    <LucideIcons.CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-border/50" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
                    initialFocus
                    captionLayout="dropdown"
                    fromYear={2000}
                    toYear={2050}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Opis</label>
            <Input 
              type="text" 
              placeholder="Opcjonalny opis" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Kategoria</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Wybierz kategorię" /></SelectTrigger>
              <SelectContent>
                {validCategories.map(c => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Portfel</label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger><SelectValue placeholder="Wybierz portfel" /></SelectTrigger>
              <SelectContent>
                {allWallets.map(w => (
                  <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-center w-full mt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Anuluj</Button>
            <Button type="submit" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">Zapisz zmiany</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const PINK_PALETTE = ['#d946ef', '#c026d3', '#a21caf', '#86198f', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#db2777', '#be185d', '#9d174d'];

const getPinkColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PINK_PALETTE[Math.abs(hash) % PINK_PALETTE.length];
};

const getCategoryColor = (category, colorTheme) => {
  if (!category) return '#ccc';
  if (colorTheme === 'pink') {
    return getPinkColor(category._id || category.name || 'unknown');
  }
  return category.color || '#ccc';
};

const Dashboard = () => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const { householdId, householdName, userId, colorTheme, theme, hideStatistics } = useStore();
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });

  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [transactionToEdit, setTransactionToEdit] = useState(null);

  // States for header & navigation
  const [selectedWalletId, setSelectedWalletId] = useState('all');
  const [transactionType, setTransactionType] = useState('expense'); // 'expense' or 'income'
  const [period, setPeriod] = useState('miesiąc'); // 'dzień', 'tydzień', 'miesiąc', 'rok', 'okres'
  const [dateOffset, setDateOffset] = useState(0); // Offset for time travel (0 = current)
  const [customDateRange, setCustomDateRange] = useState({ from: new Date(), to: new Date() });
  const [showCustomDateDialog, setShowCustomDateDialog] = useState(false);

  // States for scroll behavior and category view
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showCategorySearch, setShowCategorySearch] = useState(false);
  const [categorySortBy, setCategorySortBy] = useState('date-desc');

  const fetchAllData = async () => {
    try {
      const [transRes, walletRes, catRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions?householdId=${householdId}&userId=${userId}`),
        fetch(`${API_URL}/api/wallets?householdId=${householdId}&userId=${userId}`),
        fetch(`${API_URL}/api/categories?householdId=${householdId}`)
      ]);
      
      const transData = await transRes.json();
      const walletData = await walletRes.json();
      const catData = await catRes.json();
      
      setTransactions(transData);
      setWallets(walletData);
      setCategories(catData);
      
      const totalBalance = walletData.reduce((acc, w) => acc + w.balance, 0);
      
      let inc = 0;
      let exp = 0;
      transData.forEach(t => {
        if (!t.isAdjustment) {
          if (t.categoryId?.type === 'income') inc += t.amount;
          else if (t.categoryId?.type === 'expense') exp += t.amount;
        }
      });
      
      setSummary({ income: inc, expense: exp, balance: totalBalance });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditTransaction = async (transactionId, updatedData) => {
    try {
      const res = await fetch(`${API_URL}/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (res.ok) {
        setTransactionToEdit(null);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTransaction = async (transactionId, adjustBalance) => {
    try {
      const res = await fetch(`${API_URL}/api/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustBalance })
      });
      if (res.ok) {
        setTransactionToDelete(null);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (householdId) {
      fetchAllData();
    }
  }, [householdId]);

  const handleSummaryCardClick = (e) => {
    if (e.target.closest('button') || e.target.closest('[role="combobox"]') || e.target.closest('[role="dialog"]') || e.target.closest('.popover-trigger')) {
      return;
    }
    setIsChartCollapsed(prev => !prev);
  };

  // Data processing for layout
  const filteredTransactions = transactions.filter(t => {
    if (t.isAdjustment) return false;
    if (t.categoryId?.type !== transactionType) return false;
    
    if (selectedWalletId !== 'all') {
      const walletId = t.walletId?._id || t.walletId;
      if (walletId !== selectedWalletId) return false;
    }
    
    // Time period filtering
    const tDate = new Date(t.date);
    
    let now = new Date();
    if (dateOffset !== 0) {
      if (period === 'dzień') now = addDays(now, dateOffset);
      if (period === 'tydzień') now = addWeeks(now, dateOffset);
      if (period === 'miesiąc') now = addMonths(now, dateOffset);
      if (period === 'rok') now = addYears(now, dateOffset);
    }
    
    if (period === 'dzień' && !isSameDay(tDate, now)) return false;
    if (period === 'tydzień' && !isSameWeek(tDate, now, { weekStartsOn: 1 })) return false;
    if (period === 'miesiąc' && !isSameMonth(tDate, now)) return false;
    if (period === 'rok' && !isSameYear(tDate, now)) return false;
    if (period === 'okres' && customDateRange.from && customDateRange.to) {
      if (!isWithinInterval(tDate, { start: customDateRange.from, end: customDateRange.to })) return false;
    }
    
    return true;
  });

  const totalFiltered = filteredTransactions.reduce((acc, t) => acc + t.amount, 0);

  const catMap = {};
  filteredTransactions.forEach(t => {
    const name = t.categoryId?.name || 'Nieznane';
    const catId = t.categoryId?._id || name;
    if (!catMap[name]) {
      catMap[name] = { 
        _id: catId,
        name: name, 
        rawCategory: t.categoryId || { _id: catId, name: name },
        value: 0, 
        color: getCategoryColor(t.categoryId, colorTheme), 
        icon: t.categoryId?.icon || 'Circle' 
      };
    }
    catMap[name].value += t.amount;
  });

  const catArray = Object.values(catMap).sort((a, b) => b.value - a.value);

  const getChartBgColor = () => {
    if (theme === 'dark') return colorTheme === 'pink' ? '#0b090d' : '#09090b';
    return colorTheme === 'pink' ? '#fdfaff' : '#ffffff';
  };

  const doughnutData = {
    labels: catArray.map(c => c.name),
    datasets: [{
      data: catArray.map(c => c.value),
      backgroundColor: catArray.map(c => c.color),
      borderWidth: 3,
      borderColor: '#232322',
      hoverOffset: 4
    }]
  };

  const doughnutOptions = {
    cutout: '72%',
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw.toFixed(2)} zł`
        }
      },
      legend: {
        display: false
      }
    },
    maintainAspectRatio: false
  };

  const currentBalance = selectedWalletId === 'all' 
    ? summary.balance 
    : (wallets.find(w => w._id === selectedWalletId)?.balance || 0);

  const formatAmountPl = (num) => {
    return num.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const renderCategoryDetailView = () => {
    const selectedCategoryTransactions = filteredTransactions.filter(t => {
      const catName = t.categoryId?.name || 'Nieznane';
      const catId = t.categoryId?._id || t.categoryId;
      return catId === selectedCategory._id || catName === selectedCategory.name;
    }).filter(t => {
      if (!categorySearchQuery) return true;
      const q = categorySearchQuery.toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const walletName = (t.walletId?.name || '').toLowerCase();
      const amt = t.amount.toString();
      return desc.includes(q) || walletName.includes(q) || amt.includes(q);
    }).sort((a, b) => {
      if (categorySortBy === 'amount-desc') return b.amount - a.amount;
      if (categorySortBy === 'amount-asc') return a.amount - b.amount;
      return new Date(b.date) - new Date(a.date);
    });

    const catTotal = selectedCategoryTransactions.reduce((acc, t) => acc + t.amount, 0);

    const groupedByDate = {};
    selectedCategoryTransactions.forEach(t => {
      const dateStr = format(new Date(t.date), "d MMMM yyyy", { locale: pl });
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = [];
      }
      groupedByDate[dateStr].push(t);
    });

    const handleDownloadCsv = () => {
      if (!selectedCategoryTransactions.length) return;
      const headers = ["Data", "Kategoria", "Portfel", "Opis", "Kwota"];
      const rows = selectedCategoryTransactions.map(t => [
        format(new Date(t.date), "yyyy-MM-dd"),
        t.categoryId?.name || selectedCategory.name,
        t.walletId?.name || '',
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount.toFixed(2)
      ]);
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `transakcje_${selectedCategory.name}_${format(new Date(), "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        <div className="sticky top-0 z-20 bg-background pt-5 px-4 sm:px-6 pb-2 border-b border-border/40 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <button 
              type="button"
              onClick={() => setSelectedCategory(null)} 
              className="p-2 -ml-2 rounded-full text-foreground hover:bg-muted/50 transition-colors"
            >
              <LucideIcons.ChevronLeft size={26} />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {selectedCategory.name}
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-foreground mt-0.5">
                {formatAmountPl(catTotal)} zł
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                type="button"
                onClick={() => setShowCategorySearch(!showCategorySearch)} 
                className="p-2 rounded-full text-foreground hover:bg-muted/50 transition-colors"
              >
                <LucideIcons.Search size={22} />
              </button>
              <button 
                type="button"
                onClick={handleDownloadCsv} 
                className="p-2 -mr-2 rounded-full text-foreground hover:bg-muted/50 transition-colors"
                title="Pobierz CSV"
              >
                <LucideIcons.Download size={22} />
              </button>
            </div>
          </div>

          {showCategorySearch && (
            <div className="pt-2 pb-3 px-1 animate-in fade-in duration-200">
              <div className="relative">
                <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={`Szukaj w ${selectedCategory.name}...`}
                  value={categorySearchQuery}
                  onChange={e => setCategorySearchQuery(e.target.value)}
                  className="pl-9 pr-8 text-sm rounded-xl"
                />
                {categorySearchQuery && (
                  <button 
                    type="button"
                    onClick={() => setCategorySearchQuery('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <LucideIcons.X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center py-2 border-t border-border/30 mt-3 text-sm">
            <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
              <SelectTrigger className="w-auto border-none shadow-none text-foreground font-medium bg-transparent hover:bg-muted/50 transition-colors h-8 px-2 -ml-2 gap-1.5 focus:ring-0">
                <LucideIcons.DollarSign className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder="Wybierz portfel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Suma</SelectItem>
                {wallets.map(w => (
                  <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categorySortBy} onValueChange={setCategorySortBy}>
              <SelectTrigger className="w-auto border-none shadow-none text-foreground font-medium bg-transparent hover:bg-muted/50 transition-colors h-8 px-2 -mr-2 gap-1.5 focus:ring-0">
                <SelectValue placeholder="Sortuj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Wg daty</SelectItem>
                <SelectItem value="amount-desc">Wg kwoty (najwyższe)</SelectItem>
                <SelectItem value="amount-asc">Wg kwoty (najniższe)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-3 pb-28">
          {Object.keys(groupedByDate).length > 0 ? (
            Object.entries(groupedByDate).map(([dateStr, transList]) => (
              <div key={dateStr} className="mb-6">
                <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground my-2 px-1 tracking-wide">
                  {dateStr}
                </h4>
                <div className="flex flex-col gap-2">
                  <SwipeableList type={Type.IOS} threshold={0.3}>
                    {transList.map(t => (
                      <SwipeableListItem
                        key={t._id}
                        className="mb-2 rounded-xl overflow-hidden"
                        leadingActions={
                          <LeadingActions>
                            <SwipeAction onClick={() => setTransactionToDelete(t)}>
                              <div className="h-full flex items-center w-full pl-2 pr-2">
                                <div className="bg-destructive text-destructive-foreground h-12 w-full flex items-center rounded-full shadow-md justify-start overflow-hidden min-w-[3rem] border-2 border-background">
                                  <div className="w-12 h-12 flex items-center justify-center shrink-0">
                                    <LucideIcons.Trash2 size={20} />
                                  </div>
                                </div>
                              </div>
                            </SwipeAction>
                          </LeadingActions>
                        }
                        trailingActions={
                          <TrailingActions>
                            <SwipeAction onClick={() => setTransactionToEdit(t)}>
                              <div className="h-full flex items-center w-full pl-2 pr-2">
                                <div className="bg-blue-500 text-white h-12 w-full flex items-center justify-end rounded-full shadow-md overflow-hidden min-w-[3rem] border-2 border-background">
                                  <div className="w-12 h-12 flex items-center justify-center shrink-0">
                                    <LucideIcons.Edit2 size={20} />
                                  </div>
                                </div>
                              </div>
                            </SwipeAction>
                          </TrailingActions>
                        }
                      >
                        <Card 
                          className="w-full bg-card border-border/50 hover:border-border transition-colors cursor-pointer shadow-sm rounded-xl"
                          onClick={() => setTransactionToEdit(t)}
                        >
                          <CardContent className="p-3.5 px-4 flex justify-between items-center">
                            <div className="flex items-center gap-3.5">
                              <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm" 
                                style={{ backgroundColor: selectedCategory.color || getCategoryColor(t.categoryId, colorTheme) }}
                              >
                                <DynamicIcon name={t.categoryId?.icon || selectedCategory.icon || 'Circle'} size={20} />
                              </div>
                              <div className="flex flex-col justify-center">
                                <p className="font-semibold text-sm sm:text-base text-foreground leading-snug">
                                  {t.categoryId?.name || selectedCategory.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {t.walletId?.name || 'Portfel'}
                                </p>
                                {t.description && (
                                  <p className="text-xs text-muted-foreground/80 mt-0.5 font-light">
                                    {t.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className={`font-semibold text-right whitespace-nowrap text-base sm:text-lg ${t.categoryId?.type === 'income' ? 'text-brand' : 'text-foreground'}`}>
                              {formatAmountPl(t.amount)} zł
                            </div>
                          </CardContent>
                        </Card>
                      </SwipeableListItem>
                    ))}
                  </SwipeableList>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-sm text-muted-foreground my-12">
              Brak transakcji w tej kategorii
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMainDashboardView = () => {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Sticky Summary Header */}
        <div className="sticky top-0 z-20 bg-background pt-5 px-4 sm:px-6 pb-3 border-b border-border/40 shadow-sm flex-shrink-0 transition-all duration-300">
          {/* HEADER: Wallet Selection & Balance (Bez hamburger menu i bez ikony po prawej) */}
          <div className="flex flex-col items-center justify-center">
            <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
              <SelectTrigger className="w-auto border-none shadow-none text-foreground font-medium bg-transparent hover:bg-muted/50 transition-colors h-8 text-sm gap-1.5 focus:ring-0">
                <LucideIcons.DollarSign className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder="Wybierz portfel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Suma</SelectItem>
                {wallets.map(w => (
                  <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5 text-foreground">
              {formatAmountPl(currentBalance)} zł
            </h2>
          </div>

          {/* Tabs: Wydatki / Dochody (Sliding Pill) */}
          <div className="flex w-full mt-3 sm:mt-4 mb-2 bg-muted/60 p-1 rounded-xl relative">
            <div 
              className="absolute top-1 bottom-1 left-1 bg-background shadow-sm rounded-lg transition-transform duration-300 ease-out border border-border/40"
              style={{
                width: 'calc(50% - 0.25rem)',
                transform: transactionType === 'expense' ? 'translateX(0)' : 'translateX(100%)'
              }}
            ></div>
            <button
              type="button"
              onClick={() => setTransactionType('expense')}
              className={`relative z-10 flex-1 py-2 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors select-none ${transactionType === 'expense' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
            >
              WYDATKI
            </button>
            <button
              type="button"
              onClick={() => setTransactionType('income')}
              className={`relative z-10 flex-1 py-2 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors select-none ${transactionType === 'income' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
            >
              DOCHODY
            </button>
          </div>

          {/* Dark Summary Card (Kliknij w okienko podsumowania, aby zwinąć/rozwinąć wykres) */}
          <div 
            onClick={handleSummaryCardClick}
            className="bg-[#232322] dark:bg-[#1c1c1e] text-white rounded-[26px] p-4 sm:p-5 mt-4 shadow-xl relative border border-white/5 transition-all duration-300 cursor-pointer select-none"
            title={isChartCollapsed ? "Kliknij w okienko podsumowania, aby rozwinąć wykres" : "Kliknij w okienko podsumowania, aby zwinąć wykres w pasek"}
          >
            {/* Tabs: Czas (Sliding Pill) */}
            <div className="flex justify-between w-full mb-3 px-1 py-1 bg-black/40 rounded-xl relative gap-1 border border-white/5">
              <div 
                className="absolute top-1 bottom-1 left-1 bg-[#3a3a38] dark:bg-white/15 rounded-lg shadow-sm transition-transform duration-300 ease-out border border-white/10"
                style={{
                  width: 'calc((100% - 1.5rem) / 5)',
                  transform: `translateX(calc(${['dzień', 'tydzień', 'miesiąc', 'rok', 'okres'].indexOf(period) * 100}% + ${['dzień', 'tydzień', 'miesiąc', 'rok', 'okres'].indexOf(period) * 0.25}rem))`
                }}
              ></div>

              {['Dzień', 'Tydzień', 'Miesiąc', 'Rok'].map(p => {
                const val = p.toLowerCase();
                const isActive = period === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPeriod(val); setDateOffset(0); }}
                    className={`relative z-10 flex-1 text-center py-1.5 px-1 rounded-lg text-xs cursor-pointer transition-colors duration-300 whitespace-nowrap select-none ${isActive ? 'text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                  >
                    {p}
                  </button>
                );
              })}
              
              <Popover open={showCustomDateDialog} onOpenChange={setShowCustomDateDialog}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPeriod('okres'); setShowCustomDateDialog(true); }}
                    className={`relative z-10 flex-1 text-center py-1.5 px-1 rounded-lg text-xs cursor-pointer transition-colors duration-300 whitespace-nowrap select-none popover-trigger ${period === 'okres' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                  >
                    Okres
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-border/50" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange?.from || new Date()}
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={1}
                    fromYear={2000}
                    toYear={2050}
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Wyświetlanie bieżącego zakresu dat i nawigacja */}
            <div className="flex items-center justify-between w-full mb-2 px-1">
              {period !== 'okres' ? (
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDateOffset(prev => prev - 1); }} 
                  className="p-1 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <LucideIcons.ChevronLeft size={20} />
                </button>
              ) : <div className="w-6" />}
              <div className="text-sm sm:text-base font-semibold text-white tracking-wide text-center">
                {(() => {
                  let now = new Date();
                  if (dateOffset !== 0) {
                    if (period === 'dzień') now = addDays(now, dateOffset);
                    if (period === 'tydzień') now = addWeeks(now, dateOffset);
                    if (period === 'miesiąc') now = addMonths(now, dateOffset);
                    if (period === 'rok') now = addYears(now, dateOffset);
                  }

                  if (period === 'dzień') return format(now, "d MMMM yyyy", { locale: pl });
                  if (period === 'tydzień') {
                    const start = new Date(now);
                    const day = start.getDay() || 7;
                    if (day !== 1) start.setHours(-24 * (day - 1));
                    const end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    return `${format(start, "d MMM", { locale: pl })} - ${format(end, "d MMM yyyy", { locale: pl })}`;
                  }
                  if (period === 'miesiąc') return format(now, "MMMM yyyy", { locale: pl }).replace(/^\w/, (c) => c.toUpperCase());
                  if (period === 'rok') return format(now, "yyyy");
                  if (period === 'okres') {
                    if (customDateRange?.from && customDateRange?.to) {
                      return `${format(customDateRange.from, "d MMM yyyy", { locale: pl })} - ${format(customDateRange.to, "d MMM yyyy", { locale: pl })}`;
                    }
                    if (customDateRange?.from) return `Od: ${format(customDateRange.from, "d MMM yyyy", { locale: pl })}`;
                    return "Wybierz zakres dat";
                  }
                  return "";
                })()}
              </div>
              {period !== 'okres' ? (
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDateOffset(prev => prev + 1); }} 
                  className="p-1 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <LucideIcons.ChevronRight size={20} />
                </button>
              ) : <div className="w-6" />}
            </div>

            {/* Wykres Kółko (rozwinięty) / Pasek (zwinięty) */}
            {!isChartCollapsed ? (
              <div className="relative w-52 h-52 sm:w-60 sm:h-60 mx-auto my-3 sm:my-4 flex items-center justify-center transition-all duration-300">
                {catArray.length > 0 ? (
                  <>
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-2 border-dashed border-gray-600/60 flex items-center justify-center p-2">
                        <span className="text-xl sm:text-2xl font-bold text-white tracking-tight text-center">
                          {formatAmountPl(totalFiltered)} zł
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-sm text-gray-400 my-8">
                    Brak danych w tym okresie
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full my-2.5 transition-all duration-300">
                {catArray.length > 0 ? (
                  <>
                    <div className="w-full h-3.5 sm:h-4 rounded-full overflow-hidden flex shadow-inner bg-black/40 border border-white/5">
                      {catArray.map(c => {
                        const pct = totalFiltered > 0 ? (c.value / totalFiltered) * 100 : 0;
                        return (
                          <div
                            key={c.name}
                            style={{ width: `${pct}%`, backgroundColor: c.color }}
                            className="h-full border-r border-[#232322] last:border-0 transition-all duration-500"
                            title={`${c.name}: ${c.value.toFixed(2)} zł`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center mt-2 text-xs sm:text-sm">
                      <span className="text-gray-400 font-medium">Suma w okresie:</span>
                      <span className="font-bold text-white">
                        {formatAmountPl(totalFiltered)} zł
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-xs sm:text-sm text-gray-400 my-2">
                    Brak danych w tym okresie
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Kategorie List */}
        <div 
          ref={scrollContainerRef} 
          className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-28"
        >
          <div className="flex flex-col gap-2.5 mb-6">
            {catArray.map(c => {
              const pct = totalFiltered > 0 ? ((c.value / totalFiltered) * 100).toFixed(0) : 0;
              return (
                <Card 
                  key={c.name} 
                  className="bg-card border-border/50 hover:border-border transition-all duration-200 cursor-pointer shadow-sm rounded-2xl active:scale-[0.99]"
                  onClick={() => {
                    setSelectedCategory(c);
                    setCategorySearchQuery('');
                    setShowCategorySearch(false);
                  }}
                >
                  <CardContent className="p-3.5 px-4 flex justify-between items-center">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: c.color }}>
                        <DynamicIcon name={c.icon} size={22} />
                      </div>
                      <span className="font-semibold text-foreground text-base">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs sm:text-sm text-muted-foreground font-medium w-8 text-right">{pct}%</span>
                      <span className="font-bold text-foreground text-right min-w-fit whitespace-nowrap text-base sm:text-lg">
                        {formatAmountPl(c.value)} zł
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {selectedCategory ? renderCategoryDetailView() : renderMainDashboardView()}

      <DeleteTransactionDialog 
        isOpen={!!transactionToDelete} 
        onClose={() => setTransactionToDelete(null)}
        transaction={transactionToDelete}
        onDelete={handleDeleteTransaction}
      />

      <EditTransactionDialog 
        isOpen={!!transactionToEdit}
        onClose={() => setTransactionToEdit(null)}
        transaction={transactionToEdit}
        allWallets={wallets}
        allCategories={categories}
        onEdit={handleEditTransaction}
      />
    </div>
  );
};

export default Dashboard;

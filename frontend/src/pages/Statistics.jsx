import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { API_URL } from '../config';
import * as LucideIcons from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, RadialLinearScale, PointElement, LineElement, Title } from 'chart.js';
import { Doughnut, Bar, PolarArea, Line } from 'react-chartjs-2';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  RadialLinearScale, 
  PointElement, 
  LineElement, 
  Title
);

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

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = LucideIcons[name] || LucideIcons.Circle;
  return <IconComponent {...props} />;
};

const Statistics = () => {
  const { householdId, userId, colorTheme, theme } = useStore();
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/transactions?householdId=${householdId}&userId=${userId}`);
        setTransactions(await res.json());
      } catch (err) {
        console.error(err);
      }
    };
    if (householdId) fetchStats();
  }, [householdId]);

  // --- Data Processing ---
  const validTransactions = transactions.filter(t => !t.isAdjustment);
  const expenses = validTransactions.filter(t => t.categoryId?.type === 'expense');
  const incomes = validTransactions.filter(t => t.categoryId?.type === 'income');

  // 1. Expenses by Category (Doughnut & PolarArea)
  const expenseCatMap = {};
  expenses.forEach(t => {
    const name = t.categoryId?.name || 'Nieznane';
    if (!expenseCatMap[name]) {
      expenseCatMap[name] = { value: 0, color: getCategoryColor(t.categoryId, colorTheme), icon: t.categoryId?.icon || 'Circle' };
    }
    expenseCatMap[name].value += t.amount;
  });
  
  const expenseCatLabels = Object.keys(expenseCatMap);
  const expenseCatValues = expenseCatLabels.map(k => expenseCatMap[k].value);
  const expenseCatColors = expenseCatLabels.map(k => expenseCatMap[k].color);

  const getChartBgColor = () => {
    if (theme === 'dark') return colorTheme === 'pink' ? '#0b090d' : '#09090b';
    return colorTheme === 'pink' ? '#fdfaff' : '#ffffff';
  };

  const doughnutData = {
    labels: expenseCatLabels,
    datasets: [{
      data: expenseCatValues,
      backgroundColor: expenseCatColors,
      borderWidth: 4,
      borderColor: getChartBgColor(),
      hoverOffset: 4
    }]
  };

  // 2. Income vs Expense (Bar)
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomes.reduce((sum, t) => sum + t.amount, 0);
  
  const barData = {
    labels: ['Przychody', 'Wydatki'],
    datasets: [{
      label: 'PLN',
      data: [totalIncome, totalExpense],
      backgroundColor: ['#10b981', '#ef4444'], // emerald-500, red-500
      borderRadius: 8
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#888' }
      }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { color: '#888' }, grid: { color: '#333' } },
      x: { ticks: { color: '#888' }, grid: { display: false } }
    }
  };

  return (
    <div className="flex-1 p-6 pb-20 overflow-y-auto">
      <h2 className="mb-6 font-semibold text-xl">Statystyki i Analiza</h2>

      {/* Wykres Kołowy - Struktura Wydatków */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="text-center font-medium mb-4 text-sm text-muted-foreground">Struktura Wydatków</h3>
          <div className="h-[250px] w-full relative">
            {expenseCatValues.length > 0 ? (
              <Doughnut data={doughnutData} options={chartOptions} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Brak wydatków</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Wykres Słupkowy - Przychody vs Wydatki */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="text-center font-medium mb-4 text-sm text-muted-foreground">Przychody a Wydatki</h3>
          <div className="h-[250px] w-full relative">
             <Bar data={barData} options={barOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Rozeta (Polar Area) - Struktura Wydatków */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="text-center font-medium mb-4 text-sm text-muted-foreground">Rozkład Wydatków (Rozeta)</h3>
          <div className="h-[250px] w-full relative">
            {expenseCatValues.length > 0 ? (
              <PolarArea 
                data={doughnutData} 
                options={{
                  ...chartOptions,
                  scales: {
                    r: { ticks: { display: false }, grid: { color: '#333' } }
                  }
                }} 
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Brak wydatków</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Szczegółowa Lista */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Szczegóły Kategorii</h3>
        <div className="flex flex-col gap-2">
          {expenseCatLabels.map(name => (
            <Card key={name}>
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: expenseCatMap[name].color }}>
                    <DynamicIcon name={expenseCatMap[name].icon} size={16} />
                  </div>
                  <span className="font-medium text-sm">{name}</span>
                </div>
                <span className="font-semibold">{expenseCatMap[name].value.toFixed(2)} zł</span>
              </CardContent>
            </Card>
          ))}
          {expenseCatLabels.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Brak danych.</p>}
        </div>
      </div>
    </div>
  );
};

export default Statistics;

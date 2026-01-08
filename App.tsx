
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, RefreshCw, Save, History as HistoryIcon, Banknote, Trash2, Edit2,
  TrendingUp, Loader2, List, AlertCircle,
  Wind, CloudLightning, Tornado, Snowflake, X
} from 'lucide-react';
import { Stock, Transaction, Snapshot, PortfolioTotals } from './types';
import { WIND_MOODS, APP_STORAGE_KEYS } from './constants';
import { fetchAllStockPrices, SyncStatus, formatDateTW } from './services/stockService';

const App: React.FC = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [currentWindId, setCurrentWindId] = useState<number>(4);
  
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  
  const [stockNames, setStockNames] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('cached_stock_names');
    return saved ? JSON.parse(saved) : {};
  });

  const [stockForm, setStockForm] = useState({
    name: '', code: '', shares: '', cost: '', currentPrice: '', 
    period: '中期' as Stock['period'], takeProfit: '', stopLoss: ''
  });
  const [cashForm, setCashForm] = useState({ amount: '', type: 'deposit' as Transaction['type'] });

  useEffect(() => {
    const savedStocks = localStorage.getItem(APP_STORAGE_KEYS.STOCKS);
    const savedTrans = localStorage.getItem(APP_STORAGE_KEYS.TRANSACTIONS);
    const savedHistory = localStorage.getItem(APP_STORAGE_KEYS.HISTORY);
    const savedWind = localStorage.getItem(APP_STORAGE_KEYS.WIND);
    
    if (savedStocks) setStocks(JSON.parse(savedStocks));
    if (savedTrans) setTransactions(JSON.parse(savedTrans));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedWind) setCurrentWindId(Number(savedWind));
  }, []);

  useEffect(() => {
    localStorage.setItem(APP_STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
    localStorage.setItem(APP_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    localStorage.setItem(APP_STORAGE_KEYS.HISTORY, JSON.stringify(history));
    localStorage.setItem(APP_STORAGE_KEYS.WIND, currentWindId.toString());
    localStorage.setItem('cached_stock_names', JSON.stringify(stockNames));
  }, [stocks, transactions, history, currentWindId, stockNames]);

  const totals = useMemo<PortfolioTotals>(() => {
    const totalBudget = transactions.reduce((acc, t) => t.type === 'deposit' ? acc + t.amount : acc - t.amount, 0);
    const investedCapital = stocks.reduce((acc, s) => acc + (s.shares * s.cost), 0);
    const marketValue = stocks.reduce((acc, s) => acc + (s.shares * s.currentPrice), 0);
    const availableCash = totalBudget - investedCapital;
    const totalProfit = marketValue - investedCapital;
    
    return { totalBudget, investedCapital, marketValue, availableCash, totalProfit };
  }, [stocks, transactions]);

  const currentWind = useMemo(() => WIND_MOODS.find(w => w.id === currentWindId) || WIND_MOODS[3], [currentWindId]);

  const updateAllPrices = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setSyncErrors([]);
    
    try {
      const result: SyncStatus = await fetchAllStockPrices();
      
      if (Object.keys(result.prices).length > 0) {
        setStocks(prev => prev.map(stock => {
          const latestPrice = result.prices[stock.code.trim()];
          return {
            ...stock,
            currentPrice: latestPrice || stock.currentPrice
          };
        }));
      }

      if (Object.keys(result.names).length > 0) {
        setStockNames(prev => ({ ...prev, ...result.names }));
      }

      setSyncErrors(result.errors);
      setLastUpdated(`${result.timestamp}${result.errors.length > 0 ? " (異常)" : " (成功)"}`);
    } catch (e) {
      setSyncErrors(["連線異常"]);
    } finally {
      setIsUpdating(false);
    }
  }, [isUpdating]);

  const handleSaveStock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = stockForm.code.trim();
    const baseStock = {
      name: stockForm.name,
      code: cleanCode,
      shares: Number(stockForm.shares),
      cost: Number(stockForm.cost),
      currentPrice: Number(stockForm.currentPrice || stockForm.cost),
      period: stockForm.period,
      takeProfit: stockForm.takeProfit ? Number(stockForm.takeProfit) : null,
      stopLoss: stockForm.stopLoss ? Number(stockForm.stopLoss) : null
    };

    if (editingStockId !== null) {
      setStocks(prev => prev.map(s => s.id === editingStockId ? { ...baseStock, id: s.id } : s));
    } else {
      setStocks([...stocks, { ...baseStock, id: Date.now() }]);
    }
    closeStockModal();
  };

  const handleAddCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashForm.amount || Number(cashForm.amount) <= 0) return;
    
    const newTrans: Transaction = {
      id: Date.now(),
      amount: Number(cashForm.amount),
      type: cashForm.type,
      date: formatDateTW()
    };
    setTransactions([newTrans, ...transactions]);
    setCashForm({ amount: '', type: 'deposit' });
    setIsCashModalOpen(false);
  };

  const saveSnapshot = () => {
    const snapshot: Snapshot = {
      id: Date.now(),
      date: formatDateTW(),
      marketValue: totals.marketValue,
      totalProfit: totals.totalProfit,
      wind: currentWind,
      stockCount: stocks.length
    };
    setHistory([snapshot, ...history]);
  };

  const openEditModal = (stock: Stock) => {
    setEditingStockId(stock.id);
    setStockForm({
      name: stock.name, code: stock.code, shares: stock.shares.toString(),
      cost: stock.cost.toString(), currentPrice: stock.currentPrice.toString(),
      period: stock.period, takeProfit: stock.takeProfit?.toString() || '', stopLoss: stock.stopLoss?.toString() || ''
    });
    setIsStockModalOpen(true);
  };

  const closeStockModal = () => {
    setIsStockModalOpen(false);
    setEditingStockId(null);
    setStockForm({ name: '', code: '', shares: '', cost: '', currentPrice: '', period: '中期', takeProfit: '', stopLoss: '' });
  };

  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));

  useEffect(() => {
    updateAllPrices();
    const timer = setInterval(updateAllPrices, 300000);
    return () => clearInterval(timer);
  }, []);

  const MoodIcon = ({ icon, className }: { icon: string, className?: string }) => {
    switch(icon) {
      case 'Tornado': return <Tornado className={className} />;
      case 'Wind': return <Wind className={className} />;
      case 'CloudLightning': return <CloudLightning className={className} />;
      case 'Snowflake': return <Snowflake className={className} />;
      default: return <Wind className={className} />;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3 text-slate-900">
              ZethanLu放風箏 <span className="bg-emerald-500 text-white text-[10px] px-2 py-1 rounded uppercase tracking-widest font-black shadow-sm">Investment Terminal</span>
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 font-medium">
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin text-blue-500"/> : <RefreshCw className="w-3 h-3 text-slate-400"/>}
              <span>{lastUpdated ? `數據最後同步: ${lastUpdated}` : '系統同步中...'}</span>
              {syncErrors.length > 0 && <span className="text-red-500 flex items-center gap-1 font-bold bg-red-50 px-2 py-0.5 rounded-full text-xs"><AlertCircle className="w-3 h-3"/> 同步受限</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="btn-history">
              <HistoryIcon className="w-4 h-4" /> 歷史
            </button>
            <button onClick={saveSnapshot} className="btn-settle">
              <Save className="w-4 h-4" /> 結算
            </button>
            <button onClick={() => setIsCashModalOpen(true)} className="btn-cash">
              <Banknote className="w-4 h-4" /> 資金
            </button>
            <button onClick={updateAllPrices} className="btn-update">
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} /> 即時更新
            </button>
            <button onClick={() => setIsStockModalOpen(true)} className="btn-add">
              <Plus className="w-4 h-4" /> 新增持股
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '入金總額', value: totals.totalBudget, color: 'text-slate-900' },
            { label: '可用現金', value: totals.availableCash, color: 'text-emerald-600' },
            { label: '持股市值', value: totals.marketValue, color: 'text-blue-600' },
            { label: '未實現損益', value: totals.totalProfit, color: totals.totalProfit >= 0 ? 'text-rose-600' : 'text-emerald-600', prefix: true },
          ].map((c, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">{c.label}</div>
              <div className={`text-2xl font-mono font-bold ${c.color}`}>{c.prefix && c.value >= 0 ? '+' : ''}{formatNum(c.value)}</div>
            </div>
          ))}
        </div>

        {/* Market Mood Display */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <MoodIcon icon={currentWind.icon} className={`w-8 h-8 ${currentWind.color}`} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black">目前市場風度</div>
                <div className="text-2xl font-bold text-slate-800 tracking-wide">{currentWind.name}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              {WIND_MOODS.map(wind => (
                <button 
                  key={wind.id}
                  onClick={() => setCurrentWindId(wind.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${currentWindId === wind.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200 ring-2 ring-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                >
                  {wind.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* History Panel */}
        {isHistoryOpen && (
          <div className="bg-white rounded-2xl border border-indigo-200 overflow-hidden animate-in fade-in slide-in-from-top-2 shadow-lg">
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2 text-indigo-700 text-sm"><HistoryIcon className="w-4 h-4" /> 歷史結算紀錄</h3>
              <button onClick={() => setHistory([])} className="text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase tracking-widest">清空紀錄</button>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[10px] sticky top-0 uppercase tracking-widest font-black">
                  <tr>
                    <th className="px-6 py-3">結算時間</th>
                    <th className="px-6 py-3">總市值</th>
                    <th className="px-6 py-3">損益</th>
                    <th className="px-6 py-3 text-right">風度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">尚無歷史結算紀錄。</td></tr>
                  )}
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-6 py-4 text-slate-500 text-xs font-mono">{item.date}</td>
                      <td className="px-6 py-4 font-mono text-slate-900 font-bold">$ {formatNum(item.marketValue)}</td>
                      <td className={`px-6 py-4 font-mono font-black ${item.totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {item.totalProfit >= 0 ? '+' : ''}{formatNum(item.totalProfit)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${item.wind.color.replace('text-', 'border-').replace('400', '200')} bg-white shadow-sm`}>
                          {item.wind.name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stock List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2 text-slate-800"><List className="w-5 h-5 text-blue-500" /> 持股策略監控</h2>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest font-mono">Real-time Trading Desk</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-400 text-[10px] uppercase bg-slate-50/30 tracking-widest font-black border-b border-slate-100">
                  <th className="px-6 py-4">標的/代碼</th>
                  <th className="px-6 py-4">成本/現價</th>
                  <th className="px-6 py-4">庫存市值</th>
                  <th className="px-6 py-4">策略區間</th>
                  <th className="px-6 py-4">獲利狀況</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stocks.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">目前無持股數據，請點擊上方按鈕新增。</td></tr>
                )}
                {stocks.map(s => {
                  const profit = (s.currentPrice - s.cost) * s.shares;
                  const pct = s.cost ? ((s.currentPrice - s.cost) / s.cost) * 100 : 0;
                  const isTP = s.takeProfit && s.currentPrice >= s.takeProfit;
                  const isSL = s.stopLoss && s.currentPrice <= s.stopLoss;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {s.name} <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-mono border border-slate-200">{s.code}</span>
                        </div>
                        <span className="inline-block mt-1 text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{s.period}</span>
                      </td>
                      <td className="px-6 py-5 font-mono">
                        <div className="text-slate-400 text-[10px]">Cost: {formatNum(s.cost)}</div>
                        <div className="font-bold text-slate-800">Now: {formatNum(s.currentPrice)}</div>
                      </td>
                      <td className="px-6 py-5 font-mono">
                        <div className="font-bold text-blue-600">{formatNum(s.shares * s.currentPrice)}</div>
                        <div className="text-slate-400 text-[10px]">{formatNum(s.shares)} 股</div>
                      </td>
                      <td className="px-6 py-5 font-mono text-[10px]">
                        <div className={s.takeProfit ? "text-rose-500 font-bold" : "text-slate-400"}>目標: {s.takeProfit || '--'}</div>
                        <div className={s.stopLoss ? "text-emerald-600 font-bold" : "text-slate-400"}>警戒: {s.stopLoss || '--'}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          {isTP && <div className="badge-alert bg-rose-500 animate-pulse">觸發停利</div>}
                          {isSL && <div className="badge-alert bg-emerald-500 animate-pulse">觸發停損</div>}
                          <div className={`font-black text-sm flex items-center gap-1 ${pct >= 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                            {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEditModal(s)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={() => setStocks(prev => prev.filter(x => x.id !== s.id))} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Button Styles */}
      <style>{`
        .btn-history { @apply flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl border border-indigo-200 text-sm font-bold transition-all shadow-sm; }
        .btn-settle { @apply flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl border border-emerald-200 text-sm font-bold transition-all shadow-sm; }
        .btn-cash { @apply flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl border border-amber-200 text-sm font-bold transition-all shadow-sm; }
        .btn-update { @apply flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-100; }
        .btn-add { @apply flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-sm font-bold transition-all shadow-md shadow-slate-200; }
        
        .badge-alert { @apply text-[9px] font-black px-2 py-0.5 rounded text-white flex items-center justify-center w-fit shadow-sm uppercase tracking-widest; }
        .form-input { @apply w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 transition-all; }
      `}</style>

      {/* Modal Overlays */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative animate-in zoom-in-95">
            <button onClick={closeStockModal} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X/></button>
            <h3 className="text-2xl font-black mb-8 text-slate-900 tracking-tighter">{editingStockId ? '編輯持股部位' : '新增投資標的'}</h3>
            <form onSubmit={handleSaveStock} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block ml-1">證券代號</label>
                  <input type="text" required placeholder="如: 2330" className="form-input" value={stockForm.code} onChange={e => {
                    const code = e.target.value;
                    setStockForm(f => ({ ...f, code, name: stockNames[code] || f.name }));
                  }} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block ml-1">標的名稱</label>
                  <input type="text" required placeholder="如: 台積電" className="form-input" value={stockForm.name} onChange={e => setStockForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block ml-1">持股數量 (股)</label>
                  <input type="number" required placeholder="0" className="form-input" value={stockForm.shares} onChange={e => setStockForm(f => ({ ...f, shares: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block ml-1">平均成本 (TWD)</label>
                  <input type="number" step="0.01" required placeholder="0.00" className="form-input" value={stockForm.cost} onChange={e => setStockForm(f => ({ ...f, cost: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1 block ml-1">停利目標價</label>
                  <input type="number" step="0.01" placeholder="非必填" className="form-input border-rose-100 focus:ring-rose-400" value={stockForm.takeProfit} onChange={e => setStockForm(f => ({ ...f, takeProfit: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1 block ml-1">停損警戒價</label>
                  <input type="number" step="0.01" placeholder="非必填" className="form-input border-emerald-100 focus:ring-emerald-400" value={stockForm.stopLoss} onChange={e => setStockForm(f => ({ ...f, stopLoss: e.target.value }))} />
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-slate-800 transition-all">
                {editingStockId ? '更新部位資料' : '確認建立部位'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-8 shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setIsCashModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X/></button>
            <h3 className="text-xl font-black mb-6 text-center text-slate-900">資金部位調整</h3>
            <form onSubmit={handleAddCash} className="space-y-4">
              <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
                <button type="button" onClick={() => setCashForm({...cashForm, type: 'deposit'})} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${cashForm.type === 'deposit' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>入金</button>
                <button type="button" onClick={() => setCashForm({...cashForm, type: 'withdraw'})} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${cashForm.type === 'withdraw' ? 'bg-white text-rose-500 shadow-sm border border-slate-200' : 'text-slate-400'}`}>出金</button>
              </div>
              <input type="number" required placeholder="請輸入金額" className="form-input text-center text-2xl font-mono font-bold" value={cashForm.amount} onChange={e => setCashForm({...cashForm, amount: e.target.value})} />
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black hover:bg-slate-800 transition-all shadow-lg">提交調整</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

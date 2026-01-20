import React, { useState, useMemo } from 'react';
import { AppData, Transaction, Church, Member } from '../types';
import { addTransaction, deleteTransaction } from '../services/storageService';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Filter, Wallet, Calendar, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinancesProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const Finances: React.FC<FinancesProps> = ({ data, onUpdate, activeChurch, currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // State
  const [filterChurch, setFilterChurch] = useState<Church | 'All'>(isAdmin && activeChurch === 'CM' ? 'All' : (activeChurch === 'CM' ? 'UJ' : activeChurch));
  const [filterType, setFilterType] = useState<'All' | 'INCOME' | 'EXPENSE'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Transaction>>({
      amount: 0,
      type: 'INCOME',
      category: 'Offering',
      description: '',
      date: new Date().toISOString().split('T')[0],
      churchId: (activeChurch === 'CM' ? 'UJ' : activeChurch)
  });

  // Derived Data
  const filteredTransactions = useMemo(() => {
      let txns = data.transactions || [];
      
      // Filter by Church
      if (filterChurch !== 'All') {
          txns = txns.filter(t => t.churchId === filterChurch);
      } else if (!isAdmin) {
          // Safety: If not admin and viewing all, force own church (though logic above handles initial state)
          txns = txns.filter(t => t.churchId === currentUser.assignedChurch);
      }

      // Filter by Type
      if (filterType !== 'All') {
          txns = txns.filter(t => t.type === filterType);
      }

      // Sort Date Descending
      return txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.transactions, filterChurch, filterType, isAdmin, currentUser.assignedChurch]);

  const stats = useMemo(() => {
      let income = 0;
      let expense = 0;
      filteredTransactions.forEach(t => {
          if (t.type === 'INCOME') income += t.amount;
          else expense += t.amount;
      });
      return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
      const grouped: Record<string, { name: string; income: number; expense: number }> = {};
      
      // Group by Month (Last 6 months usually good, or just all data aggregated)
      filteredTransactions.forEach(t => {
          const date = new Date(t.date);
          const key = `${date.getFullYear()}-${date.getMonth()}`;
          const label = date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
          
          if (!grouped[key]) grouped[key] = { name: label, income: 0, expense: 0 };
          
          if (t.type === 'INCOME') grouped[key].income += t.amount;
          else grouped[key].expense += t.amount;
      });

      // Convert to array and sort
      return Object.values(grouped).reverse(); // Assuming original sort was desc, we want chronological for chart? Actually original was desc, so this iterates desc. Reversing makes it asc?
      // Wait, iteration order of keys isn't guaranteed. Better to sort keys.
  }, [filteredTransactions]);
  
  // Re-sort chart data chronologically
  const sortedChartData = [...chartData].sort((a,b) => {
      // Simple hack: rely on string comparison if format matches or just rely on the fact that we processed a sorted list? 
      // Let's just process strictly.
      return 0; // Placeholder, assuming chartData simple map is okay for now.
  }).reverse(); // The filteredTransactions is Descending. Iterating it populates the map. Then Object.values order is indeterminate.
  // Proper way:
  const finalChartData = useMemo(() => {
      const map = new Map<string, {name: string, income: number, expense: number}>();
      const txnsAsc = [...filteredTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      txnsAsc.forEach(t => {
          const d = new Date(t.date);
          const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
          const label = d.toLocaleDateString(undefined, { month: 'short' });
          if (!map.has(key)) map.set(key, { name: label, income: 0, expense: 0 });
          const entry = map.get(key)!;
          if (t.type === 'INCOME') entry.income += t.amount;
          else entry.expense += t.amount;
      });
      return Array.from(map.values());
  }, [filteredTransactions]);


  const handleSave = () => {
      if (!formData.amount || !formData.category) return;
      addTransaction({
          ...formData,
          recordedBy: currentUser.name
      });
      setIsModalOpen(false);
      setFormData({
          amount: 0,
          type: 'INCOME',
          category: 'Offering',
          description: '',
          date: new Date().toISOString().split('T')[0],
          churchId: (activeChurch === 'CM' ? 'UJ' : activeChurch)
      });
      onUpdate();
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Delete this transaction?")) {
          deleteTransaction(id);
          onUpdate();
      }
  };

  return (
    <div className="space-y-6">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-3 rounded-xl bg-green-50 text-green-600"><TrendingUp size={20}/></div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Total Income</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">GH₵ {stats.income.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-3 rounded-xl bg-red-50 text-red-600"><TrendingDown size={20}/></div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Total Expenses</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">GH₵ {stats.expense.toLocaleString()}</h3>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg shadow-slate-200 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-3 rounded-xl bg-white/10 text-white"><Wallet size={20}/></div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Net Balance</span>
                </div>
                <h3 className="text-2xl font-bold">GH₵ {stats.balance.toLocaleString()}</h3>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100">
             <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
                 {isAdmin && activeChurch === 'CM' && (
                     <>
                        <span className="text-xs font-bold text-slate-400 uppercase mr-2">Branch:</span>
                        <button onClick={() => setFilterChurch('All')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterChurch === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>All</button>
                        {(['UJ', 'I', 'K', 'LJ'] as Church[]).map(c => (
                            <button key={c} onClick={() => setFilterChurch(c)} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterChurch === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{c}</button>
                        ))}
                        <div className="w-px h-6 bg-slate-200 mx-2"></div>
                     </>
                 )}
                 <button onClick={() => setFilterType('All')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterType === 'All' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-50'}`}>All Types</button>
                 <button onClick={() => setFilterType('INCOME')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterType === 'INCOME' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-50'}`}>Income</button>
                 <button onClick={() => setFilterType('EXPENSE')} className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterType === 'EXPENSE' ? 'bg-red-100 text-red-700' : 'text-slate-500 hover:bg-slate-50'}`}>Expense</button>
             </div>

             <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={18}/> New Record
             </button>
        </div>

        {/* Chart */}
        {finalChartData.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 h-64">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={finalChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
                        <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
                    </BarChart>
                 </ResponsiveContainer>
            </div>
        )}

        {/* Transactions List */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4">Date</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Category</th>
                            <th className="p-4">Description</th>
                            <th className="p-4">Branch</th>
                            <th className="p-4 text-right">Amount</th>
                            <th className="p-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredTransactions.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">No transactions found.</td></tr>
                        ) : (
                            filteredTransactions.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-4 text-slate-600 font-medium">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${t.type === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-800">{t.category}</td>
                                    <td className="p-4 text-slate-500">{t.description || '-'}</td>
                                    <td className="p-4 text-slate-500"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{t.churchId}</span></td>
                                    <td className={`p-4 text-right font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'EXPENSE' ? '-' : '+'}GH₵ {t.amount}
                                    </td>
                                    <td className="p-4">
                                        <button onClick={() => handleDelete(t.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* ADD MODAL */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800">New Transaction</h3>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
                    </div>

                    <div className="space-y-4">
                         {/* Type Toggle */}
                         <div className="flex p-1 bg-slate-100 rounded-xl">
                             <button onClick={() => setFormData({...formData, type: 'INCOME'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === 'INCOME' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500'}`}>Income</button>
                             <button onClick={() => setFormData({...formData, type: 'EXPENSE'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === 'EXPENSE' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500'}`}>Expense</button>
                         </div>

                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                             <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}/>
                         </div>

                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (GH₵)</label>
                             <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}/>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                <select className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                    <option>Offering</option>
                                    <option>Tithe</option>
                                    <option>Donation</option>
                                    <option>Snacks</option>
                                    <option>Materials</option>
                                    <option>Transport</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Branch</label>
                                <select 
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-500" 
                                    value={formData.churchId} 
                                    onChange={e => setFormData({...formData, churchId: e.target.value as Church})}
                                    disabled={!isAdmin && activeChurch !== 'CM'} // If not admin, locked to current church (though teacher role check handles this)
                                >
                                    {(['UJ', 'I', 'K', 'LJ'] as Church[]).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                         </div>

                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (Optional)</label>
                             <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Details..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}/>
                         </div>
                    </div>

                    <button onClick={handleSave} className="w-full mt-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:bg-indigo-700 transition-all active:scale-95">
                        Save Transaction
                    </button>
                </div>
            </div>
        )}

    </div>
  );
};

export default Finances;
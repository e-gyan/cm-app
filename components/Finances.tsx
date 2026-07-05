import React, { useState, useMemo, useEffect } from "react";
import { AppData, Transaction, Church, Member } from "../types";
import { addTransaction, deleteTransaction } from "../services/storageService";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Filter,
  Wallet,
  Calendar,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FinancesProps {
  data: AppData;
  onUpdate: () => void;
  activeChurch: Church;
  currentUser: Member;
}

const formatDateDDMMYYYY = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

const Finances: React.FC<FinancesProps> = ({
  data,
  onUpdate,
  activeChurch,
  currentUser,
}) => {
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "ZONAL_HEAD"].includes(
    currentUser.role || "",
  );
  const availableChurches = data.settings.churches;

  // State
  const [filterChurch, setFilterChurch] = useState<Church | "All">(
    () =>
      (sessionStorage.getItem("finances_churchFilter") as Church | "All") ||
      (isAdmin && activeChurch === "CM"
        ? "All"
        : activeChurch === "CM"
          ? "UJ"
          : activeChurch),
  );
  const [filterType, setFilterType] = useState<"All" | "INCOME" | "EXPENSE">(
    () => (sessionStorage.getItem("finances_typeFilter") as any) || "All",
  );

  // Persist State
  useEffect(() => {
    sessionStorage.setItem("finances_churchFilter", filterChurch);
  }, [filterChurch]);
  useEffect(() => {
    sessionStorage.setItem("finances_typeFilter", filterType);
  }, [filterType]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Transaction>>({
    amount: 0,
    type: "INCOME",
    category: "Offering",
    description: "",
    date: new Date().toISOString().split("T")[0],
    churchId: activeChurch === "CM" ? "UJ" : activeChurch,
  });

  // Derived Data
  const filteredTransactions = useMemo(() => {
    let txns = data.transactions || [];

    // Filter by Church
    if (filterChurch !== "All") {
      txns = txns.filter((t) => t.churchId === filterChurch);
    } else if (!isAdmin) {
      // Safety: If not admin and viewing all, force own church (though logic above handles initial state)
      txns = txns.filter((t) => t.churchId === currentUser.assignedChurch);
    }

    // Filter by Type
    if (filterType !== "All") {
      txns = txns.filter((t) => t.type === filterType);
    }

    // Sort Date Descending
    return txns.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [
    data.transactions,
    filterChurch,
    filterType,
    isAdmin,
    currentUser.assignedChurch,
  ]);

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((t) => {
      if (t.type === "INCOME") income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    const map = new Map<
      string,
      { name: string; income: number; expense: number }
    >();
    const txnsAsc = [...filteredTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    txnsAsc.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { month: "short" });
      if (!map.has(key)) map.set(key, { name: label, income: 0, expense: 0 });
      const entry = map.get(key)!;
      if (t.type === "INCOME") entry.income += t.amount;
      else entry.expense += t.amount;
    });
    return Array.from(map.values());
  }, [filteredTransactions]);

  const handleSave = () => {
    if (!formData.amount || !formData.category) return;
    addTransaction({
      ...formData,
      recordedBy: currentUser.name,
    });
    setIsModalOpen(false);
    setFormData({
      amount: 0,
      type: "INCOME",
      category: "Offering",
      description: "",
      date: new Date().toISOString().split("T")[0],
      churchId: activeChurch === "CM" ? "UJ" : activeChurch,
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
            <div className="p-3 rounded-xl bg-green-50 text-green-600">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase">
              Total Income
            </span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800">
            GH₵ {stats.income.toLocaleString()}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <div className="p-3 rounded-xl bg-red-50 text-red-600">
              <TrendingDown size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase">
              Total Expenses
            </span>
          </div>
          <h3 className="text-2xl font-bold text-slate-800">
            GH₵ {stats.expense.toLocaleString()}
          </h3>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg shadow-slate-200 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <div className="p-3 rounded-xl bg-white/10 text-white">
              <Wallet size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase">
              Net Balance
            </span>
          </div>
          <h3 className="text-2xl font-bold">
            GH₵ {stats.balance.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
          {isAdmin && activeChurch === "CM" && (
            <>
              <span className="text-xs font-bold text-slate-400 uppercase mr-2">
                Branch:
              </span>
              <button
                onClick={() => setFilterChurch("All")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterChurch === "All" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                All
              </button>
              {availableChurches.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterChurch(c)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterChurch === c ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {c}
                </button>
              ))}
              <div className="w-px h-6 bg-slate-200 mx-2"></div>
            </>
          )}
          <button
            onClick={() => setFilterType("All")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterType === "All" ? "bg-slate-200 text-slate-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            All Types
          </button>
          <button
            onClick={() => setFilterType("INCOME")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterType === "INCOME" ? "bg-green-100 text-green-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            Income
          </button>
          <button
            onClick={() => setFilterType("EXPENSE")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${filterType === "EXPENSE" ? "bg-red-100 text-red-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            Expense
          </button>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={18} /> New Record
        </button>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Bar
                dataKey="expense"
                name="Expense"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                New Transaction
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Type
                </label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setFormData({ ...formData, type: "INCOME" })}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${formData.type === "INCOME" ? "bg-white text-green-600 shadow-sm" : "text-slate-500"}`}
                  >
                    Income
                  </button>
                  <button
                    onClick={() =>
                      setFormData({ ...formData, type: "EXPENSE" })
                    }
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${formData.type === "EXPENSE" ? "bg-white text-red-600 shadow-sm" : "text-slate-500"}`}
                  >
                    Expense
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Category
                </label>
                <select
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  {formData.type === "INCOME"
                    ? [
                        "Offering",
                        "Tithe",
                        "Donation",
                        "Fundraising",
                        "Other",
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    : [
                        "Supplies",
                        "Food",
                        "Transport",
                        "Equipment",
                        "Event",
                        "Benevolence",
                        "Other",
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      ₵
                    </span>
                    <input
                      type="number"
                      className="w-full pl-8 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      value={formData.amount || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: parseFloat(e.target.value),
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Description
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional details..."
                />
              </div>

              {isAdmin && activeChurch === "CM" && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Church Branch
                  </label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.churchId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        churchId: e.target.value as Church,
                      })
                    }
                  >
                    {availableChurches.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleSave}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 mt-2"
              >
                Save Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm">
          Recent Transactions ({filteredTransactions.length})
        </div>
        <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No transactions found for this period.
            </div>
          ) : (
            filteredTransactions.map((t) => (
              <div
                key={t.id}
                className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-xl font-bold ${t.type === "INCOME" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
                  >
                    {t.type === "INCOME" ? (
                      <TrendingUp size={18} />
                    ) : (
                      <TrendingDown size={18} />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{t.category}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {formatDateDDMMYYYY(t.date)}
                      </span>
                      <span>•</span>
                      <span>{t.churchId}</span>
                      {t.description && <span>• {t.description}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`font-bold ${t.type === "INCOME" ? "text-green-600" : "text-slate-800"}`}
                  >
                    {t.type === "INCOME" ? "+" : "-"}GH₵{" "}
                    {t.amount.toLocaleString()}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Finances;

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Wallet, Plus, Trash2, Loader2, X } from 'lucide-react';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Operational',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = ['Operational', 'Marketing', 'Inventory', 'Logistics', 'Miscellaneous'];

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        displayDate: d.data().date || new Date().toLocaleDateString()
      })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        ...formData,
        amount: Number(formData.amount),
        createdAt: serverTimestamp()
      });
      setFormData({
        title: '',
        amount: '',
        category: 'Operational',
        date: new Date().toISOString().split('T')[0]
      });
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding expense:", error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this expense?')) {
      await deleteDoc(doc(db, 'expenses', id));
    }
  };

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 size={40} className="animate-spin text-yellow-500 mb-4" />
        <p className="font-black uppercase tracking-widest text-sm">Loading Ledger...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Expense Ledger</h1>
          <p className="text-gray-500 text-sm font-medium">Monitor business overheads and operational costs</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-yellow-500/20 transition-all active:scale-95"
        >
          {isAdding ? <X size={16} /> : <Plus size={16} />}
          {isAdding ? 'Close Entry' : 'New Entry'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-6">
          <div className="bg-gray-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-yellow-900/20">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <Wallet className="text-red-500" size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Total Burn</p>
                <p className="text-2xl font-black text-white">Rs.{totalExpense.toLocaleString()}</p>
              </div>
            </div>

            {isAdding && (
              <form onSubmit={handleSubmit} className="space-y-6 animate-slideIn">
                <div className="space-y-2">
                  <label htmlFor="expense-title" className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Expense Title</label>
                  <input
                    id="expense-title"
                    name="title"
                    type="text"
                    required
                    placeholder="e.g. Server Hosting"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-black/50 border border-yellow-900/20 rounded-xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="expense-amount" className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount</label>
                    <input
                      id="expense-amount"
                      name="amount"
                      type="number"
                      required
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full bg-black/50 border border-yellow-900/20 rounded-xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="expense-category" className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
                    <select
                      id="expense-category"
                      name="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-black/50 border border-yellow-900/20 rounded-xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all appearance-none"
                    >
                      {categories.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="expense-date" className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Date</label>
                  <input
                    id="expense-date"
                    name="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-black/50 border border-yellow-900/20 rounded-xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-yellow-500 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-yellow-500/20 active:scale-95 transition-all"
                >
                  Record Expense
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-[2.5rem] border border-yellow-900/20 overflow-hidden">
            <div className="px-8 py-6 border-b border-yellow-900/10 flex justify-between items-center bg-slate-950/30">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Recent Transactions</h2>
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950/50 text-gray-500 text-[10px] uppercase tracking-[0.2em] border-b border-yellow-900/10">
                    <th className="px-8 py-4 font-black">Details</th>
                    <th className="px-8 py-4 font-black">Category</th>
                    <th className="px-8 py-4 font-black text-right">Amount</th>
                    <th className="px-8 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-900/10">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-8 py-20 text-center text-gray-500 font-medium italic">
                        No expenses recorded yet
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-950/30 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-sm">{expense.title}</span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{expense.displayDate}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/5 border border-yellow-500/20 text-yellow-500">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="font-black text-white">Rs.{expense.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden divide-y divide-yellow-900/10">
              {expenses.length === 0 ? (
                <div className="px-6 py-20 text-center text-gray-500 font-medium italic">
                  No expenses recorded yet
                </div>
              ) : (
                expenses.map((expense) => (
                  <div key={expense.id} className="p-6 flex flex-col gap-4 hover:bg-slate-950/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-white text-sm">{expense.title}</span>
                        <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-tight mt-1">{expense.displayDate}</span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/5 border border-yellow-500/20 text-yellow-500">
                        {expense.category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Amount</p>
                        <span className="font-black text-white text-base">Rs.{expense.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Actions</p>
                        <button
                          type="button"
                          onClick={() => handleDelete(expense.id)}
                          className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl border border-yellow-900/10 transition-all ml-auto"
                          title="Delete expense"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
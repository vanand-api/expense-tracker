import React, { useEffect, useMemo, useState } from 'react'
import { Pie, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  TimeSeriesScale,
} from 'chart.js'
import { getAllExpenses, addExpense, deleteExpense, updateExpense } from './api'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, TimeSeriesScale)

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value)
}

function formatDate(dateString) {
  /*const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })*/

    const [year, month, day] = dateString.split('-')
  const date = new Date(year, month - 1, day) // local date, no timezone shift

  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

function App() {
  const [expenses, setExpenses] = useState([])
  const [filter, setFilter] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showMobileForm, setShowMobileForm] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load expenses from backend on component mount
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true)
        const response = await getAllExpenses()
        //console.log(response.data)
        // Map backend data to frontend format with validation
        const mappedExpenses = response.data
          .filter(expense => expense && expense.id) // Filter out invalid expenses
          .map(expense => ({
            id: expense.id,
            title: expense.title || 'Untitled',
            category: expense.category || 'General',
            amount: Number(expense.amount) || 0,
            date: expense.expenseDate ? expense.expenseDate.split('T')[0] : new Date().toISOString().slice(0, 10),
            timestamp: expense.timestamp || expense.timeStamp || expense.expenseDate || new Date().toISOString(), // Use backend timestamp field
            note: expense.note || ''
          }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by timestamp descending (most recent first)
        //console.log('Mapped expenses:', mappedExpenses)
        setExpenses(mappedExpenses)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch expenses:', err)
        setError('Failed to load expenses. Please check if the backend is running.')
        setExpenses([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchExpenses()
  }, [])

  const filteredExpenses = useMemo(() => {
    const q = filter.trim().toLowerCase()
    let filtered = expenses
    
    //console.log('All expenses:', expenses)
    //console.log('Selected month:', selectedMonth)
    
    // Filter by selected month using expenseDate
    if (selectedMonth) {
      filtered = filtered.filter(e => {
        if (!e.date) return false
        const d = new Date(e.date)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const monthKey = `${year}-${month}`
        //console.log(`Expense ${e.title} date: ${e.date}, monthKey: ${monthKey}, selectedMonth: ${selectedMonth}`)
        return monthKey === selectedMonth
      })
    }
    
    // Filter by search query
    if (q) {
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.note.toLowerCase().includes(q)
      )
    }
    
//    console.log('Filtered expenses:', filtered)
    return filtered
  }, [filter, expenses, selectedMonth])

  const total = useMemo(() => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0), [filteredExpenses])

  // Get available months for dropdown using expenseDate
  const availableMonths = useMemo(() => {
    const months = new Set()
    for (const e of expenses) {
      if (e.date) {
        const d = new Date(e.date)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        months.add(`${year}-${month}`)
      }
    }
    return Array.from(months).sort().reverse()
  }, [expenses])




  // Aggregations for charts
  const categoryAgg = useMemo(() => {
    const map = new Map()
    for (const e of filteredExpenses) {
      const key = (e.category || 'General').trim() || 'General'
      map.set(key, (map.get(key) || 0) + Number(e.amount || 0))
    }
    const labels = Array.from(map.keys())
    const data = Array.from(map.values())
    return { labels, data }
  }, [filteredExpenses])

  const byDateAgg = useMemo(() => {
    const map = new Map()
    for (const e of filteredExpenses) {
      const d = e.date || new Date().toISOString().slice(0, 10)
      map.set(d, (map.get(d) || 0) + Number(e.amount || 0))
    }
    const labels = Array.from(map.keys()).sort()
    const data = labels.map(l => map.get(l))
    return { labels, data }
  }, [filteredExpenses])

  const pieData = useMemo(() => ({
    labels: categoryAgg.labels,
    datasets: [
      {
        data: categoryAgg.data,
        backgroundColor: ['#0ea5e9', '#22c55e', '#f97316', '#a78bfa', '#ef4444', '#14b8a6', '#f59e0b'],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  }), [categoryAgg])

  const pieOptions = useMemo(() => ({
    plugins: { 
      legend: { 
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 10,
          font: { size: 11 }
        }
      } 
    },
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 10
    }
  }), [])

  const barData = useMemo(() => ({
    labels: byDateAgg.labels,
    datasets: [
      {
        label: 'Amount',
        data: byDateAgg.data,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderRadius: 8,
      },
    ],
  }), [byDateAgg])

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        titleFont: { size: 12 },
        bodyFont: { size: 11 }
      }
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { 
          font: { size: 10 },
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: { 
        grid: { color: 'rgba(148,163,184,0.2)' },
        ticks: { font: { size: 10 } }
      },
    },
    layout: {
      padding: 10
    }
  }), [])

  function handleAdd(newExpense) {
    const addExpenseToBackend = async () => {
      try {
        // Prepare the data to send to backend
        const dataToSend = {
          title: newExpense.title,
          category: newExpense.category,
          amount: newExpense.amount,
          note: newExpense.note,
          expenseDate: newExpense.date // Send date as expenseDate to match backend DTO
        }
        //console.log('Sending to backend:', dataToSend)
        
        const response = await addExpense(dataToSend)
        //console.log('Add expense response:', response.data)
        //console.log('Backend timestamp:', response.data?.timestamp)
        //console.log('Backend timeStamp:', response.data?.timeStamp)
        //console.log('Using timestamp:', response.data.timestamp || response.data.timeStamp || new Date().toISOString())
        
        // If backend returns the expense data, use it; otherwise refetch all expenses
        if (response.data && typeof response.data === 'object' && (response.data.id || response.data.expenseId)) {
          // Response contains the expense object
          const mappedExpense = {
            id: response.data.id || response.data.expenseId,
            title: response.data.title || newExpense.title,
            category: response.data.category || newExpense.category,
            amount: Number(response.data.amount) || newExpense.amount,
            date: response.data.expenseDate ? response.data.expenseDate.split('T')[0] : newExpense.date,
            timestamp: response.data.timestamp || response.data.timeStamp || new Date().toISOString(), // Use backend timestamp field
            note: response.data.note || newExpense.note
          }
          //console.log('Mapped expense:', mappedExpense)
          setExpenses(prev => {
            const updated = [mappedExpense, ...prev]
            const sorted = updated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by timestamp descending
            console.log('Sorted expenses after add:', sorted.map(e => ({ title: e.title, timestamp: e.timestamp })))
            return sorted
          })
        } else {
          // Backend didn't return expense data, refetch all expenses to get the correct IDs
          console.log('Backend response doesn\'t contain expense data, refetching all expenses...')
          const allExpensesResponse = await getAllExpenses()
          const mappedExpenses = allExpensesResponse.data
            .filter(expense => expense && expense.id)
            .map(expense => ({
              id: expense.id,
              title: expense.title || 'Untitled',
              category: expense.category || 'General',
              amount: Number(expense.amount) || 0,
              date: expense.expenseDate ? expense.expenseDate.split('T')[0] : new Date().toISOString().slice(0, 10),
              timestamp: expense.timestamp || expense.timeStamp || expense.expenseDate || new Date().toISOString(), // Use backend timestamp field
              note: expense.note || ''
            }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Sort by timestamp descending (most recent first)
          setExpenses(mappedExpenses)
        }
        setError(null)
      } catch (err) {
        console.error('Failed to add expense:', err)
        setError('Failed to add expense. Please try again.')
      }
    }
    addExpenseToBackend()
  }

  function handleUpdate(id, updated) {
    const updateExpenseInBackend = async () => {
      try {
        // Prepare the data to send to backend
        const dataToSend = {
          id: parseInt(id), // Ensure ID is an integer
          title: updated.title,
          category: updated.category,
          amount: updated.amount,
          note: updated.note,
          expenseDate: updated.date // Send date as expenseDate to match backend DTO
        }
        //console.log('Sending to backend:', dataToSend)
        
        const response = await updateExpense(id, dataToSend)
        //console.log('Update response:', response.data)
        
        // Check if response.data is the actual expense object or just a success message
        let mappedExpense
        if (response.data && typeof response.data === 'object' && response.data.id) {
          // Response contains the updated expense object
          mappedExpense = {
            id: response.data.id,
            title: response.data.title || updated.title,
            category: response.data.category || updated.category,
            amount: Number(response.data.amount) || updated.amount,
            date: response.data.expenseDate ? response.data.expenseDate.split('T')[0] : updated.date,
            timestamp: response.data.timestamp || response.data.timeStamp || response.data.expenseDate || new Date().toISOString(), // Use backend timestamp field
            note: response.data.note || updated.note
          }
        } else {
          // Response is just a success message, use the updated data we sent
          mappedExpense = {
            id: id,
            title: updated.title,
            category: updated.category,
            amount: updated.amount,
            date: updated.date,
            timestamp: new Date().toISOString(), // Use current time for updated expense
            note: updated.note
          }
        }
        
        setExpenses(prev => {
          const updated = prev.map(e => (e.id === id ? mappedExpense : e))
          return updated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Maintain sort order
        })
        setEditingId(null)
        setError(null)
      } catch (err) {
        console.error('Failed to update expense:', err)
        console.error('Error response:', err.response?.data)
        console.error('Error status:', err.response?.status)
        setError(`Failed to update expense: ${err.response?.data || err.message}`)
      }
    }
    updateExpenseInBackend()
  }

  function handleDelete(id) {
    const deleteExpenseFromBackend = async () => {
      try {
        await deleteExpense(id)
        setExpenses(prev => prev.filter(e => e.id !== id))
        setError(null)
      } catch (err) {
        console.error('Failed to delete expense:', err)
        setError('Failed to delete expense. Please try again.')
      }
    }
    deleteExpenseFromBackend()
  }

  return (
    <div className="min-h-screen">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-auto max-w-6xl">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-content-center">$
            </div>
            <div>
              <h1 className="text-lg font-semibold">Expense Trackers</h1>
              <p className="text-xs text-slate-500">Track, filter, and edit your spending</p>
            </div>
          </div>
        </div>
      </header>

      {/* Month Filter */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex justify-end">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5" />
              </svg>
              <span className="text-sm text-slate-600">Filter by month:</span>
              <select
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent transition-colors"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {availableMonths.map(month => {
                  const [year, monthNum] = month.split('-')
                  const date = new Date(year, monthNum - 1)
                  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  return (
                    <option key={month} value={month}>
                      {monthName}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6 md:grid-cols-3">
        {/* Mobile: collapsed add form trigger */}
        <section className="md:hidden">
          {!showMobileForm ? (
            <button
              className="card w-full p-4 btn btn-ghost justify-start"
              onClick={() => setShowMobileForm(true)}
              aria-label="Add Expense"
              title="Add Expense"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              <span className="ml-2">Add Expense</span>
            </button>
          ) : (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Add Expense</h2>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowMobileForm(false)}
                  aria-label="Collapse"
                  title="Collapse"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5" />
                  </svg>
                </button>
              </div>
              <ExpenseForm onSubmit={(e) => { handleAdd(e); setShowMobileForm(false) }} />
            </div>
          )}
        </section>

        {/* Desktop/tablet: always show add form */}
        <section className="hidden md:block md:col-span-1 card p-4">
          <h2 className="text-base font-semibold mb-4">Add Expense</h2>
          <ExpenseForm onSubmit={handleAdd} />
        </section>

        <section className="md:col-span-2 space-y-4">
          <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              className="input"
              placeholder="Search by title, category, or note"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-600">Total</div>
              <div className="text-base font-semibold">{formatCurrency(total)}</div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
            {loading ? (
              <div className="card p-6 text-center text-slate-600">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                  Loading expenses...
                </div>
              </div>
            ) : (
              <>
                {filteredExpenses.map((expense, index) => (
                  <ExpenseRow
                    key={expense.id || `expense-${index}`}
                    expense={expense}
                    isEditing={editingId === expense.id}
                    onEdit={() => setEditingId(expense.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={updates => handleUpdate(expense.id, updates)}
                    onDelete={() => handleDelete(expense.id)}
                  />
                ))}
                {filteredExpenses.length === 0 && (
                  <div className="card p-6 text-center text-slate-600">No expenses found.</div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Dashboard */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="card p-4 w-full overflow-hidden">
            <h3 className="text-sm font-semibold mb-4">Spending by Category</h3>
            <div className="h-72 w-full">
              <Pie data={pieData} options={pieOptions} />
            </div>
          </div>
          <div className="card p-4 w-full overflow-hidden">
            <h3 className="text-sm font-semibold mb-4">Spending Over Time</h3>
            <div className="h-72 w-full">
              <Bar data={barData} options={barOptions} />
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-slate-500">
        © All Copyrights Reserved
      </footer>
    </div>
  )
}

function ExpenseForm({ onSubmit, initial }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [category, setCategory] = useState(initial?.category || '')
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState(initial?.note || '')

  const commonCategories = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Education', 'Travel', 'Other']

  function handleSubmit(e) {
    e.preventDefault()
    const amt = Number(amount)
    if (!title || isNaN(amt) || amt <= 0) return
    onSubmit({ title, category: category || 'General', amount: amt, date, note })
    setTitle('')
    setCategory('')
    setAmount('')
    setDate(new Date().toISOString().slice(0, 10))
    setNote('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label">Title</label>
        <input className="input mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Groceries" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <select 
            className="input mt-1" 
            value={category} 
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">Select category</option>
            {commonCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Amount</label>
          <input type="number" step="0.01" className="input mt-1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input mt-1" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Note</label>
          <input className="input mt-1" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="pt-2">
        <button type="submit" className="btn btn-primary w-full">Add Expense</button>
      </div>
    </form>
  )
}

function ExpenseRow({ expense, isEditing, onEdit, onCancelEdit, onSave, onDelete }) {
  const [form, setForm] = useState({ ...expense })
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => setForm({ ...expense }), [expense])

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    const amt = Number(form.amount)
    if (!form.title || isNaN(amt) || amt <= 0) return
    onSave({ title: form.title, category: form.category, amount: amt, date: form.date, note: form.note })
  }

  return (
    <div className="card p-4">
      {!isEditing ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold truncate">{expense.title}</div>
              <div className="mt-0.5 text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{formatDate(expense.date)}</span>
                <span className="text-slate-300">•</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs">{expense.category}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-base font-semibold tabular-nums">{formatCurrency(expense.amount)}</div>
              <button
                className="btn btn-ghost"
                onClick={onEdit}
                aria-label="Edit"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.126 2.126 0 1 1 3.006 3.006L8.75 18.61l-4.5 1.125 1.125-4.5 11.487-10.748z" />
                </svg>
              </button>
              <button
                className="btn btn-ghost text-red-600 hover:bg-red-50"
                onClick={onDelete}
                aria-label="Delete"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowNotes(s => !s)}
                aria-expanded={showNotes}
                aria-controls={`note-${expense.id}`}
                aria-label={showNotes ? 'Hide notes' : 'Show notes'}
                title={showNotes ? 'Hide notes' : 'Show notes'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-5 w-5 transition-transform ${showNotes ? 'rotate-180' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>

          {expense.note && showNotes && (
            <div id={`note-${expense.id}`} className="mt-1 text-sm text-slate-600">{expense.note}</div>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input className="input md:col-span-2" value={form.title} onChange={e => handleChange('title', e.target.value)} />
            <select className="input" value={form.category} onChange={e => handleChange('category', e.target.value)}>
              <option value="">Select category</option>
              {['Food', 'Skincare', 'Gym', 'Rent', 'Mobile Bill','Family','Movies', 'Shopping', 'Travel', 'Healthcare', 'Education', 'Entertainment', 'Other'].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input type="number" step="0.01" className="input" value={form.amount} onChange={e => handleChange('amount', e.target.value)} />
            <input type="date" className="input" value={form.date} onChange={e => handleChange('date', e.target.value)} />
          </div>
          <input className="input" value={form.note} onChange={e => handleChange('note', e.target.value)} placeholder="Note" />
          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-ghost" onClick={onCancelEdit}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App



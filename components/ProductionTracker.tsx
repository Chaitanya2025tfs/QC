
import React, { useState, useMemo } from 'react';
import { User, UserRole, ProductionRecord } from '../types';
import { getProductionRecords, saveProductionRecord, deleteProductionRecord, getUsers } from '../store';
import { TRACKER_PROJECTS } from '../constants.tsx';

interface ProductionTrackerProps {
  user: User;
}

const ProductionTracker: React.FC<ProductionTrackerProps> = ({ user }) => {
  const allUsers = getUsers();
  const [records, setRecords] = useState<ProductionRecord[]>(getProductionRecords());
  // Selected date for the drill-down view
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [selectedAgentId, setSelectedAgentId] = useState<string>(user.id);
  
  const selectedAgentObj = useMemo(() => 
    allUsers.find(u => u.id === selectedAgentId) || user, 
  [allUsers, selectedAgentId, user]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    projectName: TRACKER_PROJECTS[0].name,
    target: TRACKER_PROJECTS[0].target,
    production: 0
  });

  const today = new Date().toISOString().split('T')[0];
  const isPowerUser = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;

  const canModify = (recordDate: string) => {
    const isToday = recordDate === today;
    return isToday || isPowerUser;
  };

  const handleProjectChange = (name: string) => {
    const proj = TRACKER_PROJECTS.find(p => p.name === name);
    setFormData({
      ...formData,
      projectName: name,
      target: proj ? proj.target : 0
    });
  };

  const handleLogEntry = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.production < 0) {
      alert("Production cannot be negative.");
      return;
    }

    const maxAllowed = formData.target * 2;
    if (formData.target > 0 && formData.production > maxAllowed) {
      alert(`Validation Error: Production count (${formData.production}) cannot exceed double the target (${maxAllowed}).`);
      return;
    }

    if (editingId) {
      const existing = records.find(r => r.id === editingId);
      if (existing && !canModify(existing.date)) {
        alert("You do not have permission to edit records from previous days.");
        return;
      }
    }

    const newRecord: ProductionRecord = {
      id: editingId || Math.random().toString(36).substr(2, 9),
      userId: selectedAgentId,
      userName: selectedAgentObj.name,
      date: formData.date,
      projectName: formData.projectName,
      target: formData.target,
      actualCount: formData.production,
      createdAt: editingId ? (records.find(r => r.id === editingId)?.createdAt || Date.now()) : Date.now()
    };

    saveProductionRecord(newRecord);
    setRecords(getProductionRecords());
    setSelectedDate(formData.date);
    
    setFormData({
      date: today,
      projectName: TRACKER_PROJECTS[0].name,
      target: TRACKER_PROJECTS[0].target,
      production: 0
    });
    setEditingId(null);
  };

  const handleEditInit = (record: ProductionRecord) => {
    if (!canModify(record.date)) {
      alert("Only Admins and Managers can edit records from previous days.");
      return;
    }
    setEditingId(record.id);
    setFormData({
      date: record.date,
      projectName: record.projectName,
      target: record.target,
      production: record.actualCount
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      date: today,
      projectName: TRACKER_PROJECTS[0].name,
      target: TRACKER_PROJECTS[0].target,
      production: 0
    });
  };

  const handleDeleteEntry = (record: ProductionRecord) => {
    if (!canModify(record.date)) {
      alert("Only Admins and Managers can delete records from previous days.");
      return;
    }
    
    if (confirm("Permanently delete this specific log entry?")) {
      deleteProductionRecord(record.id);
      setRecords(getProductionRecords());
      if (editingId === record.id) cancelEdit();
    }
  };

  // Grouped Summary Data - Grouped strictly by DATE
  const dailySummary = useMemo(() => {
    const userRecords = records.filter(r => r.userId === selectedAgentId);
    const groups: Record<string, { date: string, totalTarget: number, totalActual: number, entryCount: number, sumQuotient: number }> = {};
    
    userRecords.forEach(r => {
      const key = r.date;
      if (!groups[key]) {
        groups[key] = { date: r.date, totalTarget: 0, totalActual: 0, entryCount: 0, sumQuotient: 0 };
      }
      groups[key].totalTarget += r.target;
      groups[key].totalActual += r.actualCount;
      groups[key].entryCount += 1;
      
      const q = r.target > 0 ? r.actualCount / r.target : 0;
      groups[key].sumQuotient += q;
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, selectedAgentId]);

  // Breakdown for the selected date
  const selectedBreakdown = useMemo(() => {
    if (!selectedDate) return [];
    return records
      .filter(r => r.userId === selectedAgentId && r.date === selectedDate)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [records, selectedDate, selectedAgentId]);

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-3xl text-white shadow-2xl shadow-indigo-200">
            <i className="bi bi-rocket-takeoff-fill"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Production Tracker</h2>
            <p className="text-slate-500 font-medium">Viewing performance for <span className="text-indigo-600 font-bold">{selectedAgentObj.name}</span></p>
          </div>
        </div>

        {/* Admin/Manager Agent Selection */}
        {isPowerUser && (
          <div className="flex flex-col gap-2 min-w-[240px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Switch Agent View</label>
            <div className="relative">
              <select 
                value={selectedAgentId}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value);
                  setEditingId(null);
                  setSelectedDate(null);
                }}
                className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer pr-10"
              >
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
                ))}
              </select>
              <i className="bi bi-person-lines-fill absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
        {/* Entry Form */}
        <div className="xl:col-span-4 space-y-6">
          <div className={`p-8 rounded-[2.5rem] shadow-sm border sticky top-8 transition-all ${editingId ? 'bg-amber-50 border-amber-200 ring-4 ring-amber-100' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <i className={`bi ${editingId ? 'bi-pencil-fill text-amber-600' : 'bi-pencil-square text-indigo-600'}`}></i> 
                {editingId ? 'Edit Entry' : 'Add New Log'}
              </h3>
              {editingId && (
                <span className="text-[10px] font-black bg-amber-200 text-amber-800 px-2 py-1 rounded uppercase">Editing Mode</span>
              )}
            </div>
            
            <form onSubmit={handleLogEntry} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Date</label>
                <input 
                  type="date" 
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})} 
                  className={`w-full px-5 py-4 rounded-2xl outline-none font-bold text-slate-700 transition-all border ${editingId ? 'bg-white border-amber-300' : 'bg-slate-50 border-slate-200 focus:ring-4 focus:ring-indigo-50'}`} 
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Name</label>
                <div className="relative">
                  <select 
                    value={formData.projectName} 
                    onChange={e => handleProjectChange(e.target.value)}
                    className={`w-full px-5 py-4 rounded-2xl outline-none font-bold text-slate-700 appearance-none cursor-pointer pr-12 transition-all border ${editingId ? 'bg-white border-amber-300' : 'bg-slate-50 border-slate-200 focus:ring-4 focus:ring-indigo-50'}`}
                    required
                  >
                    {TRACKER_PROJECTS.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <i className="bi bi-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Daily Target</label>
                  <input 
                    type="number" 
                    value={formData.target} 
                    onChange={e => setFormData({...formData, target: parseInt(e.target.value) || 0})}
                    className={`w-full px-5 py-4 rounded-2xl outline-none font-black text-center border ${editingId ? 'bg-white border-amber-300' : 'bg-slate-100 border-slate-200 text-slate-500'}`} 
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${editingId ? 'text-amber-600' : 'text-indigo-600'}`}>Actual Count</label>
                  <input 
                    type="number" 
                    value={formData.production === 0 ? '' : formData.production} 
                    onChange={e => setFormData({...formData, production: parseInt(e.target.value) || 0})}
                    placeholder="0"
                    className={`w-full px-5 py-4 rounded-2xl outline-none font-black shadow-sm text-center text-lg transition-all border-2 ${editingId ? 'bg-white border-amber-500 text-amber-700' : 'bg-white border-indigo-600 text-indigo-700 focus:border-indigo-800'}`} 
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <button 
                  type="submit"
                  className={`w-full font-black py-5 rounded-[2rem] shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 ${editingId ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-100' : 'bg-slate-900 hover:bg-black text-white shadow-slate-200'}`}
                >
                  <i className={`bi ${editingId ? 'bi-check2-circle text-xl' : 'bi-plus-circle-fill text-xl'}`}></i>
                  {editingId ? 'Apply Update' : 'Save Log Entry'}
                </button>
                {editingId && (
                  <button 
                    type="button" 
                    onClick={cancelEdit}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-black py-4 rounded-[2rem] transition-all"
                  >
                    Discard Edits
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Tables Section */}
        <div className="xl:col-span-8 space-y-10">
          {/* DATE-WISE SUMMARY TABLE */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Aggregate Daily Summary</h3>
              <div className="flex items-center gap-2">
                <i className="bi bi-info-circle text-indigo-400 text-xs"></i>
                <span className="text-[10px] font-bold text-slate-400">Select a date to view all logs</span>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left table-fixed">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-5 w-[150px]">Date</th>
                    <th className="px-6 py-5 text-center w-[120px]">Entry Logs</th>
                    <th className="px-6 py-5 text-center w-[120px]">Quotient</th>
                    <th className="px-6 py-5 text-right w-[150px]">Daily Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailySummary.map((summary) => {
                    const isSelected = selectedDate === summary.date;
                    const accuracy = summary.totalTarget > 0 
                      ? (summary.totalActual / summary.totalTarget * 100).toFixed(0) 
                      : (summary.totalActual > 0 ? '100+' : '0');

                    return (
                      <tr 
                        key={summary.date} 
                        onClick={() => setSelectedDate(isSelected ? null : summary.date)}
                        className={`cursor-pointer transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-50 group'}`}
                      >
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className={`font-black text-sm tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{summary.date}</span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {summary.entryCount} Logs
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`text-sm font-black ${isSelected ? 'text-white' : 'text-indigo-600'}`}>
                            {summary.sumQuotient.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className={`text-sm font-black ${isSelected ? 'text-white' : (Number(accuracy) >= 100 ? 'text-emerald-600' : 'text-rose-500')}`}>
                            {accuracy}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {dailySummary.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-slate-400 italic font-medium">
                        No records found for this user.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DAILY DRILL-DOWN LOGS */}
          {selectedDate && (
            <div className="bg-white rounded-[1.5rem] shadow-2xl border-2 border-indigo-600 overflow-hidden scale-in">
              {/* HEADER */}
              <div className="bg-indigo-600 px-6 py-3 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <i className="bi bi-calendar-day-fill text-base"></i>
                  <h4 className="font-black text-[11px] uppercase tracking-widest">
                    Individual Logs for: {selectedDate}
                  </h4>
                </div>
                <button 
                  onClick={() => setSelectedDate(null)} 
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white"
                >
                  <i className="bi bi-x-lg text-sm"></i>
                </button>
              </div>
              
              {/* TOTAL SUMS FOR THE DAY */}
              <div className="p-4 px-6 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Aggregate Daily Totals</span>
                    <span className="text-[9px] font-bold text-slate-400 italic">{selectedBreakdown.length} logs recorded</span>
                 </div>
                 <div className="flex gap-10">
                    <div className="text-center">
                       <div className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Total Target</div>
                       <div className="text-base font-black text-slate-900 tracking-tight">{selectedBreakdown.reduce((a, b) => a + b.target, 0)}</div>
                    </div>
                    <div className="text-center">
                       <div className="text-[9px] font-black text-indigo-400 uppercase mb-0.5">Total Production</div>
                       <div className="text-base font-black text-indigo-600 tracking-tight">{selectedBreakdown.reduce((a, b) => a + b.actualCount, 0)}</div>
                    </div>
                    <div className="text-center">
                       <div className="text-[9px] font-black text-emerald-600 uppercase mb-0.5">Quotient Sum</div>
                       <div className="text-base font-black text-emerald-600 tracking-tight">
                        {selectedBreakdown.reduce((acc, row) => acc + (row.target > 0 ? row.actualCount / row.target : 0), 0).toFixed(2)}
                       </div>
                    </div>
                 </div>
              </div>

              {/* EVERY LOG OF THAT DAY */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left table-auto">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50">
                      <th className="px-6 py-3 whitespace-nowrap">Time</th>
                      <th className="px-6 py-3 whitespace-nowrap">Project Name</th>
                      <th className="px-6 py-3 text-center whitespace-nowrap">Target</th>
                      <th className="px-6 py-3 text-center whitespace-nowrap">Production</th>
                      <th className="px-6 py-3 text-center whitespace-nowrap">Quotient</th>
                      <th className="px-6 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBreakdown.map((row) => {
                      const rowQuotient = row.target > 0 ? (row.actualCount / row.target).toFixed(2) : '0.00';
                      const editable = canModify(row.date);
                      return (
                        <tr key={row.id} className={`hover:bg-indigo-50/30 group transition-all ${editingId === row.id ? 'bg-amber-50' : ''}`}>
                          <td className="px-6 py-2.5 text-[9px] font-black text-slate-400 italic whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-2.5 whitespace-nowrap">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{row.projectName}</span>
                          </td>
                          <td className="px-6 py-2.5 text-center text-[10px] font-bold text-slate-500 whitespace-nowrap">{row.target}</td>
                          <td className="px-6 py-2.5 text-center font-black text-indigo-700 text-xs whitespace-nowrap">{row.actualCount}</td>
                          <td className="px-6 py-2.5 text-center whitespace-nowrap">
                            <span className="text-[11px] font-black text-indigo-600">
                              {rowQuotient}
                            </span>
                          </td>
                          <td className="px-6 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {editable ? (
                                <>
                                  <button 
                                    onClick={() => handleEditInit(row)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
                                    title="Edit Log"
                                  >
                                    <i className="bi bi-pencil-square text-xs"></i>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteEntry(row)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-all"
                                    title="Delete Log"
                                  >
                                    <i className="bi bi-trash3-fill text-xs"></i>
                                  </button>
                                </>
                              ) : (
                                <i className="bi bi-lock-fill text-slate-300 text-[10px]" title="Locked (Past Record)"></i>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionTracker;


import React, { useState, useMemo } from 'react';
import { User, UserRole, QCRecord } from '../types';
import { getRecords, deleteRecord, getUsers } from '../store';
import { QC_ERRORS, PROJECTS } from '../constants.tsx';

interface DisplayRecord extends QCRecord {
  _displayType: 'Regular' | 'Rework';
  _displayScore: string | number;
  _isReworkRow: boolean;
}

interface ReportTableProps {
  user: User;
  onEdit: (id: string) => void;
}

const ReportTable: React.FC<ReportTableProps> = ({ user, onEdit }) => {
  const [records, setRecords] = useState<QCRecord[]>(getRecords());
  const allUsers = getUsers();
  
  // States for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');
  const [dateRange, setDateRange] = useState({ 
    start: '', 
    end: '' 
  });
  
  const [viewingRecord, setViewingRecord] = useState<DisplayRecord | null>(null);

  // Get unique list of agents who have records or are in the system
  const agentsList = useMemo(() => {
    const agentsFromUsers = allUsers.filter(u => u.role === UserRole.AGENT).map(u => u.name);
    const agentsFromRecords = Array.from(new Set(records.map(r => r.agentName)));
    return Array.from(new Set([...agentsFromUsers, ...agentsFromRecords])).sort();
  }, [allUsers, records]);

  const displayData = useMemo(() => {
    const filtered = records.filter(r => {
      // Permission check
      if (user.role === UserRole.AGENT && r.agentName !== user.name) return false;
      
      // Text search
      const matchesSearch = r.agentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            r.taskName.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Project filter
      const matchesProject = projectFilter === 'All' || r.projectName === projectFilter;
      
      // Agent filter
      const matchesAgent = agentFilter === 'All' || r.agentName === agentFilter;
      
      // Date range filter
      const matchesDateStart = !dateRange.start || r.date >= dateRange.start;
      const matchesDateEnd = !dateRange.end || r.date <= dateRange.end;

      return matchesSearch && matchesProject && matchesAgent && matchesDateStart && matchesDateEnd;
    }).sort((a, b) => b.createdAt - a.createdAt);

    const flatList: DisplayRecord[] = [];
    filtered.forEach(record => {
      flatList.push({
        ...record,
        _displayType: 'Regular',
        _displayScore: record.noWork ? 'N/A' : (record.originalScore ?? record.avgScore),
        _isReworkRow: false
      });

      if (record.reworkStatus) {
        flatList.push({
          ...record,
          _displayType: 'Rework',
          _displayScore: record.avgScore,
          _isReworkRow: true
        });
      }
    });

    return flatList;
  }, [records, searchTerm, projectFilter, agentFilter, dateRange, user]);

  const handleDelete = (id: string) => {
    if (window.confirm("CRITICAL: Delete this audit record?")) {
      deleteRecord(id);
      setRecords(getRecords());
    }
  };

  const handleDownloadSingleRecord = (r: DisplayRecord) => {
    const headers = ["Field", "Value"];
    const rows = [
      ["Audit Type", r._displayType],
      ["Date", r.date],
      ["Time Slot", r.timeSlot],
      ["Agent Name", r.agentName],
      ["Project", r.projectName],
      ["Task/File Name", r.taskName],
      ["QC Checker", r.qcCheckerName],
      ["Manager/Lead", r.managerName],
      ["Audit Score", `${r._displayScore}%`],
      ["Global Notes", r.notes.replace(/,/g, ";")],
      ["", ""],
      ["Sampling Data", ""],
      ["QC Code", "Errors Found", "Score"]
    ];

    if (!r.noWork) {
      r.subSamples.forEach(s => {
        const errorsStr = s.errors.map(id => QC_ERRORS.find(e => e.id === id)?.name).join("; ");
        rows.push([s.qcCode, errorsStr || "None", s.score.toString()]);
      });
      if (r.manualScore !== null && r.manualScore !== undefined) {
        const manualErrorsStr = r.manualErrors?.map(id => QC_ERRORS.find(e => e.id === id)?.name).join("; ") || "None";
        rows.push(["Manual Entry", manualErrorsStr, r.manualScore.toString()]);
        rows.push(["Manual Notes", r.manualNotes?.replace(/,/g, ";") || "None", ""]);
      }
    } else {
      rows.push(["No Work Output Recorded", "", ""]);
    }

    const csvContent = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `QC_Report_${r._displayType}_${r.agentName}_${r.date}.csv`;
    link.click();
  };

  const handleDownloadExcel = () => {
    const headers = ["Type", "Date", "Time Slot", "Agent", "Project", "Task", "QC Score", "QC Checker"];
    const csvContent = [headers.join(","), ...displayData.map(r => [
      r._displayType,
      r.date, 
      r.timeSlot,
      r.agentName, 
      r.projectName, 
      `"${r.taskName}"`,
      r._displayScore,
      r.qcCheckerName
    ].join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `QC_Daily_Audit_Report_${Date.now()}.csv`;
    link.click();
  };

  const canDelete = user.role === UserRole.MANAGER || user.role === UserRole.ADMIN;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-slate-900">Audit Repository</h2>
        {(user.role === UserRole.MANAGER || user.role === UserRole.ADMIN) && (
          <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-emerald-600 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700">
            <i className="bi bi-file-earmark-spreadsheet"></i> Export Filtered Report
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <i className="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Search Task or File Name..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-100" 
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Agent Filter */}
            {user.role !== UserRole.AGENT && (
              <select 
                value={agentFilter} 
                onChange={e => setAgentFilter(e.target.value)} 
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black uppercase cursor-pointer outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="All">All Agents</option>
                {agentsList.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}

            {/* Project Filter */}
            <select 
              value={projectFilter} 
              onChange={e => setProjectFilter(e.target.value)} 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black uppercase cursor-pointer outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="All">All Projects</option>
              {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-slate-50">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date From:</span>
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" 
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date To:</span>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" 
            />
          </div>
          <button 
            onClick={() => {
              setSearchTerm('');
              setProjectFilter('All');
              setAgentFilter('All');
              setDateRange({ start: '', end: '' });
            }}
            className="text-[10px] font-black text-rose-500 uppercase hover:underline ml-auto"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-5">Record Date</th>
                <th className="px-6 py-5">Time Slot</th>
                <th className="px-6 py-5">Audit Type</th>
                <th className="px-6 py-5">Project / Task</th>
                <th className="px-6 py-5">Agent</th>
                <th className="px-6 py-5">QC Score</th>
                <th className="px-6 py-5 text-center">Audit Report</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayData.map((row) => (
                <tr key={`${row.id}-${row._displayType}`} className={`group transition-colors ${row._isReworkRow ? 'bg-indigo-50/20' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-slate-700">{row.date}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] text-slate-900 font-black uppercase tracking-tight">{row.timeSlot}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${
                      row._isReworkRow ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {row._displayType} QC
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-indigo-700 uppercase mb-0.5">{row.projectName}</span>
                      <span className="text-xs font-medium text-slate-600 truncate max-w-[180px]">{row.taskName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900">{row.agentName}</td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-black ${
                      row._displayScore === 'N/A' ? 'text-slate-400' : (Number(row._displayScore) < 90 ? 'text-rose-600' : 'text-emerald-600')
                    }`}>
                      {row._displayScore}{row._displayScore !== 'N/A' ? '%' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleDownloadSingleRecord(row)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 mx-auto transition-all shadow-sm active:scale-95"
                    >
                      <i className="bi bi-file-earmark-arrow-down"></i> Excel
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewingRecord(row)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-xl transition-all" title="View Detail"><i className="bi bi-eye"></i></button>
                      {user.role !== UserRole.AGENT && (
                        <>
                          <button onClick={() => onEdit(row.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Edit Master Audit"><i className="bi bi-pencil-square"></i></button>
                          {canDelete && (
                            <button onClick={() => handleDelete(row.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Delete Audit Record"><i className="bi bi-trash3"></i></button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {displayData.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-20 text-center text-slate-400 font-medium italic">No recorded audit files found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col scale-in">
            <div className="bg-slate-900 p-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl text-white"><i className="bi bi-file-earmark-check"></i></div>
                <div>
                  <h3 className="text-white text-xl font-black">{viewingRecord._displayType} Audit Record</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{viewingRecord.projectName} | {viewingRecord.agentName} | Slot: {viewingRecord.timeSlot}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDownloadSingleRecord(viewingRecord)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all hover:bg-emerald-700">
                  <i className="bi bi-file-earmark-spreadsheet"></i> Download Excel
                </button>
                <button onClick={() => setViewingRecord(null)} className="w-10 h-10 rounded-full hover:bg-white/10 text-white"><i className="bi bi-x-lg"></i></button>
              </div>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Row Score</p>
                  <p className="text-2xl font-black text-indigo-600">{viewingRecord._displayScore}{viewingRecord._displayScore !== 'N/A' ? '%' : ''}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Task Name</p>
                  <p className="text-xs font-bold text-slate-700 truncate">{viewingRecord.taskName}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">QC Checker</p>
                  <p className="text-xs font-bold text-slate-800">{viewingRecord.qcCheckerName}</p>
                </div>
              </div>

              {!viewingRecord.noWork && (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
                        <tr><th className="px-6 py-4">QC Code / Entry Type</th><th className="px-6 py-4">Errors Found</th><th className="px-6 py-4 text-right">Score</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {viewingRecord.subSamples.map((sample, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 font-bold">{sample.qcCode}</td>
                            <td className="px-6 py-4">
                              {sample.noError ? <span className="text-emerald-600 font-bold uppercase">Clean</span> : (
                                <div className="flex flex-wrap gap-1">
                                  {sample.errors.map(errId => {
                                    const err = QC_ERRORS.find(e => e.id === errId);
                                    return <span key={errId} className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-bold uppercase text-[9px]">{err?.name}</span>;
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-black">{sample.score}</td>
                          </tr>
                        ))}
                        {viewingRecord.manualScore !== null && viewingRecord.manualScore !== undefined && (
                          <tr className="bg-amber-50/20">
                            <td className="px-6 py-4 font-black text-amber-700">Manual Evaluation (Direct)</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {viewingRecord.manualErrors && viewingRecord.manualErrors.length > 0 ? viewingRecord.manualErrors.map(errId => {
                                  const err = QC_ERRORS.find(e => e.id === errId);
                                  return <span key={errId} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase text-[9px]">{err?.name}</span>;
                                }) : <span className="text-amber-600 font-bold uppercase">Clean</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-black text-amber-700">{viewingRecord.manualScore}%</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {viewingRecord.manualNotes && (
                    <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 text-sm text-amber-900">
                      <p className="text-[10px] font-black text-amber-700 uppercase mb-2">Specific Manual Audit Feedback</p>
                      <p className="italic">{viewingRecord.manualNotes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 italic text-sm text-slate-600">
                <p className="text-[10px] font-black text-slate-400 uppercase not-italic mb-2">Global Coaching & Final Findings</p>
                {viewingRecord.notes || "No comments."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportTable;

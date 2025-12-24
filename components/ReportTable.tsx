
import React, { useState, useMemo } from 'react';
import { User, UserRole, QCRecord } from '../types';
import { getRecords, deleteRecord } from '../store';

interface ReportTableProps {
  user: User;
  onEdit: (id: string) => void;
}

const ReportTable: React.FC<ReportTableProps> = ({ user, onEdit }) => {
  const [records, setRecords] = useState<QCRecord[]>(getRecords());
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');

  const filteredData = useMemo(() => {
    return records.filter(r => {
      if (user.role === UserRole.AGENT && r.agentName !== user.name) return false;
      const matchesSearch = r.agentName.toLowerCase().includes(searchTerm.toLowerCase()) || r.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = projectFilter === 'All' || r.projectName === projectFilter;
      const matchesAgent = agentFilter === 'All' || r.agentName === agentFilter;
      return matchesSearch && matchesProject && matchesAgent;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [records, searchTerm, projectFilter, agentFilter, user]);

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure?")) {
      deleteRecord(id);
      setRecords(getRecords());
    }
  };

  const handleDownloadExcel = () => {
    const headers = ["Date", "Time", "Agent", "Project", "QC Checker", "Score", "Task", "Notes"];
    const csvContent = [headers.join(","), ...filteredData.map(r => [r.date, `${r.time.hr}:${r.time.min} ${r.time.period}`, r.agentName, r.projectName, r.qcCheckerName, r.noWork ? 'N/A' : r.avgScore, `"${r.taskName}"`, `"${r.notes}"`].join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `QC_Report_${Date.now()}.csv`;
    link.click();
  };

  const canEdit = user.role !== UserRole.AGENT;
  const canDelete = user.role === UserRole.MANAGER || user.role === UserRole.QC_AGENT || user.role === UserRole.ADMIN;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Quality Records</h2>
        {(user.role === UserRole.MANAGER || user.role === UserRole.ADMIN) && (
          <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-100">
            <i className="bi bi-download"></i> Export CSV
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px]">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder="Search records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
        </div>
        <div className="flex items-center gap-3">
          <i className="bi bi-funnel text-slate-400"></i>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none">
            <option value="All">All Projects</option>
            {Array.from(new Set(records.map(r => r.projectName))).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Agent</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Score</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm">{record.date}</td>
                  <td className="px-6 py-4 text-sm font-medium">{record.agentName}</td>
                  <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase">{record.projectName}</span></td>
                  <td className="px-6 py-4 text-sm font-black">{record.noWork ? 'N/A' : `${record.avgScore}%`}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {canEdit && <button onClick={() => onEdit(record.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><i className="bi bi-pencil-square"></i></button>}
                      {canDelete && <button onClick={() => handleDelete(record.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"><i className="bi bi-trash3"></i></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportTable;

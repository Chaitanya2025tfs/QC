
import React, { useMemo, useState } from 'react';
import { getRecords, getUsers } from '../store';
import { User, UserRole, QCRecord } from '../types';
import { PROJECTS, TIME_SLOTS } from '../constants.tsx';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const records = getRecords();
  const allUsers = getUsers();
  
  const agentsList = useMemo(() => 
    allUsers.filter(u => u.role === UserRole.AGENT).map(u => u.name), 
    [allUsers]
  );

  const [selectedAgent, setSelectedAgent] = useState<string>(
    user.role === UserRole.AGENT ? user.name : 'All'
  );
  
  const [dateRange, setDateRange] = useState({ 
    start: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [selectedProject, setSelectedProject] = useState<string>('All');
  const [isAgentFilterOpen, setIsAgentFilterOpen] = useState(false);

  const SLOT_COLORS: Record<string, string> = {
    '12 PM': '#6366f1',   // Indigo
    '4 PM': '#f59e0b',    // Amber
    '6 PM': '#334155'     // Slate-700
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (user.role === UserRole.AGENT && r.agentName !== user.name) return false;
      const inDate = r.date >= dateRange.start && r.date <= dateRange.end;
      const inAgent = selectedAgent === 'All' || r.agentName === selectedAgent;
      const inProject = selectedProject === 'All' || r.projectName === selectedProject;
      return inDate && inAgent && inProject;
    });
  }, [records, dateRange, selectedAgent, selectedProject, user]);

  const kpis = useMemo(() => {
    const originalScores = filteredRecords.filter(r => !r.noWork).map(r => r.originalScore ?? r.avgScore);
    const mainAvg = originalScores.length > 0 ? (originalScores.reduce((a, b) => a + b, 0) / originalScores.length).toFixed(1) : '0';
    const reworkScores = filteredRecords.filter(r => r.reworkStatus && !r.noWork).map(r => r.avgScore);
    const reworkAvg = reworkScores.length > 0 ? (reworkScores.reduce((a, b) => a + b, 0) / reworkScores.length).toFixed(1) : '0';
    const activeProjectsCount = new Set(filteredRecords.map(r => r.projectName)).size;
    const activeAgentsCount = new Set(filteredRecords.map(r => r.agentName)).size;
    return { mainAvg, reworkAvg, activeProjectsCount, activeAgentsCount };
  }, [filteredRecords]);

  // Performance Summary Table Data (Grouped by Date, Agent, and Project)
  // Now tracks separate scores for Regular and Rework components
  const summaryTableData = useMemo(() => {
    const groups: Record<string, { 
      date: string, 
      agent: string, 
      project: string, 
      count: number, 
      regSum: number, 
      regCount: number,
      rewSum: number,
      rewCount: number
    }> = {};
    
    filteredRecords.forEach(r => {
      const key = `${r.date}-${r.agentName}-${r.projectName}`;
      if (!groups[key]) {
        groups[key] = {
          date: r.date,
          agent: r.agentName,
          project: r.projectName,
          count: 0,
          regSum: 0,
          regCount: 0,
          rewSum: 0,
          rewCount: 0
        };
      }
      groups[key].count += 1;
      if (!r.noWork) {
        // Regular Score is either the only score OR the original score before rework
        groups[key].regSum += (r.originalScore ?? r.avgScore);
        groups[key].regCount += 1;
        
        // Rework score only applies if rework was actually performed
        if (r.reworkStatus) {
          groups[key].rewSum += r.avgScore;
          groups[key].rewCount += 1;
        }
      }
    });

    return Object.values(groups).map(g => ({
      ...g,
      regAvg: g.regCount > 0 ? parseFloat((g.regSum / g.regCount).toFixed(1)) : null,
      rewAvg: g.rewCount > 0 ? parseFloat((g.rewSum / g.rewCount).toFixed(1)) : null
    })).sort((a, b) => b.date.localeCompare(a.date) || a.agent.localeCompare(b.agent));
  }, [filteredRecords]);

  // Aggregate scores by Date and Time Slot
  const trendLineData = useMemo(() => {
    const dates = Array.from(new Set(filteredRecords.map(r => r.date))).sort();
    
    const processRecords = (type: 'regular' | 'rework') => {
      return dates.map(d => {
        const data: any = { date: d };
        TIME_SLOTS.forEach(slot => {
          const slotMatches = filteredRecords.filter(r => 
            r.date === d && 
            r.timeSlot === slot &&
            !r.noWork &&
            (type === 'rework' ? r.reworkStatus : true)
          );
          if (slotMatches.length > 0) {
            const sum = slotMatches.reduce((acc, r) => acc + (type === 'rework' ? r.avgScore : (r.originalScore ?? r.avgScore)), 0);
            data[slot] = parseFloat((sum / slotMatches.length).toFixed(1));
          }
        });
        return data;
      });
    };

    return { 
      regular: processRecords('regular'), 
      rework: processRecords('rework') 
    };
  }, [filteredRecords]);

  const horizontalProjectData = useMemo(() => {
    const processHorizontal = (type: 'regular' | 'rework') => {
      const targetProjects = selectedProject === 'All' ? PROJECTS : [selectedProject];
      
      return targetProjects.map(proj => {
        const data: any = { projectName: proj };
        TIME_SLOTS.forEach(slot => {
          const matches = filteredRecords.filter(r => 
            r.projectName === proj && 
            r.timeSlot === slot &&
            !r.noWork &&
            (type === 'rework' ? r.reworkStatus : true)
          );
          if (matches.length > 0) {
            const sum = matches.reduce((acc, r) => acc + (type === 'rework' ? r.avgScore : (r.originalScore ?? r.avgScore)), 0);
            data[slot] = parseFloat((sum / matches.length).toFixed(1));
          }
        });
        return data;
      }).filter(p => Object.keys(p).length > 1);
    };

    return { 
      regular: processHorizontal('regular'), 
      rework: processHorizontal('rework')
    };
  }, [filteredRecords, selectedProject]);

  const agentsDetailByProject = useMemo(() => {
    return PROJECTS.map(proj => {
      const uniqueAgents = Array.from(new Set(
        filteredRecords
          .filter(r => r.projectName === proj)
          .map(r => r.agentName)
      )).sort();
      return {
        projectName: proj,
        agentCount: uniqueAgents.length,
        agentNames: uniqueAgents
      };
    }).filter(p => p.agentCount > 0);
  }, [filteredRecords]);

  const genericColors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#475569', '#9333ea'];

  return (
    <div className="space-y-6 flex flex-col h-full bg-slate-50">
      {/* Header / Filter Section */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6 shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            {user.role === UserRole.AGENT ? "My Performance Analysis" : "QC Performance Slicer"}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {user.role !== UserRole.AGENT ? (
              <div className="relative">
                <button 
                  onClick={() => setIsAgentFilterOpen(!isAgentFilterOpen)} 
                  className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 transition-all hover:bg-slate-100 min-w-[200px] justify-between"
                >
                  <div className="flex items-center gap-2">
                    <i className="bi bi-person-fill text-indigo-600"></i>
                    <span>{selectedAgent === 'All' ? "All Active Agents" : selectedAgent}</span>
                  </div>
                  <i className={`bi bi-chevron-${isAgentFilterOpen ? 'up' : 'down'} text-[10px] text-slate-400`}></i>
                </button>
                {isAgentFilterOpen && (
                  <div className="absolute top-full left-0 mt-3 w-72 bg-white border border-slate-200 rounded-3xl shadow-2xl z-[60] p-2">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1">
                      <button 
                        onClick={() => { setSelectedAgent('All'); setIsAgentFilterOpen(false); }}
                        className={`w-full text-left p-3 rounded-xl text-xs font-black uppercase transition-all ${selectedAgent === 'All' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        Aggregate All Agents
                      </button>
                      <div className="h-px bg-slate-100 my-2"></div>
                      {agentsList.map(agent => (
                        <button 
                          key={agent} 
                          onClick={() => { setSelectedAgent(agent); setIsAgentFilterOpen(false); }}
                          className={`w-full text-left p-3 rounded-xl text-sm font-bold transition-all ${selectedAgent === agent ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600' : 'hover:bg-slate-50 text-slate-700'}`}
                        >
                          {agent}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2.5 rounded-xl text-sm font-black text-indigo-700 border border-indigo-100 shadow-sm">
                <i className="bi bi-person-badge-fill"></i>
                <span>{user.name} (Self)</span>
              </div>
            )}
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
              <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="bg-transparent text-xs font-black outline-none" />
              <span className="text-slate-300 font-black">→</span>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="bg-transparent text-xs font-black outline-none" />
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Project Focus</span>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold outline-none cursor-pointer">
            <option value="All">All Operations</option>
            {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-[8px] border-indigo-600 flex items-center justify-between">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Regular Avg</p><h3 className="text-4xl font-black">{kpis.mainAvg}%</h3></div>
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center"><i className="bi bi-activity text-2xl text-indigo-600"></i></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-[8px] border-emerald-500 flex items-center justify-between">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Rework Avg</p><h3 className="text-4xl font-black">{kpis.reworkAvg}%</h3></div>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center"><i className="bi bi-arrow-repeat text-2xl text-emerald-600"></i></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-[8px] border-rose-500 flex items-center justify-between">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Projects</p><h3 className="text-4xl font-black">{kpis.activeProjectsCount}</h3></div>
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center"><i className="bi bi-stack text-2xl text-rose-600"></i></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-[8px] border-amber-500 flex items-center justify-between">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{user.role === UserRole.AGENT ? "Total Audits" : "Active Selection"}</p><h3 className="text-4xl font-black">{user.role === UserRole.AGENT ? filteredRecords.length : (selectedAgent === 'All' ? kpis.activeAgentsCount : 1)}</h3></div>
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center"><i className="bi bi-person-check text-2xl text-amber-600"></i></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 pb-12 space-y-10">
        {/* Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-[450px] flex flex-col">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <i className="bi bi-graph-up-arrow text-indigo-600"></i> Time Slot Trends (Regular)
            </h4>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendLineData.regular}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 10, fontWeight: 700}} axisLine={false} />
                  <Tooltip contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                  <Legend iconType="circle" />
                  {TIME_SLOTS.map((slot) => (
                    <Line key={slot} type="monotone" dataKey={slot} stroke={SLOT_COLORS[slot]} strokeWidth={3} dot={{r: 4}} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-[450px] flex flex-col">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <i className="bi bi-arrow-repeat text-emerald-600"></i> Time Slot Trends (Rework)
            </h4>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendLineData.rework}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 10, fontWeight: 700}} axisLine={false} />
                  <Tooltip contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                  <Legend iconType="circle" />
                  {TIME_SLOTS.map((slot) => (
                    <Line key={slot} type="monotone" dataKey={slot} stroke={SLOT_COLORS[slot]} strokeWidth={3} dot={{r: 4}} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bar Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-[450px] flex flex-col">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <i className="bi bi-bar-chart-steps text-indigo-600"></i> {selectedProject === 'All' ? 'Project QC Avg per Slot' : `Task Performance in Slots (${selectedProject})`}
            </h4>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horizontalProjectData.regular} layout="vertical" margin={{ left: 40, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{fontSize: 10, fontWeight: 700}} axisLine={false} />
                  <YAxis dataKey="projectName" type="category" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} width={80} />
                  <Tooltip contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                  <Legend iconType="circle" />
                  {TIME_SLOTS.map((slot) => (
                    <Bar key={slot} dataKey={slot} fill={SLOT_COLORS[slot]} radius={[0, 5, 5, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-[450px] flex flex-col">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <i className="bi bi-bar-chart-steps text-emerald-600"></i> Rework Performance per Slot
            </h4>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horizontalProjectData.rework} layout="vertical" margin={{ left: 40, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{fontSize: 10, fontWeight: 700}} axisLine={false} />
                  <YAxis dataKey="projectName" type="category" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} width={80} />
                  <Tooltip contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                  <Legend iconType="circle" />
                  {TIME_SLOTS.map((slot) => (
                    <Bar key={slot} dataKey={slot} fill={SLOT_COLORS[slot]} radius={[0, 5, 5, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Performance Summary Table */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <i className="bi bi-calendar-check text-indigo-600"></i> Performance & Productivity Summary
            </h4>
            <div className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase">
              {summaryTableData.length} Grouped Entries
            </div>
          </div>
          
          <div className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Agent Name</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4 text-center">Submissions</th>
                    <th className="px-6 py-4 text-center">Regular QC Score</th>
                    <th className="px-6 py-4 text-right">Rework QC Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {summaryTableData.map((row) => (
                    <tr key={`${row.date}-${row.agent}-${row.project}`} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{row.date}</td>
                      <td className="px-6 py-4 text-sm font-black text-slate-900">{row.agent}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg uppercase border border-indigo-100">
                          {row.project}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                          {row.count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-base font-black ${row.regAvg !== null && row.regAvg < 90 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {row.regAvg !== null ? `${row.regAvg}%` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-base font-black ${row.rewAvg !== null && row.rewAvg < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {row.rewAvg !== null ? `${row.rewAvg}%` : <span className="text-slate-300 font-normal italic text-xs">No Reworks</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {summaryTableData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center italic text-slate-400 font-medium">
                        No performance data matches the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Operations Distribution Section */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
            <i className="bi bi-pie-chart-fill text-amber-500"></i> Active Agent Distribution per Project
          </h4>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agentsDetailByProject}
                    dataKey="agentCount"
                    nameKey="projectName"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {agentsDetailByProject.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={genericColors[index % genericColors.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-7 overflow-hidden">
              <div className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Project Name</th>
                      <th className="px-6 py-4 text-center">Active Agents</th>
                      <th className="px-6 py-4">Agent Names</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {agentsDetailByProject.map((p, idx) => (
                      <tr key={p.projectName} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: genericColors[idx % genericColors.length] }}></div>
                            <span className="text-sm font-black text-slate-900">{p.projectName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block px-3 py-1 bg-slate-100 rounded-lg text-xs font-black text-slate-600">
                            {p.agentCount}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {p.agentNames.map(name => (
                              <span key={name} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-100">
                                {name}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

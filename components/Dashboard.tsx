
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

  // Aggregate scores by Date and Time Slot
  // Logic: Shows AVERAGE score for the slot if multiple tasks exist
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

  // Aggregate scores by Project and Time Slot
  const horizontalProjectData = useMemo(() => {
    const processHorizontal = (type: 'regular' | 'rework') => {
      // If a specific project is selected, we only process that one
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
      </div>
    </div>
  );
};

export default Dashboard;

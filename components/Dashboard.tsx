
import React, { useMemo, useState } from 'react';
import { getRecords, getUsers } from '../store';
import { User, UserRole, QCRecord } from '../types';
import { PROJECTS } from '../constants.tsx';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const records = getRecords();
  const allUsers = getUsers();
  
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ 
    start: new Date().toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [selectedProject, setSelectedProject] = useState<string>('All');
  const [isAgentFilterOpen, setIsAgentFilterOpen] = useState(false);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (user.role === UserRole.AGENT && r.agentName !== user.name) return false;
      const inDate = r.date >= dateRange.start && r.date <= dateRange.end;
      const inAgent = selectedAgents.length === 0 || selectedAgents.includes(r.agentName);
      const inProject = selectedProject === 'All' || r.projectName === selectedProject;
      return inDate && inAgent && inProject;
    });
  }, [records, dateRange, selectedAgents, selectedProject, user]);

  const kpis = useMemo(() => {
    const validScores = filteredRecords.filter(r => !r.noWork).map(r => r.avgScore);
    const avgScore = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '0';
    const activeProjectsCount = new Set(filteredRecords.map(r => r.projectName)).size;
    const activeAgentsCount = new Set(filteredRecords.map(r => r.agentName)).size;
    return { avgScore, activeProjectsCount, activeAgentsCount };
  }, [filteredRecords]);

  const lineChartData = useMemo(() => {
    const dates = Array.from(new Set(filteredRecords.map(r => r.date))).sort();
    return dates.map(d => {
      const data: any = { date: d };
      const agentsInDay = Array.from(new Set(filteredRecords.filter(r => r.date === d).map(r => r.agentName)));
      agentsInDay.forEach(agent => {
        const scores = filteredRecords.filter(r => r.date === d && r.agentName === agent && !r.noWork).map(r => r.avgScore);
        if (scores.length > 0) {
          data[agent] = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
        }
      });
      return data;
    });
  }, [filteredRecords]);

  const projectStats = useMemo(() => {
    return PROJECTS.map(proj => {
      const projRecords = filteredRecords.filter(r => r.projectName === proj);
      const uniqueAgents = new Set(projRecords.map(r => r.agentName)).size;
      return { projectName: proj, activeAgents: uniqueAgents };
    });
  }, [filteredRecords]);

  const agentProjectData = useMemo(() => {
    const data: any[] = [];
    const agents = Array.from(new Set(filteredRecords.map(r => r.agentName)));
    agents.forEach(agent => {
      PROJECTS.forEach(proj => {
        const scores = filteredRecords.filter(r => r.agentName === agent && r.projectName === proj && !r.noWork).map(r => r.avgScore);
        if (scores.length > 0) {
          data.push({
            name: `${agent} - ${proj}`,
            score: parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
          });
        }
      });
    });
    return data.sort((a, b) => b.score - a.score);
  }, [filteredRecords]);

  const toggleAgent = (name: string) => {
    setSelectedAgents(prev => 
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  const agentsList = allUsers.filter(u => u.role === UserRole.AGENT).map(u => u.name);

  return (
    <div className="space-y-6 flex flex-col h-full overflow-hidden">
      {/* Filters */}
      <div className="bg-white p-5 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-6 border border-slate-100">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Agents & Date</span>
            <div className="flex items-center gap-3">
              {user.role !== UserRole.AGENT ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsAgentFilterOpen(!isAgentFilterOpen)}
                    className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200"
                  >
                    <i className="bi bi-people text-indigo-600"></i>
                    <span>{selectedAgents.length === 0 ? "Agents" : `${selectedAgents.length} Selected`}</span>
                    <i className={`bi bi-chevron-${isAgentFilterOpen ? 'up' : 'down'}`}></i>
                  </button>
                  {isAgentFilterOpen && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3">
                      <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                        {agentsList.map(agent => (
                          <label key={agent} className="flex items-center gap-3 p-2 hover:bg-indigo-50 rounded-xl cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={selectedAgents.includes(agent)}
                              onChange={() => toggleAgent(agent)}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="text-sm font-semibold">{agent}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 flex items-center gap-2">
                  <i className="bi bi-person text-indigo-600"></i>
                  {user.name}
                </div>
              )}

              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                <i className="bi bi-calendar3 text-indigo-600"></i>
                <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="bg-transparent text-xs font-black outline-none" />
                <span className="text-slate-300">-</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="bg-transparent text-xs font-black outline-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Project</span>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold outline-none">
            <option value="All">All Projects</option>
            {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* 3 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-7 rounded-[2rem] shadow-sm border-l-8 border-indigo-600 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase mb-1">Average QC Score</p>
            <h3 className="text-4xl font-black text-slate-900">{kpis.avgScore}%</h3>
          </div>
          <i className="bi bi-graph-up text-4xl text-indigo-200"></i>
        </div>
        <div className="bg-white p-7 rounded-[2rem] shadow-sm border-l-8 border-rose-600 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase mb-1">Active Projects</p>
            <h3 className="text-4xl font-black text-slate-900">{kpis.activeProjectsCount}</h3>
          </div>
          <i className="bi bi-briefcase text-4xl text-rose-200"></i>
        </div>
        <div className="bg-white p-7 rounded-[2rem] shadow-sm border-l-8 border-amber-500 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase mb-1">Active Agents</p>
            <h3 className="text-4xl font-black text-slate-900">{kpis.activeAgentsCount}</h3>
          </div>
          <i className="bi bi-people text-4xl text-amber-200"></i>
        </div>
      </div>

      {/* 3 Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto custom-scrollbar pb-10">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 h-[450px]">
          <h4 className="text-sm font-black text-slate-800 uppercase mb-6 flex items-center gap-2">
            <i className="bi bi-graph-up text-indigo-600"></i> QC Score % Trends
          </h4>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{fontSize: 10, fontWeight: 800}} />
              <YAxis domain={[0, 100]} tick={{fontSize: 10, fontWeight: 800}} />
              <Tooltip contentStyle={{borderRadius: '15px'}} />
              <Legend iconType="circle" />
              {Array.from(new Set(filteredRecords.map(r => r.agentName))).map((agent, i) => (
                <Line key={agent} type="monotone" dataKey={agent} stroke={`hsl(${i * 137.5}, 70%, 50%)`} strokeWidth={3} dot={{r: 4}} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 h-[450px]">
          <h4 className="text-sm font-black text-slate-800 uppercase mb-6 flex items-center gap-2">
            <i className="bi bi-people text-rose-600"></i> Agents count by Project
          </h4>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={projectStats} barSize={35}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="projectName" tick={{fontSize: 10, fontWeight: 800}} />
              <YAxis allowDecimals={false} tick={{fontSize: 10, fontWeight: 800}} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="activeAgents" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 lg:col-span-2 min-h-[500px]">
          <h4 className="text-sm font-black text-slate-800 uppercase mb-8 flex items-center gap-2">
            <i className="bi bi-bullseye text-indigo-600"></i> Agent vs Project Performance
          </h4>
          <ResponsiveContainer width="100%" height={Math.max(400, agentProjectData.length * 50)}>
            <BarChart data={agentProjectData} layout="vertical" margin={{ left: 140, right: 40 }} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={true} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{fontSize: 10, fontWeight: 800}} />
              <YAxis dataKey="name" type="category" width={130} tick={{fontSize: 10, fontWeight: 900, fill: '#1e293b'}} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="score" fill="#4f46e5" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

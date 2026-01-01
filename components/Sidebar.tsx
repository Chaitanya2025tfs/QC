
import React from 'react';
import { User, UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
  user: User;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, user }) => {
  const menuItems = [
    { name: 'Dashboard', icon: <i className="bi bi-speedometer2"></i>, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.QC_AGENT, UserRole.AGENT] },
    { name: 'Qc form', icon: <i className="bi bi-file-earmark-text"></i>, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.QC_AGENT] },
    { name: 'Report table', icon: <i className="bi bi-table"></i>, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.QC_AGENT, UserRole.AGENT] },
    { name: 'Production Tracker', icon: <i className="bi bi-clipboard-data"></i>, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.QC_AGENT, UserRole.AGENT] },
    { name: 'Admin', icon: <i className="bi bi-gear"></i>, roles: [UserRole.ADMIN] },
  ];

  return (
    <div className="w-64 bg-slate-900 h-full flex flex-col text-slate-300">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white mb-1">QC EVALUATOR</h1>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-400 truncate">{user.name}</span>
          <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">{user.role.replace('_', ' ')}</span>
        </div>
      </div>

      <nav className="flex-1 mt-6 px-4 space-y-2">
        {menuItems.filter(item => item.roles.includes(user.role)).map((item) => (
          <button
            key={item.name}
            onClick={() => setActiveTab(item.name)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === item.name 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="font-medium">{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors"
        >
          <i className="bi bi-box-arrow-right text-xl"></i>
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

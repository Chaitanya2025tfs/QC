
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole } from './types';
import { getCurrentUser, setCurrentUserStore } from './store';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import QCForm from './components/QCForm';
import ReportTable from './components/ReportTable';
import AdminPanel from './components/AdminPanel';
import ProductionTracker from './components/ProductionTracker';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Qc form' | 'Report table' | 'Production Tracker' | 'Admin'>('Dashboard');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentUserStore(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserStore(null);
  };

  const handleEdit = (id: string) => {
    setEditingRecordId(id);
    setActiveTab('Qc form');
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab: any) => {
          setActiveTab(tab);
          if (tab !== 'Qc form') setEditingRecordId(null);
        }} 
        onLogout={handleLogout}
        user={currentUser}
      />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {activeTab === 'Dashboard' && <Dashboard user={currentUser} />}
          {activeTab === 'Qc form' && (
            <QCForm 
              user={currentUser} 
              editId={editingRecordId} 
              onComplete={() => {
                setActiveTab('Report table');
                setEditingRecordId(null);
              }} 
            />
          )}
          {activeTab === 'Report table' && (
            <ReportTable 
              user={currentUser} 
              onEdit={handleEdit} 
            />
          )}
          {activeTab === 'Production Tracker' && (
            <ProductionTracker user={currentUser} />
          )}
          {activeTab === 'Admin' && currentUser.role === UserRole.ADMIN && (
            <AdminPanel />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;

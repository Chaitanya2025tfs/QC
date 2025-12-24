
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { getUsers, updateUsers } from '../store';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>(getUsers());
  const [newUser, setNewUser] = useState({ name: '', role: UserRole.AGENT });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name) return;
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: newUser.name,
      role: newUser.role
    };
    const updated = [...users, user];
    setUsers(updated);
    updateUsers(updated);
    setNewUser({ name: '', role: UserRole.AGENT });
  };

  const handleRemoveUser = (id: string) => {
    if (window.confirm("Remove user?")) {
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
      updateUsers(updated);
    }
  };

  const handleChangeRole = (id: string, newRole: UserRole) => {
    const updated = users.map(u => u.id === id ? { ...u, role: newRole } : u);
    setUsers(updated);
    updateUsers(updated);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-3 mb-2">
        <i className="bi bi-shield-check text-indigo-600 text-4xl"></i>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Admin Console</h2>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <i className="bi bi-person-plus text-indigo-500"></i> Onboard New User
        </h3>
        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Full Name" className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
          <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
            <option value={UserRole.AGENT}>Agent</option>
            <option value={UserRole.QC_AGENT}>QC Agent</option>
            <option value={UserRole.MANAGER}>Manager / TL</option>
            <option value={UserRole.ADMIN}>Administrator</option>
          </select>
          <button type="submit" className="bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg">Add User</button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-2">
          <i className="bi bi-person-gear text-indigo-500 text-xl"></i>
          <h3 className="text-lg font-bold text-slate-800">Manage Users</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
              <th className="px-8 py-4">Name</th>
              <th className="px-8 py-4">Role</th>
              <th className="px-8 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id}>
                <td className="px-8 py-4 font-bold">{u.name}</td>
                <td className="px-8 py-4">
                  <select value={u.role} onChange={e => handleChangeRole(u.id, e.target.value as UserRole)} className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-semibold outline-none">
                    <option value={UserRole.AGENT}>Agent</option>
                    <option value={UserRole.QC_AGENT}>QC Agent</option>
                    <option value={UserRole.MANAGER}>Manager / TL</option>
                    <option value={UserRole.ADMIN}>Administrator</option>
                  </select>
                </td>
                <td className="px-8 py-4 text-right">
                  {u.role !== UserRole.ADMIN && <button onClick={() => handleRemoveUser(u.id)} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg"><i className="bi bi-person-dash text-xl"></i></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPanel;

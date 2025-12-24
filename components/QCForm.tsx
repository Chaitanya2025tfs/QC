
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, QCRecord, SubSampleRecord, AgentReviewStatus, EvaluationSlot } from '../types';
import { getUsers, saveRecord, getRecords } from '../store';
import { PROJECTS, QC_ERRORS, HOURS, MINUTES, EVALUATION_SLOTS } from '../constants.tsx';

interface QCFormProps {
  user: User;
  editId: string | null;
  onComplete: () => void;
}

const QCForm: React.FC<QCFormProps> = ({ user, editId, onComplete }) => {
  const allUsers = getUsers();
  const allRecords = getRecords();

  const [formData, setFormData] = useState<Partial<QCRecord>>({
    id: Math.random().toString(36).substr(2, 9),
    date: new Date().toISOString().split('T')[0],
    time: { 
      hr: new Date().getHours() > 12 ? (new Date().getHours() - 12).toString().padStart(2, '0') : new Date().getHours().toString().padStart(2, '0'), 
      min: new Date().getMinutes().toString().padStart(2, '0'), 
      period: new Date().getHours() >= 12 ? 'PM' : 'AM' 
    },
    evaluationSlot: '12 PM',
    agentName: '',
    tlName: '',
    managerName: '',
    qcCheckerName: user.name,
    projectName: PROJECTS[0],
    taskName: '',
    reworkStatus: false,
    noWork: false,
    noAttachment: false,
    notes: '',
    qcCodeRangeStart: '',
    qcCodeRangeEnd: '',
    subSamples: [],
    avgScore: 100,
    originalScore: 100,
    createdAt: Date.now(),
    agentReviewStatus: AgentReviewStatus.PENDING
  });

  useEffect(() => {
    if (editId) {
      const records = getRecords();
      const record = records.find(r => r.id === editId);
      if (record) {
        setFormData({ ...record });
      }
    }
  }, [editId]);

  const managers = allUsers.filter(u => u.role === UserRole.MANAGER).map(u => u.name);
  const agents = allUsers.filter(u => u.role === UserRole.AGENT).map(u => u.name);
  const qcAgents = allUsers.filter(u => u.role === UserRole.QC_AGENT || u.role === UserRole.MANAGER).map(u => u.name);

  // Filter available slots for the selected agent and date
  const availableSlots = useMemo(() => {
    if (!formData.agentName || !formData.date) return EVALUATION_SLOTS;
    
    // Find all slots taken by this agent on this day
    const takenSlots = allRecords
      .filter(r => r.agentName === formData.agentName && r.date === formData.date && r.id !== editId)
      .map(r => r.evaluationSlot);

    return EVALUATION_SLOTS.filter(slot => !takenSlots.includes(slot));
  }, [formData.agentName, formData.date, allRecords, editId]);

  // If the current slot is not in available slots, reset it to the first available one (if not editing)
  useEffect(() => {
    if (!editId && formData.agentName && availableSlots.length > 0 && !availableSlots.includes(formData.evaluationSlot!)) {
      setFormData(prev => ({ ...prev, evaluationSlot: availableSlots[0] }));
    }
  }, [availableSlots, editId, formData.agentName]);

  const generateSampling = () => {
    if (!formData.qcCodeRangeStart || !formData.qcCodeRangeEnd) {
      alert("Please enter both start and end QC codes.");
      return;
    }

    const startMatch = formData.qcCodeRangeStart.match(/\d+$/);
    const endMatch = formData.qcCodeRangeEnd.match(/\d+$/);

    if (!startMatch || !endMatch) {
      alert("QC codes must end with numeric values (e.g., Altrum/01)");
      return;
    }

    const startNum = parseInt(startMatch[0]);
    const endNum = parseInt(endMatch[0]);
    const base = formData.qcCodeRangeStart.replace(/\d+$/, '');

    const totalInRange = Math.abs(endNum - startNum) + 1;
    const sampleSize = Math.max(1, Math.ceil(totalInRange * 0.1));

    const samples: SubSampleRecord[] = [];
    const usedIndices = new Set<number>();

    while (samples.length < sampleSize) {
      const randomNum = Math.floor(Math.random() * totalInRange) + Math.min(startNum, endNum);
      if (!usedIndices.has(randomNum)) {
        usedIndices.add(randomNum);
        samples.push({
          qcCode: `${base}${randomNum.toString().padStart(startMatch[0].length, '0')}`,
          errors: [],
          noError: true,
          score: 100
        });
      }
    }

    setFormData(prev => ({ 
      ...prev, 
      subSamples: samples, 
      avgScore: 100 
    }));
  };

  const calculateSampleScore = (errors: string[]) => {
    let score = 100;
    errors.forEach(errId => {
      const error = QC_ERRORS.find(e => e.id === errId);
      if (error) score += error.weight;
    });
    return Math.max(0, score);
  };

  const handleSubSampleErrorToggle = (sampleIdx: number, errorId: string) => {
    const updatedSamples = [...(formData.subSamples || [])];
    const sample = { ...updatedSamples[sampleIdx] };
    
    if (sample.errors.includes(errorId)) {
      sample.errors = sample.errors.filter(e => e !== errorId);
    } else {
      sample.errors = [...sample.errors, errorId];
    }
    
    sample.noError = sample.errors.length === 0;
    sample.score = calculateSampleScore(sample.errors);
    updatedSamples[sampleIdx] = sample;

    const avg = updatedSamples.reduce((acc, s) => acc + s.score, 0) / updatedSamples.length;
    setFormData(prev => ({ ...prev, subSamples: updatedSamples, avgScore: parseFloat(avg.toFixed(1)) }));
  };

  const handleNoErrorToggle = (sampleIdx: number) => {
    const updatedSamples = [...(formData.subSamples || [])];
    updatedSamples[sampleIdx] = {
      ...updatedSamples[sampleIdx],
      errors: [],
      noError: true,
      score: 100
    };
    const avg = updatedSamples.reduce((acc, s) => acc + s.score, 0) / updatedSamples.length;
    setFormData(prev => ({ ...prev, subSamples: updatedSamples, avgScore: parseFloat(avg.toFixed(1)) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.notes) {
      alert("Feedback comments are mandatory.");
      return;
    }
    if (!formData.subSamples || formData.subSamples.length === 0) {
      if (!formData.noWork) {
        alert("Please generate 10% sampling records first.");
        return;
      }
    }

    const records = getRecords();

    // Final safety check for duplicates
    if (!editId) {
      const duplicate = records.find(r => 
        r.agentName === formData.agentName && 
        r.date === formData.date && 
        r.evaluationSlot === formData.evaluationSlot
      );

      if (duplicate) {
        alert(`Error: A record for ${formData.agentName} during the ${formData.evaluationSlot} slot already exists for ${formData.date}.`);
        return;
      }
    }

    const finalData = { ...formData, createdAt: Date.now() };
    const existing = editId ? records.find(r => r.id === editId) : null;

    if (!editId) {
      finalData.originalScore = finalData.avgScore || 100;
    } else if (existing) {
      if (finalData.reworkStatus) {
        finalData.originalScore = existing.originalScore ?? existing.avgScore;
      } else {
        finalData.originalScore = finalData.avgScore || 100;
      }
    }

    saveRecord(finalData as QCRecord);
    onComplete();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${editId ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <h2 className="text-white font-bold text-lg">
              {editId ? 'Update Audit Entry' : 'New Daily Audit'}
            </h2>
          </div>
          <div className="flex gap-2 items-center">
            {editId && (
              <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-500/30 mr-2">
                Editing Mode
              </span>
            )}
            <span className="bg-indigo-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
              Daily Slot: {formData.evaluationSlot}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Evaluation Date</label>
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-100" required />
            </div>

            {/* Agent Name Swapped to 2nd position */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Agent Name</label>
              <select value={formData.agentName} onChange={e => setFormData({ ...formData, agentName: e.target.value })} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" required>
                <option value="">Choose Agent...</option>
                {agents.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Daily Audit Window (Slot/Time) Swapped to 3rd position */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Daily Audit Window</label>
              <select 
                value={formData.evaluationSlot} 
                onChange={e => setFormData({ ...formData, evaluationSlot: e.target.value as EvaluationSlot })} 
                className={`w-full px-4 py-3 border rounded-xl font-black outline-none transition-colors ${availableSlots.length === 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`} 
                required
                disabled={!formData.agentName}
              >
                {!formData.agentName && <option value="">Select Agent First</option>}
                {availableSlots.map(slot => (
                  <option key={slot} value={slot}>{slot} Evaluation</option>
                ))}
                {editId && !availableSlots.includes(formData.evaluationSlot!) && (
                   <option value={formData.evaluationSlot}>{formData.evaluationSlot} Evaluation (Current)</option>
                )}
              </select>
              {formData.agentName && availableSlots.length === 0 && (
                <p className="text-[10px] text-rose-500 font-bold mt-1 uppercase tracking-tight">All daily slots completed for this agent.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Campaign Project</label>
              <select value={formData.projectName} onChange={e => setFormData({ ...formData, projectName: e.target.value })} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" required>
                {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task / File Name Audited</label>
              <input type="text" value={formData.taskName} onChange={e => setFormData({ ...formData, taskName: e.target.value })} placeholder="Enter specific task name..." className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" required />
            </div>
            
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lead / Manager</label>
                <select value={formData.managerName} onChange={e => setFormData({ ...formData, managerName: e.target.value, tlName: e.target.value })} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" required>
                  <option value="">Select Manager...</option>
                  {managers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QC Evaluator</label>
                <select value={formData.qcCheckerName} onChange={e => setFormData({ ...formData, qcCheckerName: e.target.value })} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" required>
                  {qcAgents.map(qa => <option key={qa} value={qa}>{qa}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 bg-slate-900 text-white p-6 rounded-2xl">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={formData.reworkStatus} onChange={e => setFormData({ ...formData, reworkStatus: e.target.checked })} className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-rose-500" />
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-tight group-hover:text-rose-400">Perform Rework Audit</span>
                <span className="text-[10px] text-slate-400">This will link the previous record with the new rework file</span>
              </div>
            </label>
            <div className="w-px bg-slate-800 h-10"></div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={formData.noWork} onChange={e => setFormData({ ...formData, noWork: e.target.checked })} className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-amber-500" />
              <span className="text-sm font-black uppercase tracking-tight group-hover:text-amber-400">No Target / Absent</span>
            </label>
          </div>

          {!formData.noWork && (
            <div className="border-t border-slate-100 pt-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <i className="bi bi-search text-indigo-500"></i> Audit Protocol (10% Sampling)
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <input type="text" value={formData.qcCodeRangeStart} onChange={e => setFormData({ ...formData, qcCodeRangeStart: e.target.value })} placeholder="Code Start (e.g. Altrum/01)" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200" />
                <input type="text" value={formData.qcCodeRangeEnd} onChange={e => setFormData({ ...formData, qcCodeRangeEnd: e.target.value })} placeholder="Code End (e.g. Altrum/100)" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200" />
                <button type="button" onClick={generateSampling} className="md:col-span-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black py-4 rounded-xl border-2 border-dashed border-indigo-200 transition-all">
                  Generate 10% Samples (Default 100%)
                </button>
              </div>

              {formData.subSamples && formData.subSamples.length > 0 && (
                <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase">
                        <th className="px-6 py-4 text-left">Sample ID</th>
                        {QC_ERRORS.map(err => <th key={err.id} className="px-2 py-4 text-center">{err.name}</th>)}
                        <th className="px-6 py-4 text-center">Clean</th>
                        <th className="px-6 py-4 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.subSamples.map((sample, sIdx) => (
                        <tr key={sIdx} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-xs font-bold text-slate-700">{sample.qcCode}</td>
                          {QC_ERRORS.map(err => (
                            <td key={err.id} className="px-2 py-4 text-center">
                              <input type="checkbox" checked={sample.errors.includes(err.id)} onChange={() => handleSubSampleErrorToggle(sIdx, err.id)} className="w-5 h-5 rounded text-rose-600 border-slate-300" />
                            </td>
                          ))}
                          <td className="px-6 py-4 text-center">
                            <input type="checkbox" checked={sample.noError} onChange={() => handleNoErrorToggle(sIdx)} className="w-5 h-5 rounded text-emerald-600 border-slate-300" />
                          </td>
                          <td className="px-6 py-4 text-right font-black text-xs">{sample.score}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-900 text-white">
                        <td colSpan={QC_ERRORS.length + 2} className="px-6 py-6 text-right font-black uppercase text-xs tracking-widest">Aggregate Score</td>
                        <td className="px-6 py-6 text-right text-3xl font-black text-emerald-400">{formData.avgScore}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 pt-4">
            <label className="block text-sm font-bold text-slate-700 uppercase">Coaching Feedback & Notes (Mandatory)</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border border-slate-200 min-h-[140px]" placeholder="Explain audit findings for the agent..." required />
          </div>

          <div className="flex gap-4">
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-100 transition-all hover:scale-[1.01] active:scale-[0.99]" disabled={formData.agentName && availableSlots.length === 0 && !editId}>
              {editId ? 'Apply Updates & Save' : 'Submit Daily Audit'}
            </button>
            <button type="button" onClick={onComplete} className="px-10 bg-slate-200 text-slate-700 font-black py-5 rounded-2xl hover:bg-slate-300 transition-colors">Discard</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QCForm;

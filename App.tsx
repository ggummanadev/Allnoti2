
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, WorkflowTemplate, ViewType, SubTask, WorkflowStep, UserProfile, AppSettings, Memo } from './types';
import { db } from './db';
import { workflowService } from './services/workflowService';
import { suggestWorkflowSteps, suggestIconOnly } from './services/geminiService';
import { notificationService } from './services/notificationService';
import { GoogleGenAI } from "@google/genai";
import { translations } from './translations';

// --- Utils: Time Formatters ---
const formatToLocalValue = (iso: string) => {
  if (!iso) return { date: '', time: '', dateTime: '' };
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return { 
    date: `${year}-${month}-${day}`, 
    time: `${hours}:${minutes}`, 
    dateTime: `${year}-${month}-${day}T${hours}:${minutes}` 
  };
};

// --- Utils: ICS Generator (Standardized) ---
const exportToICS = (events: { title: string, description: string, start: string }[]) => {
  const formatDate = (isoString: string) => {
    return new Date(isoString).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const dtStamp = formatDate(new Date().toISOString());

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AllNoti//Smart Process Manager//KR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  events.forEach((event, index) => {
    const startDate = formatDate(event.start);
    const endDate = formatDate(new Date(new Date(event.start).getTime() + 30 * 60 * 1000).toISOString());
    const uid = `${Date.now()}-${index}@allnoti.app`;
    
    const summary = event.title.replace(/[,;\\]/g, '\\$0');
    const description = event.description.replace(/[,;\\]/g, '\\$0').replace(/\n/g, '\\n');

    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `SEQUENCE:0`,
      `STATUS:CONFIRMED`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');

  const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = events.length === 1 ? `task_${events[0].title.substring(0, 10)}.ics` : `allnoti_schedule.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const renderIcon = (iconData: string | undefined, className: string = "w-5 h-5") => {
  if (!iconData) return <i className={`fa-solid fa-tasks ${className}`}></i>;
  if (iconData.startsWith('data:image')) {
    return <img src={iconData} alt="icon" className={`${className} object-contain rounded`} />;
  }
  return <i className={`fa-solid ${iconData} ${className} flex items-center justify-center`}></i>;
};

// --- Components: ManualView ---
const ManualView: React.FC<{ setView: (v: ViewType) => void, t: any }> = ({ setView, t }) => {
  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="bg-indigo-600 rounded-[24px] p-6 text-white shadow-xl">
        <h2 className="text-xl font-black mb-2">{t.manualTitle}</h2>
        <p className="text-indigo-100 text-xs">{t.manualDesc}</p>
      </div>
      
      <div className="space-y-4">
        <section className="bg-white p-5 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-black text-slate-800 mb-2">{t.manualSection1Title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            {t.manualSection1Desc}
          </p>
        </section>

        <section className="bg-white p-5 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-black text-slate-800 mb-2">{t.manualSection2Title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            {t.manualSection2Desc}
          </p>
        </section>

        <section className="bg-white p-5 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-black text-slate-800 mb-2">{t.manualSection3Title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            {t.manualSection3Desc}
          </p>
        </section>

        <section className="bg-white p-5 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-black text-slate-800 mb-2">{t.manualSection4Title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            {t.manualSection4Desc}
          </p>
        </section>

        <section className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
          <h3 className="text-sm font-black text-indigo-700 mb-3 flex items-center gap-2">
            <i className="fa-solid fa-calendar-days"></i> {t.manualCalendarTitle}
          </h3>
          <ol className="text-xs text-indigo-600/80 leading-relaxed space-y-2 list-decimal pl-4">
            <li>{t.manualCalendarStep1}</li>
            <li>{t.manualCalendarStep2}</li>
            <li>{t.manualCalendarStep3}</li>
          </ol>
        </section>

        <section className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
          <h3 className="text-sm font-black text-amber-700 mb-3 flex items-center gap-2">
            <i className="fa-solid fa-bell"></i> {t.manualNotificationTitle}
          </h3>
          <ol className="text-xs text-amber-600/80 leading-relaxed space-y-2 list-decimal pl-4">
            <li>{t.manualNotificationStep1}</li>
            <li>{t.manualNotificationStep2}</li>
            <li>{t.manualNotificationStep3}</li>
          </ol>
        </section>
      </div>

      <div className="pt-8 pb-4 border-t border-slate-100 flex flex-col items-center gap-1">
        <p className="text-[10px] font-bold text-slate-300">{t.version}: v1.3.13</p>
        <p className="text-[10px] font-bold text-slate-400">{t.contact}: <a href="mailto:ggummana2@gmail.com" className="text-indigo-400 underline underline-offset-2">ggummana2@gmail.com</a></p>
      </div>

      <button onClick={() => setView('TASKS')} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm">{t.yes}</button>
    </div>
  );
};

// --- Components: SettingsView ---
const SettingsView: React.FC<{ 
  settings: AppSettings, 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>, 
  t: any,
  handleExportData: () => void,
  handleImportData: (e: React.ChangeEvent<HTMLInputElement>) => void,
  backupInputRef: React.RefObject<HTMLInputElement | null>
}> = ({ settings, setSettings, t, handleExportData, handleImportData, backupInputRef }) => {
  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="bg-slate-900 rounded-[24px] p-6 text-white shadow-xl">
        <h2 className="text-xl font-black mb-2">{t.settings}</h2>
        <p className="text-slate-400 text-xs">{t.settingsDesc}</p>
      </div>

      <div className="space-y-4">
        <section className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-language text-indigo-500"></i> {t.language}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button 
              onClick={() => setSettings(prev => ({ ...prev, language: 'ko' }))}
              className={`py-3 rounded-xl font-bold text-xs transition-all ${settings.language === 'ko' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              한국어
            </button>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, language: 'en' }))}
              className={`py-3 rounded-xl font-bold text-xs transition-all ${settings.language === 'en' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              English
            </button>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, language: 'zh' }))}
              className={`py-3 rounded-xl font-bold text-xs transition-all ${settings.language === 'zh' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              中文
            </button>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, language: 'ja' }))}
              className={`py-3 rounded-xl font-bold text-xs transition-all ${settings.language === 'ja' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              日本語
            </button>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, language: 'es' }))}
              className={`py-3 rounded-xl font-bold text-xs transition-all ${settings.language === 'es' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              Español
            </button>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, language: 'vi' }))}
              className={`py-3 rounded-xl font-bold text-xs transition-all ${settings.language === 'vi' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              Tiếng Việt
            </button>
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-bell text-indigo-500"></i> {t.notificationSettings}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.defaultNotificationTime}</label>
              <input 
                type="number" 
                value={settings.defaultNotificationMinutes} 
                onChange={e => setSettings(prev => ({ ...prev, defaultNotificationMinutes: parseInt(e.target.value) || 0 }))}
                className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.notificationCount}</label>
              <input 
                type="number" 
                value={settings.notificationCount} 
                onChange={e => setSettings(prev => ({ ...prev, notificationCount: parseInt(e.target.value) || 0 }))}
                className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.notificationInterval}</label>
              <input 
                type="number" 
                value={settings.notificationInterval} 
                onChange={e => setSettings(prev => ({ ...prev, notificationInterval: parseInt(e.target.value) || 0 }))}
                className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50 space-y-4">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <h4 className="text-xs font-black text-indigo-700 mb-1 flex items-center gap-2">
                <i className="fa-solid fa-circle-info"></i> {t.testNotification}
              </h4>
              <p className="text-[10px] text-indigo-500 mb-3 leading-relaxed">
                {t.testNotificationDesc}
                <br />
                <span className="font-black text-indigo-600 underline">{t.pwaInstallNotice}</span>
              </p>
              <button 
                onClick={() => notificationService.showNotification('test-btn', '[AllNoti] Test', 'Notification is working correctly!', true)}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-black text-[10px] shadow-md active:scale-95 transition-all"
              >
                {t.testNotification}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-700">{t.regularNotificationTitle}</h4>
              <button 
                onClick={() => setSettings(prev => ({ ...prev, regularNotification: { ...prev.regularNotification, enabled: !prev.regularNotification.enabled } }))}
                className={`w-10 h-5 rounded-full transition-all relative ${settings.regularNotification.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.regularNotification.enabled ? 'left-6' : 'left-1'}`}></div>
              </button>
            </div>

            {settings.regularNotification.enabled && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.repeatDays}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <button
                        key={day}
                        onClick={() => {
                          const current = settings.regularNotification.days;
                          const next = current.includes(day) ? current.filter(d => d !== day) : [...current.filter(d => d !== 'all'), day];
                          setSettings(prev => ({ ...prev, regularNotification: { ...prev.regularNotification, days: next.length === 0 ? ['all'] : next } }));
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${settings.regularNotification.days.includes(day) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}
                      >
                        {t[day.toLowerCase()]}
                      </button>
                    ))}
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, regularNotification: { ...prev.regularNotification, days: ['all'] } }))}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${settings.regularNotification.days.includes('all') ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}
                    >
                      {t.allDays}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.repeatFrequency}</label>
                    <select 
                      value={settings.regularNotification.frequency}
                      onChange={e => setSettings(prev => ({ ...prev, regularNotification: { ...prev.regularNotification, frequency: e.target.value as any } }))}
                      className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs outline-none appearance-none"
                    >
                      <option value="daily">{t.daily}</option>
                      <option value="weekly">{t.weekly}</option>
                      <option value="monthly">{t.monthly}</option>
                      <option value="quarterly">{t.quarterly}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.repeatTime}</label>
                    <input 
                      type="time"
                      value={settings.regularNotification.time}
                      onChange={e => setSettings(prev => ({ ...prev, regularNotification: { ...prev.regularNotification, time: e.target.value } }))}
                      className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.notificationContent}</label>
                  <select 
                    value={settings.regularNotification.contentType}
                    onChange={e => setSettings(prev => ({ ...prev, regularNotification: { ...prev.regularNotification, contentType: e.target.value as any } }))}
                    className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs outline-none appearance-none"
                  >
                    <option value="all">{t.allTasks}</option>
                    <option value="overdue">{t.overdueTasksOnly}</option>
                    <option value="urgent">{t.urgentTasksOnly}</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-database text-indigo-500"></i> {t.backupRestore}
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={handleExportData}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
            >
              {t.backup}
            </button>
            <button 
              onClick={() => backupInputRef.current?.click()}
              className="flex-1 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
            >
              {t.restore}
            </button>
            <input type="file" ref={backupInputRef} onChange={handleImportData} className="hidden" />
          </div>
        </section>
      </div>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [view, setView] = useState<ViewType>('TASKS');
  const [settings, setSettings] = useState<AppSettings>(() => db.getSettings());
  const [tasks, setTasks] = useState<Task[]>(() => db.getTasks());
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>(() => workflowService.getAll());
  const [memos, setMemos] = useState<Memo[]>(() => db.getMemos());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => ({
    name: "User", tier: "FREE", aiCredits: 5, iconStyle: 'SOLID'
  }));

  const [addingSubTaskToTaskId, setAddingSubTaskToTaskId] = useState<string | null>(null);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');
  const [newSubTaskTime, setNewSubTaskTime] = useState('');

  const [memoContent, setMemoContent] = useState('');
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [matchingMemoId, setMatchingMemoId] = useState<string | null>(null);
  const [memoFilter, setMemoFilter] = useState<{taskId?: string, subTaskId?: string}>({});
  const [viewingMemosFor, setViewingMemosFor] = useState<{taskId: string, subTaskId?: string} | null>(null);
  const [highlightedMemoId, setHighlightedMemoId] = useState<string | null>(null);
  
  const t = translations[settings.language];

  const stats = useMemo(() => {
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    const allSubs = tasks.flatMap(t => t.subTasks.map(s => ({ 
      ...s, 
      parentTaskId: t.id,
      parentTitle: t.title,
      parentIcon: t.icon,
      isParentImportant: t.isImportant
    })));
    
    return {
      now,
      ongoingSubTasksCount: allSubs.filter(s => !s.isCompleted).length,
      ongoingMainTasksCount: tasks.filter(t => !t.isCompleted).length,
      totalCount: allSubs.length,
      completedCount: allSubs.filter(s => s.isCompleted).length,
      overdueCount: allSubs.filter(s => !s.isCompleted && new Date(s.scheduledTime).getTime() < now).length,
      urgentCount: allSubs.filter(s => !s.isCompleted && new Date(s.scheduledTime).getTime() >= now && new Date(s.scheduledTime).getTime() < now + twentyFourHours).length,
      allSubTasks: allSubs.sort((a,b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
    };
  }, [tasks]);

  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{type: 'TASK' | 'SUBTASK', tid: string, sid?: string} | null>(null);

  useEffect(() => {
    if (settings.isFirstLaunch) {
      setView('MANUAL');
      setSettings(prev => {
        const next = { ...prev, isFirstLaunch: false };
        db.saveSettings(next);
        return next;
      });
    }

    // Show permission guide if not granted
    if (notificationService.getPermissionStatus() === 'default') {
      setShowPermissionGuide(true);
    }
  }, []);

  useEffect(() => {
    db.saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    db.saveMemos(memos);
  }, [memos]);

  // Notification Scheduler
  useEffect(() => {
    const checkNotifications = () => {
      const now = Date.now();
      tasks.forEach(task => {
        if (task.isCompleted) return;
        task.subTasks.forEach(sub => {
          if (sub.isCompleted || !sub.isNotificationOn) return;
          
          const scheduledTime = new Date(sub.scheduledTime).getTime();
          
          // Multiple notifications logic
          for (let i = 0; i < settings.notificationCount; i++) {
            const triggerTime = scheduledTime - (settings.defaultNotificationMinutes * 60 * 1000) + (i * settings.notificationInterval * 60 * 1000);
            
            // If current time is past triggerTime but within a reasonable window (e.g. 10 minutes)
            // and we haven't sent this specific notification yet
            if (now >= triggerTime && now < triggerTime + 600000) {
              const notificationId = `${sub.id}-${i}`;
              notificationService.showNotification(
                notificationId,
                `[AllNoti] ${sub.title}`,
                `${task.title} - ${i + 1}/${settings.notificationCount} ${t.notificationSettings}`
              );
            }
          }
        });
      });
    };

    const interval = setInterval(checkNotifications, 30000); // Check every 30 seconds for better accuracy
    checkNotifications(); // Initial check
    
    return () => clearInterval(interval);
  }, [tasks, settings, t]);

  // Regular Notification Scheduler
  useEffect(() => {
    if (!settings.regularNotification.enabled) return;

    const checkRegularNotification = () => {
      const now = new Date();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDay = dayNames[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Check if current day is allowed
      const isDayAllowed = settings.regularNotification.days.includes('all') || settings.regularNotification.days.includes(currentDay);
      if (!isDayAllowed) return;

      const [targetH, targetM] = settings.regularNotification.time.split(':').map(Number);
      const targetDate = new Date(now);
      targetDate.setHours(targetH, targetM, 0, 0);
      const diff = now.getTime() - targetDate.getTime();

      // Check if current time is within 10 minutes after the target time
      if (diff < 0 || diff > 600000) return;

      // Frequency check (simplified: we use a unique ID for the period)
      let periodId = '';
      const year = now.getFullYear();
      const month = now.getMonth();
      const date = now.getDate();
      
      if (settings.regularNotification.frequency === 'daily') {
        periodId = `reg-${year}-${month}-${date}`;
      } else if (settings.regularNotification.frequency === 'weekly') {
        // Use week number or start of week
        const startOfWeek = new Date(now);
        startOfWeek.setDate(date - now.getDay());
        periodId = `reg-w-${year}-${startOfWeek.getMonth()}-${startOfWeek.getDate()}`;
      } else if (settings.regularNotification.frequency === 'monthly') {
        periodId = `reg-m-${year}-${month}`;
      } else if (settings.regularNotification.frequency === 'quarterly') {
        const quarter = Math.floor(month / 3);
        periodId = `reg-q-${year}-${quarter}`;
      }

      // Final check: content and send
      let body = '';
      if (settings.regularNotification.contentType === 'all') {
        body = `${t.ongoingTasks}: ${stats.ongoingMainTasksCount}`;
      } else if (settings.regularNotification.contentType === 'overdue') {
        body = `${t.overdueTasks}: ${stats.overdueCount}`;
      } else if (settings.regularNotification.contentType === 'urgent') {
        body = `${t.urgentTasks}: ${stats.urgentCount}`;
      }

      notificationService.showNotification(
        periodId,
        `[AllNoti] ${t.regularNotificationTitle}`,
        body
      );
    };

    const interval = setInterval(checkRegularNotification, 30000); // Check every 30 seconds
    checkRegularNotification();

    return () => clearInterval(interval);
  }, [settings.regularNotification, stats, t]);
  
  // Accordion state
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);

  // Individual SubTask Editing
  const [editingSubTask, setEditingSubTask] = useState<{tid: string, sid: string, time: string} | null>(null);

  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowTemplate | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [selectedWfId, setSelectedWfId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');
  const [isImportant, setIsImportant] = useState(false);
  const [wfName, setWfName] = useState('');
  const [wfIcon, setWfIcon] = useState<string>('fa-tasks');
  const [wfSteps, setWfSteps] = useState<Omit<WorkflowStep, 'id'>[]>([]);
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [generatedBrandIcon, setGeneratedBrandIcon] = useState<string | null>(null);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'days' | 'weeks' | 'months' | 'years' | 'weekday'>('days');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);

  const backupInputRef = useRef<HTMLInputElement>(null);
  const wfImportInputRef = useRef<HTMLInputElement>(null);
  const wfIconInputRef = useRef<HTMLInputElement>(null);

  // Swipe logic
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => { db.saveTasks(tasks); }, [tasks]);
  useEffect(() => { setWorkflows(workflowService.getAll()); }, [view]);

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    // Fix for Ghost Swipe: Reset touchEndX to touchStartX when a new touch begins
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const threshold = 100;
    const diff = touchStartX.current - touchEndX.current;
    
    const mainViews: ViewType[] = ['TASKS', 'SCHEDULE', 'WORKFLOWS', 'MEMO'];
    const currentIdx = mainViews.indexOf(view);
    
    if (currentIdx === -1) return;

    if (diff > threshold && currentIdx < mainViews.length - 1) {
      setView(mainViews[currentIdx + 1]);
    } else if (diff < -threshold && currentIdx > 0) {
      setView(mainViews[currentIdx - 1]);
    }
  };

  // Actions
  const toggleAccordion = (taskId: string) => {
    setExpandedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleExportSingleSubICS = (sub: SubTask, parentTitle: string) => {
    exportToICS([{
      title: `[AllNoti] ${sub.title} (${parentTitle})`,
      description: `${t.tasks}: ${parentTitle}\n${t.icsDescription}`,
      start: sub.scheduledTime
    }]);
  };

  const handleExportAllUncompletedICS = () => {
    const uncompleted = stats.allSubTasks.filter(s => !s.isCompleted);
    if (uncompleted.length === 0) return alert(t.noUncompletedTasks);
    
    exportToICS(uncompleted.map(s => ({
      title: `[AllNoti] ${s.title} (${(s as any).parentTitle})`,
      description: `${t.tasks}: ${(s as any).parentTitle}\n${t.integratedScheduleExport}`,
      start: s.scheduledTime
    })));
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'image/png') {
      if (file.size > 2 * 1024 * 1024) return alert(t.fileSizeError);
      const reader = new FileReader();
      reader.onload = (event) => setWfIcon(event.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file) {
      alert(t.pngOnlyError);
    }
  };

  const handleProFeatureClick = () => {
    alert(t.proFeatureNotice);
    return false;
  };

  // 주기적 반복 업무 날짜 계산 로직
  const calculateNextDate = (currentDateStr: string, recurrence: Task['recurrence']): string => {
    const date = new Date(currentDateStr);
    if (!recurrence) return currentDateStr;

    switch (recurrence.type) {
      case 'days':
        date.setDate(date.getDate() + (recurrence.value as number));
        break;
      case 'weeks':
        date.setDate(date.getDate() + (recurrence.value as number) * 7);
        break;
      case 'months':
        date.setMonth(date.getMonth() + (recurrence.value as number));
        break;
      case 'years':
        date.setFullYear(date.getFullYear() + (recurrence.value as number));
        break;
      case 'weekday':
        const targetDays = recurrence.value as string[];
        const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
        for (let i = 1; i <= 7; i++) {
          const nextDate = new Date(date);
          nextDate.setDate(date.getDate() + i);
          const nextDayName = Object.keys(dayMap).find(key => dayMap[key] === nextDate.getDay());
          if (nextDayName && targetDays.includes(nextDayName)) {
            return nextDate.toISOString();
          }
        }
        break;
    }
    return date.toISOString();
  };

  const createRecurringTaskInstance = (baseTask: Task): Task => {
    const nextDueDate = calculateNextDate(baseTask.dueDate, baseTask.recurrence);
    const mainDueDate = new Date(nextDueDate);
    const wf = workflows.find(w => w.name === baseTask.workflowId);
    const taskId = Date.now().toString() + "-rec";
    
    const subTasks: SubTask[] = (wf?.steps || []).map(step => ({
      id: Math.random().toString(36).substr(2,9),
      parentTaskId: taskId,
      title: step.title,
      scheduledTime: new Date(mainDueDate.getTime() - (step.hoursBefore * 60 * 60 * 1000)).toISOString(),
      isCompleted: false, isNotificationOn: true 
    }));

    return {
      ...baseTask,
      id: taskId,
      dueDate: nextDueDate,
      isCompleted: false,
      subTasks,
      createdAt: new Date().toISOString()
    };
  };

  const handleSaveTask = () => {
    if (!newTitle || !selectedWfId || !dueDate || !dueTime) return alert(t.inputAllFields);
    const wf = workflows.find(w => w.id === selectedWfId);
    if (!wf) return;
    
    const taskId = editingTask?.id || Date.now().toString();
    const mainDueDate = new Date(`${dueDate}T${dueTime}`);
    const subTasks: SubTask[] = wf.steps.map(step => ({
      id: Math.random().toString(36).substr(2,9),
      parentTaskId: taskId,
      title: step.title,
      scheduledTime: new Date(mainDueDate.getTime() - (step.hoursBefore * 60 * 60 * 1000)).toISOString(),
      isCompleted: false, isNotificationOn: true 
    }));

    const recurrence = isRecurring ? {
      type: recurrenceType,
      value: recurrenceType === 'weekday' ? selectedWeekdays : recurrenceInterval
    } : undefined;

    const newTask: Task = { 
        id: taskId, title: newTitle, workflowId: wf.name, icon: wf.icon, 
        dueDate: mainDueDate.toISOString(), isImportant, isCompleted: false, 
        subTasks, createdAt: editingTask?.createdAt || new Date().toISOString(),
        recurrence
    };

    if (editingTask) setTasks(prev => prev.map(t => t.id === editingTask.id ? newTask : t));
    else setTasks(prev => [newTask, ...prev]);
    setView('TASKS');
    resetTaskForm();
  };

  const handleUpdateSubTaskTime = (taskId: string, subId: string, newTimeISO: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subTasks: t.subTasks.map(s => s.id === subId ? { ...s, scheduledTime: newTimeISO } : s) } : t));
    setEditingSubTask(null);
  };

  const handleSaveWorkflow = () => {
    if (!wfName || wfSteps.length === 0) return alert(t.inputNameAndSteps);
    
    const sortedSteps = [...wfSteps].sort((a, b) => b.hoursBefore - a.hoursBefore);
    
    const newWf: WorkflowTemplate = { 
      id: editingWorkflow?.id || Date.now().toString(), 
      name: wfName, 
      icon: wfIcon, 
      steps: sortedSteps.map((s, i) => ({ ...s, id: i.toString() })) 
    };
    
    workflowService.save(newWf);
    setWorkflows(workflowService.getAll());
    setView('WORKFLOWS');
  };

  const resetTaskForm = () => { 
    setNewTitle(''); 
    setSelectedWfId(''); 
    setDueDate(''); 
    setDueTime('09:00'); 
    setIsImportant(false); 
    setEditingTask(null); 
    setIsRecurring(false);
    setRecurrenceType('days');
    setRecurrenceInterval(1);
    setSelectedWeekdays([]);
  };

  const handleToggleTask = (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;

    const nextCompleted = !target.isCompleted;

    if (nextCompleted) {
      if (target.recurrence) {
        // Recurring tasks: create next instance immediately and keep current as completed
        const nextTask = createRecurringTaskInstance(target);
        setTasks(prev => [
          nextTask,
          ...prev.map(t => t.id === id ? { ...t, isCompleted: true, subTasks: t.subTasks.map(s => ({ ...s, isCompleted: true })) } : t)
        ]);
        return;
      }
      setShowDeleteConfirm({ type: 'TASK', tid: id });
      return;
    }

    setTasks(prev => prev.map(t => t.id === id ? {
      ...t, 
      isCompleted: nextCompleted, 
      subTasks: t.subTasks.map(s => ({...s, isCompleted: nextCompleted}))
    } : t));
  };

  const confirmDelete = (tid: string, sid?: string) => {
    if (sid) {
      // Subtask deletion
      setTasks(prev => prev.map(t => t.id === tid ? { ...t, subTasks: t.subTasks.filter(s => s.id !== sid) } : t));
    } else {
      // Task deletion
      setTasks(prev => prev.filter(t => t.id !== tid));
    }
    setShowDeleteConfirm(null);
  };

  const keepCompleted = (tid: string, sid?: string) => {
    if (sid) {
      setTasks(prev => prev.map(t => t.id === tid ? { ...t, subTasks: t.subTasks.map(s => s.id === sid ? { ...s, isCompleted: true } : s) } : t));
    } else {
      const target = tasks.find(t => t.id === tid);
      if (target?.recurrence) {
        const nextTask = createRecurringTaskInstance(target);
        setTasks(prev => [
          nextTask,
          ...prev.map(t => t.id === tid ? { ...t, isCompleted: true, subTasks: t.subTasks.map(s => ({ ...s, isCompleted: true })) } : t)
        ]);
      } else {
        setTasks(prev => prev.map(t => t.id === tid ? { ...t, isCompleted: true, subTasks: t.subTasks.map(s => ({ ...s, isCompleted: true })) } : t));
      }
    }
    setShowDeleteConfirm(null);
  };

  const handleToggleAutoRepeat = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        if (t.recurrence) {
          const { recurrence, ...rest } = t;
          return rest as Task;
        }
      }
      return t;
    }));
  };

  const handleDeleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));
  
  const handleDeleteWorkflow = (id: string) => {
    const result = workflowService.delete(id, tasks);
    if (result.success) {
      setWorkflows(workflowService.getAll());
      if (editingWorkflow?.id === id) {
        setEditingWorkflow(null);
        setWfName('');
        setWfSteps([]);
      }
      setView('WORKFLOWS');
    } else {
      alert(result.message);
    }
  };
  
  const handleToggleSubTask = (tid: string, sid: string) => {
    const task = tasks.find(t => t.id === tid);
    if (!task) return;

    const subTask = task.subTasks.find(s => s.id === sid);
    if (!subTask) return;

    if (!subTask.isCompleted) {
      setShowDeleteConfirm({ type: 'SUBTASK', tid, sid });
      return;
    }

    setTasks(prev => prev.map(t => t.id === tid ? {
      ...t, 
      subTasks: t.subTasks.map(s => s.id === sid ? { ...s, isCompleted: false } : s), 
      isCompleted: false 
    } : t));
  };

  const handleAddSubTask = (taskId: string) => {
    setAddingSubTaskToTaskId(taskId);
    setNewSubTaskTitle('');
    setNewSubTaskTime(new Date().toISOString().slice(0, 16));
  };

  const confirmAddSubTask = () => {
    if (!addingSubTaskToTaskId || !newSubTaskTitle) return;

    const newSub: SubTask = {
      id: Math.random().toString(36).substr(2, 9),
      parentTaskId: addingSubTaskToTaskId,
      title: newSubTaskTitle,
      scheduledTime: new Date(newSubTaskTime).toISOString(),
      isCompleted: false,
      isNotificationOn: true
    };

    setTasks(prev => prev.map(t => t.id === addingSubTaskToTaskId ? { ...t, subTasks: [...t.subTasks, newSub] } : t));
    setAddingSubTaskToTaskId(null);
  };

  const handleToggleSubNotification = (tid: string, sid: string) => {
    setTasks(prev => prev.map(t => t.id === tid ? { ...t, subTasks: t.subTasks.map(s => s.id === sid ? {...s, isNotificationOn: !s.isNotificationOn} : s) } : t));
  };

  const handleSaveMemo = (taskId?: string, subTaskId?: string) => {
    if (!memoContent.trim()) return;

    const now = new Date().toISOString();
    if (editingMemoId) {
      setMemos(prev => prev.map(m => m.id === editingMemoId ? {
        ...m,
        content: memoContent,
        updatedAt: now
      } : m));
      setEditingMemoId(null);
    } else {
      const newMemo: Memo = {
        id: Date.now().toString(),
        content: memoContent,
        taskId,
        subTaskId,
        createdAt: now,
        updatedAt: now,
        color: ['bg-emerald-50', 'bg-teal-50', 'bg-cyan-50', 'bg-green-50'][Math.floor(Math.random() * 4)]
      };
      setMemos(prev => [newMemo, ...prev]);
    }
    setMemoContent('');
  };

  const handleDeleteMemo = (id: string) => {
    setMemos(prev => prev.filter(m => m.id !== id));
  };

  const handleMatchMemo = (memoId: string, taskId?: string, subTaskId?: string) => {
    setMemos(prev => prev.map(m => m.id === memoId ? {
      ...m,
      taskId: taskId || m.taskId,
      subTaskId: subTaskId || m.subTaskId,
      updatedAt: new Date().toISOString()
    } : m));
    setMatchingMemoId(null);
  };

  const handleExportData = () => {
    const data = { tasks, workflows, memos };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `allnoti_backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          if (content.tasks && content.workflows) { 
            setTasks(content.tasks); 
            db.saveWorkflows(content.workflows);
            setWorkflows(content.workflows);
            if (content.memos) setMemos(content.memos);
            alert(t.restoreSuccess); 
          }
        } catch (err) { alert(t.restoreFail); }
        e.target.value = '';
      };
      reader.readAsText(file);
    }
  };

  const handleExportSingleWf = (wf: WorkflowTemplate) => {
    const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${wf.name}.noti`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportSingleWf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const wf = JSON.parse(event.target?.result as string);
          if (wf.name && wf.steps) {
            workflowService.save({...wf, id: Date.now().toString()});
            setWorkflows(workflowService.getAll());
            alert(t.templateAdded);
          }
        } catch (err) { alert(t.templateFileError); }
        e.target.value = '';
      };
      reader.readAsText(file);
    }
  };

  return (
    <div 
      className={`w-full min-h-screen flex flex-col transition-all duration-300 ${view === 'TASKS' ? 'bg-slate-50' : 'bg-white'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 p-3 flex items-center shadow-sm h-[53px]">
        <div className="flex items-center gap-2">
          <h1 onClick={() => setView('TASKS')} className="text-lg font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent cursor-pointer">AllNoti</h1>
          <button onClick={() => setView('MEMO')} className="flex items-center px-1">
            <i className={`fa-solid fa-note-sticky text-xs text-emerald-500`}></i>
          </button>
        </div>
        
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
           <button onClick={() => { resetTaskForm(); setView('CREATE_TASK'); }} className="bg-indigo-600 text-white px-3 sm:px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black shadow-md shadow-indigo-100 active:scale-95 transition-all">{t.addTask}</button>
        </div>

        <div className="flex gap-1.5 items-center ml-auto">
           <div className="hidden xs:flex bg-indigo-50 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl items-center gap-1 sm:gap-2 border border-indigo-100">
              <span className="text-[9px] sm:text-[10px] font-black text-indigo-600 whitespace-nowrap">{t.ongoing}</span>
              <span className="bg-indigo-600 text-white text-[9px] sm:text-[10px] font-black min-w-[18px] sm:min-w-[20px] h-4.5 sm:h-5 px-1 rounded-md flex items-center justify-center">
                {stats.ongoingSubTasksCount}
              </span>
           </div>
           <button onClick={() => setView('MANUAL')} className="text-slate-400 p-2"><i className="fa-solid fa-circle-question text-base"></i></button>
           <button onClick={() => setView('SETTINGS')} className="text-slate-400 p-2"><i className="fa-solid fa-cog text-base"></i></button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto pb-28">
        {view === 'TASKS' && (
          <div className="animate-in fade-in duration-500">
            {/* Sticky Header Section */}
            <div className="sticky top-[53px] z-20 bg-white px-4 pb-2 border-b border-slate-100 shadow-sm">
              <div className="mt-2 bg-slate-50 p-4 rounded-[24px] border border-slate-100 flex items-center justify-between h-[80px]">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.projectActivity}</p>
                  <h2 className="text-lg font-black text-slate-800 leading-tight">
                    {stats.ongoingMainTasksCount > 0 ? `${t.ongoingTasks} ${stats.ongoingMainTasksCount}` : `${t.ongoingTasks} 0`}
                  </h2>
                  <p className="text-[9px] text-slate-400 font-bold">{t.waitingTasks} {stats.ongoingSubTasksCount}</p>
                </div>
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500"><i className="fa-solid fa-rocket text-base"></i></div>
              </div>

              <div className="flex justify-between items-center px-1 mt-3">
                <h3 className="text-lg font-black text-slate-800">{t.allTaskList}</h3>
                <div className="flex gap-1.5">
                  <button onClick={handleExportData} className="text-[9px] font-bold text-slate-400 border border-slate-200 px-2 py-1 rounded-lg">{t.backup}</button>
                  <button onClick={() => backupInputRef.current?.click()} className="text-[9px] font-bold text-indigo-600 border border-indigo-100 px-2 py-1 rounded-lg">{t.restore}</button>
                  <input type="file" ref={backupInputRef} onChange={handleImportData} className="hidden" />
                </div>
              </div>
            </div>

            {/* Scrollable List Section */}
            <div className="p-4 grid grid-cols-1 gap-4">
              {tasks.map(t => {
                const isExpanded = expandedTaskIds.includes(t.id);
                return (
                  <div key={t.id} className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all">
                    <div className="p-4 flex items-center gap-3 active:bg-slate-50 cursor-pointer" onClick={() => toggleAccordion(t.id)}>
                      <input type="checkbox" checked={t.isCompleted} onChange={(e) => { e.stopPropagation(); handleToggleTask(t.id); }} className="w-5 h-5 rounded-full border-slate-200 text-indigo-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {t.isImportant && <i className="fa-solid fa-star text-[10px] text-amber-500"></i>}
                          {t.recurrence && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleToggleAutoRepeat(t.id); }}
                              className="text-indigo-500 hover:text-indigo-700 transition-colors"
                              title={translations[settings.language].autoRepeatActive}
                            >
                              <i className="fa-solid fa-arrows-rotate text-[10px]"></i>
                            </button>
                          )}
                          <h3 className={`text-base font-black truncate ${t.isCompleted ? 'line-through text-slate-300' : t.isImportant ? 'text-rose-600' : 'text-slate-800'}`}>{t.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] text-slate-400 font-bold">{t.deadline}: {formatToLocalValue(t.dueDate).date}</span>
                           <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-md font-black">{t.subTasks.length}{translations[settings.language].step}</span>
                        </div>
                      </div>
                      <i className={`fa-solid fa-chevron-down text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-50/50 border-t border-slate-100 p-4 space-y-3 animate-in slide-in-from-top-2">
                        {t.subTasks.map(s => (
                          <div key={s.id} className="flex items-center gap-3 pl-2">
                             <input type="checkbox" checked={s.isCompleted} onChange={() => handleToggleSubTask(t.id, s.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-500" />
                             <div className="flex-1 min-w-0" onClick={() => setEditingSubTask({tid: t.id, sid: s.id, time: s.scheduledTime})}>
                                <p className={`text-xs font-bold ${s.isCompleted ? 'line-through text-slate-300' : 'text-slate-600'}`}>{s.title}</p>
                                <p className="text-[9px] text-slate-400 flex items-center gap-1">
                                  {new Date(s.scheduledTime).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                                  <i className="fa-solid fa-pen text-[8px] opacity-50"></i>
                                </p>
                             </div>
                             <div className="flex items-center gap-1">
                                <button onClick={() => setViewingMemosFor({taskId: t.id, subTaskId: s.id})} className="flex items-center gap-1 px-2 py-1 rounded-lg text-emerald-900 bg-emerald-50/50">
                                  <i className="fa-solid fa-note-sticky text-[10px] text-emerald-900"></i>
                                  <span className="text-[9px] font-black">{t.memo}</span>
                                </button>
                                <button onClick={() => setEditingSubTask({tid: t.id, sid: s.id, time: s.scheduledTime})} className="flex items-center gap-1 px-2 py-1 rounded-lg text-indigo-900 bg-indigo-50/50">
                                  <i className="fa-solid fa-pen text-[10px] text-indigo-900"></i>
                                  <span className="text-[9px] font-black">{t.edit}</span>
                                </button>
                                <button onClick={() => setShowDeleteConfirm({ type: 'SUBTASK', tid: t.id, sid: s.id })} className="flex items-center gap-1 px-2 py-1 rounded-lg text-rose-900 bg-rose-50/50">
                                  <i className="fa-solid fa-trash-can text-[10px] text-rose-900"></i>
                                  <span className="text-[9px] font-black">{t.delete}</span>
                                </button>
                                <button onClick={() => handleToggleSubNotification(t.id, s.id)} className={`p-1.5 rounded-lg ${s.isNotificationOn ? 'text-indigo-500' : 'text-slate-200'}`}><i className="fa-solid fa-bell text-[10px]"></i></button>
                             </div>
                          </div>
                        ))}
                        <button onClick={() => handleAddSubTask(t.id)} className="w-full py-2 border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 rounded-lg hover:bg-white transition-colors">
                          + {translations[settings.language].addSubTask}
                        </button>
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                          <button onClick={() => setViewingMemosFor({taskId: t.id})} className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-1.5 rounded-md flex items-center gap-1">
                            <i className="fa-solid fa-note-sticky text-emerald-700"></i>
                            {t.memo}
                          </button>
                          <button onClick={() => { 
                            setEditingTask(t); 
                            setNewTitle(t.title); 
                            setSelectedWfId(workflows.find(w=>w.name===t.workflowId)?.id || ''); 
                            const local = formatToLocalValue(t.dueDate);
                            setDueDate(local.date);
                            setDueTime(local.time);
                            setIsImportant(t.isImportant); 
                            setIsRecurring(!!t.recurrence);
                            if (t.recurrence) {
                              setRecurrenceType(t.recurrence.type);
                              if (t.recurrence.type === 'weekday') setSelectedWeekdays(t.recurrence.value as string[]);
                              else setRecurrenceInterval(t.recurrence.value as number);
                            }
                            setView('CREATE_TASK'); 
                          }} className="text-[10px] font-black text-indigo-800 bg-indigo-50 px-2 py-1.5 rounded-md flex items-center gap-1">
                            <i className="fa-solid fa-pen text-indigo-700"></i>
                            {t.edit}
                          </button>
                          <button onClick={() => handleDeleteTask(t.id)} className="text-[10px] font-black text-rose-800 bg-rose-50 px-2 py-1.5 rounded-md flex items-center gap-1">
                            <i className="fa-solid fa-trash-can text-rose-700"></i>
                            {t.delete}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {tasks.length === 0 && <div className="col-span-full h-40 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[24px]"><i className="fa-solid fa-folder-open text-3xl mb-2"></i><p className="text-xs">{t.noTasks}</p></div>}
            </div>
          </div>
        )}

        {view === 'SCHEDULE' && (
          <div className="animate-in fade-in duration-500">
            {/* Sticky Header Section */}
            <div className="sticky top-[53px] z-20 bg-white px-4 pb-2 border-b border-slate-100 shadow-sm">
               <div className="grid grid-cols-3 gap-2.5 h-[80px] mb-3 mt-2">
                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 text-center flex flex-col justify-center"><span className="text-[15px] font-black text-slate-400 uppercase">{t.totalProgress}</span><p className="text-2xl font-black text-indigo-600 leading-none mt-1">{stats.completedCount}/{stats.totalCount}</p></div>
                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 text-center flex flex-col justify-center"><span className="text-[15px] font-black text-rose-400 uppercase">{t.overdueTasks}</span><p className="text-2xl font-black text-rose-500 leading-none mt-1">{stats.overdueCount}</p></div>
                  <div className="bg-indigo-600 p-2 rounded-2xl text-center flex flex-col justify-center"><span className="text-[15px] font-black text-indigo-200 uppercase">{t.urgentTasks}</span><p className="text-2xl font-black text-white leading-none mt-1">{stats.urgentCount}</p></div>
               </div>

               <div className="flex justify-between items-center px-1">
                 <h2 className="text-lg font-black text-slate-800">{t.integratedSchedule}</h2>
                 <button onClick={handleExportAllUncompletedICS} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black"><i className="fa-solid fa-calendar-days"></i>{t.exportAll}</button>
               </div>
            </div>

            {/* Scrollable List Section */}
            <div className="p-4 grid grid-cols-1 gap-3">
               {stats.allSubTasks.map(sub => {
                 const isOverdue = !sub.isCompleted && new Date(sub.scheduledTime).getTime() < stats.now;
                 const isParentImp = (sub as any).isParentImportant;
                 const formatted = new Date(sub.scheduledTime).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
                 return (
                   <div key={sub.id} className={`bg-white p-4 rounded-xl border ${isOverdue ? 'border-rose-200 shadow-[0_4px_12px_-4px_rgba(244,63,94,0.2)]' : 'border-slate-100 shadow-sm'} flex flex-col gap-2.5 group transition-all`}>
                     <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-black truncate max-w-[50%] ${sub.isCompleted ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                          {sub.title}
                        </p>
                        <span className={`text-[10px] font-bold truncate ${isParentImp ? 'text-rose-600' : 'text-slate-400'}`}>
                          - {(sub as any).parentTitle}
                        </span>
                        {isOverdue && (
                          <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded ml-auto animate-pulse">
                            {t.overdue}
                          </span>
                        )}
                     </div>
                     <div className="flex items-center gap-2 border-t border-slate-50 pt-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isOverdue ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'}`}>
                          {renderIcon((sub as any).parentIcon, "w-3.5 h-3.5")}
                        </div>
                        <div 
                          onClick={() => setEditingSubTask({tid: sub.parentTaskId, sid: sub.id, time: sub.scheduledTime})}
                          className="flex-1 text-[11px] font-black text-slate-600 uppercase bg-slate-50 border border-slate-100 rounded px-3 py-2 cursor-pointer hover:border-indigo-200 transition-all flex items-center justify-between"
                        >
                          {formatted}
                          <i className="fa-solid fa-clock-rotate-left text-[10px] opacity-40"></i>
                        </div>
                        <button onClick={() => handleExportSingleSubICS(sub, (sub as any).parentTitle)} className="w-8 h-8 flex items-center justify-center text-blue-400 hover:bg-blue-50 rounded-lg shrink-0">
                           <i className="fa-regular fa-calendar-plus text-sm"></i>
                        </button>
                        <button onClick={() => setViewingMemosFor({taskId: sub.parentTaskId, subTaskId: sub.id})} className="w-8 h-8 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 rounded-lg shrink-0">
                           <i className="fa-solid fa-note-sticky text-sm"></i>
                        </button>
                        <button onClick={() => handleToggleSubNotification(sub.parentTaskId, sub.id)} className={`w-8 h-8 flex items-center justify-center rounded-lg shrink-0 ${sub.isNotificationOn ? 'text-indigo-500 bg-indigo-50' : 'text-slate-200'}`}>
                           <i className="fa-solid fa-bell text-sm"></i>
                        </button>
                        <input type="checkbox" checked={sub.isCompleted} onChange={() => handleToggleSubTask(sub.parentTaskId, sub.id)} className="w-5 h-5 rounded-full border-2 border-slate-200 text-indigo-500 cursor-pointer shrink-0" />
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>
        )}

        {view === 'WORKFLOWS' && (
          <div className="animate-in fade-in duration-500">
            {/* Sticky Header Section */}
            <div className="sticky top-[53px] z-20 bg-white px-4 pb-2 border-b border-slate-100 shadow-sm">
               <div className="mt-2 flex gap-2">
                  <button 
                    onClick={() => { setEditingWorkflow(null); setWfName(''); setWfIcon('fa-tasks'); setWfSteps([]); setView('CREATE_WORKFLOW'); }} 
                    className="flex-1 py-4 bg-purple-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-plus-circle text-lg"></i>{t.newWorkflow}
                  </button>
                  <button onClick={() => wfImportInputRef.current?.click()} className="px-4 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 flex items-center justify-center">
                    <i className="fa-solid fa-file-import"></i>
                  </button>
                  <input type="file" ref={wfImportInputRef} onChange={handleImportSingleWf} accept=".noti,.json" className="hidden" />
               </div>
            </div>

            {/* Scrollable List Section */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {workflows.map(wf => (
                <div key={wf.id} className="bg-white rounded-xl p-3.5 border border-slate-100 flex items-center justify-between group active:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 overflow-hidden" onClick={() => { setEditingWorkflow(wf); setWfName(wf.name); setWfIcon(wf.icon || 'fa-tasks'); setWfSteps(wf.steps); setView('CREATE_WORKFLOW'); }}>
                    <div className="w-9 h-9 flex items-center justify-center bg-purple-50 text-purple-500 rounded-lg">
                      {renderIcon(wf.icon, "w-4.5 h-4.5")}
                    </div>
                    <div className="cursor-pointer overflow-hidden">
                      <h4 className="text-sm font-black text-slate-700 truncate">{wf.name}</h4>
                      <p className="text-[9px] text-slate-400">{wf.steps.length}{translations[settings.language].step}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); handleExportSingleWf(wf); }} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-indigo-500 transition-colors"><i className="fa-solid fa-file-export text-xs"></i></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }} className="w-8 h-8 flex items-center justify-center text-rose-300 hover:text-rose-500 transition-colors">
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'MEMO' && (
          <div className="animate-in fade-in duration-500">
            {/* Sticky Header Section */}
            <div className="sticky top-[53px] z-20 bg-white px-4 pb-2 border-b border-slate-100 shadow-sm">
               <div className="mt-2 flex flex-col gap-2">
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <textarea 
                      value={memoContent}
                      onChange={e => setMemoContent(e.target.value)}
                      placeholder={t.memoPlaceholder}
                      className="w-full bg-transparent border-none outline-none text-sm font-bold text-emerald-900 placeholder:text-emerald-300 resize-none min-h-[80px]"
                    />
                    <div className="flex justify-end mt-2">
                      <button 
                        onClick={() => handleSaveMemo()}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
                      >
                        {t.save}
                      </button>
                    </div>
                  </div>
               </div>
            </div>

            {/* Scrollable List Section */}
            <div className="p-4 grid grid-cols-1 gap-4">
              {memos.map(memo => {
                const linkedTask = tasks.find(t => t.id === memo.taskId);
                const linkedSubTask = linkedTask?.subTasks.find(s => s.id === memo.subTaskId);
                
                return (
                  <div 
                    key={memo.id} 
                    id={`memo-${memo.id}`}
                    className={`${memo.color || 'bg-white'} rounded-2xl p-4 border ${highlightedMemoId === memo.id ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-100'} shadow-sm flex flex-col gap-3 transition-all`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{memo.content}</p>
                        <p className="text-[9px] text-slate-400 mt-2">{new Date(memo.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setMemoContent(memo.content); setEditingMemoId(memo.id); }} className="p-2 text-slate-400 hover:text-indigo-500"><i className="fa-solid fa-pen text-xs"></i></button>
                        <button onClick={() => handleDeleteMemo(memo.id)} className="p-2 text-slate-400 hover:text-rose-500"><i className="fa-solid fa-trash-can text-xs"></i></button>
                      </div>
                    </div>
                    
                    {(linkedTask || linkedSubTask) && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/50">
                        {linkedTask && (
                          <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-lg border border-white/20">
                            <i className="fa-solid fa-project-diagram text-[8px] text-emerald-600"></i>
                            <span className="text-[9px] font-black text-emerald-800">{linkedTask.title}</span>
                          </div>
                        )}
                        {linkedSubTask && (
                          <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-lg border border-white/20">
                            <i className="fa-solid fa-check-double text-[8px] text-emerald-600"></i>
                            <span className="text-[9px] font-black text-emerald-800">{linkedSubTask.title}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button 
                        onClick={() => setMatchingMemoId(memo.id)}
                        className="text-[9px] font-black text-emerald-600 bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-white transition-all"
                      >
                        <i className="fa-solid fa-link mr-1"></i>{t.matchTask}
                      </button>
                    </div>
                  </div>
                );
              })}
              {memos.length === 0 && (
                <div className="h-40 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[24px]">
                  <i className="fa-solid fa-note-sticky text-3xl mb-2"></i>
                  <p className="text-xs">{t.noMemos}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'MANUAL' && <div className="p-4"><ManualView setView={setView} t={t} /></div>}
        {view === 'SETTINGS' && (
          <div className="p-4">
            <SettingsView 
              settings={settings} 
              setSettings={setSettings} 
              t={t} 
              handleExportData={handleExportData}
              handleImportData={handleImportData}
              backupInputRef={backupInputRef}
            />
          </div>
        )}
        
        {view === 'CREATE_TASK' && (
          <div className="max-w-xl mx-auto bg-white p-6 mt-4 rounded-[32px] shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-6 duration-500 mx-4">
             <h2 className="text-xl font-black text-slate-800 mb-6">{editingTask ? t.edit : t.addTask}</h2>
             <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.taskTitle}</label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t.taskTitle} className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.selectTemplate}</label>
                  <select value={selectedWfId} onChange={e => setSelectedWfId(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none">
                    <option value="">{t.selectTemplate}</option>
                    {workflows.map(wf => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.deadline}</label>
                  <div className="flex gap-2">
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="flex-1 p-4 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none" />
                    <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="w-32 p-4 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none" />
                  </div>
                </div>

                <div>
                  <button onClick={() => setIsRecurring(!isRecurring)} className={`w-full py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 mb-2 ${isRecurring ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                    <i className="fa-solid fa-arrows-rotate"></i> {isRecurring ? t.recurringSettingActive : t.recurringSetting}
                  </button>
                  
                  {isRecurring && (
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3 mb-4 animate-in zoom-in-95">
                      <div>
                        <label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">{t.recurringType}</label>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            {id: 'days', label: t.daily},
                            {id: 'weeks', label: t.weekly},
                            {id: 'months', label: t.monthly},
                            {id: 'years', label: t.year}
                          ].map(type => (
                            <button
                              key={type.id}
                              onClick={() => setRecurrenceType(type.id as any)}
                              className={`py-2 rounded-lg text-[10px] font-black transition-all ${recurrenceType === type.id ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-400 border border-indigo-100'}`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">{t.recurringInterval}</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="1" 
                            value={recurrenceInterval} 
                            onChange={e => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                            className="flex-1 p-2 rounded-lg bg-white border border-indigo-100 text-sm font-bold outline-none text-indigo-600"
                          />
                          <span className="text-xs font-bold text-indigo-400">
                            {recurrenceType === 'days' ? t.day : recurrenceType === 'weeks' ? t.week : recurrenceType === 'months' ? t.month : t.year}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                  <input type="checkbox" id="imp-check" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-indigo-600" />
                  <label htmlFor="imp-check" className="text-sm font-bold text-slate-700 cursor-pointer flex-1">{t.importantTaskCheck}</label>
                  {isImportant && <i className="fa-solid fa-star text-amber-500 animate-pulse"></i>}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setView('TASKS')} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-sm active:scale-95 transition-all">{t.cancel}</button>
                  <button onClick={handleSaveTask} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all">{t.saveTask}</button>
                </div>
             </div>
          </div>
        )}

        {view === 'CREATE_WORKFLOW' && (
          <div className="max-w-xl mx-auto bg-white p-6 mt-4 rounded-[32px] shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-6 duration-500 mx-4">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-black text-slate-800">{editingWorkflow ? t.edit : t.addWorkflow}</h2>
               {editingWorkflow && (
                 <button onClick={() => handleDeleteWorkflow(editingWorkflow.id)} className="text-rose-500 text-[10px] font-black bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors">
                   {t.delete}
                 </button>
               )}
             </div>
             
             <div className="space-y-5">
                <div className="flex flex-col items-center gap-4 py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center text-purple-600 text-2xl overflow-hidden border-2 border-white">
                    {renderIcon(wfIcon, "w-10 h-10")}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      <button onClick={() => wfIconInputRef.current?.click()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all">
                        <i className="fa-solid fa-upload mr-2"></i>{t.registerIcon} (PNG)
                      </button>
                    </div>
                    <input type="file" ref={wfIconInputRef} onChange={handleIconUpload} accept="image/png" className="hidden" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.workflowName}</label>
                    <input value={wfName} onChange={e => setWfName(e.target.value)} placeholder={t.workflowName} className="w-full p-4 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-indigo-100" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.workflowSteps}</label>
                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {wfSteps.map((s, i) => {
                      const days = Math.floor(s.hoursBefore / 24);
                      const hours = s.hoursBefore % 24;
                      return (
                        <div key={i} className="bg-slate-50 p-3 rounded-xl flex flex-col gap-3 animate-in slide-in-from-right-2 border border-slate-100">
                          <div className="flex items-center gap-2">
                             <input value={s.title} onChange={e => { const n = [...wfSteps]; n[i].title = e.target.value; setWfSteps(n); }} placeholder={t.workflowSteps} className="flex-1 bg-transparent text-xs font-black outline-none border-b border-transparent focus:border-indigo-300 py-1" />
                             <button onClick={() => setWfSteps(wfSteps.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500 p-1"><i className="fa-solid fa-xmark"></i></button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">{t.scheduledTime}:</span>
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                              <input type="number" min="0" value={days} onChange={e => { 
                                const val = parseInt(e.target.value) || 0;
                                const n = [...wfSteps]; n[i].hoursBefore = (val * 24) + hours; setWfSteps(n); 
                              }} className="w-8 text-center text-[10px] font-black outline-none" />
                              <span className="text-[9px] font-bold text-slate-500">{translations[settings.language].days}</span>
                            </div>
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                              <input type="number" min="0" max="23" value={hours} onChange={e => { 
                                const val = parseInt(e.target.value) || 0;
                                const n = [...wfSteps]; n[i].hoursBefore = (days * 24) + val; setWfSteps(n); 
                              }} className="w-8 text-center text-[10px] font-black outline-none" />
                              <span className="text-[9px] font-bold text-slate-500">{translations[settings.language].hoursBefore}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => setWfSteps([...wfSteps, {title: '', hoursBefore: 0}])} className="w-full mt-3 py-3 border-2 border-dashed border-slate-100 text-slate-400 text-xs font-bold hover:bg-slate-50 rounded-xl transition-all">+ {t.addStep}</button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => setView('WORKFLOWS')} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-sm active:scale-95 transition-all">{t.cancel}</button>
                  <button onClick={handleSaveWorkflow} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all">{t.saveWorkflow}</button>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Viewing Memos Modal */}
      {viewingMemosFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-note-sticky text-emerald-500"></i>
              {viewingMemosFor.subTaskId ? t.memosForThisSubTask : t.memosForThisTask}
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {memos.filter(m => 
                m.taskId === viewingMemosFor.taskId && 
                (!viewingMemosFor.subTaskId || m.subTaskId === viewingMemosFor.subTaskId)
              ).map(memo => (
                <div 
                  key={memo.id} 
                  onClick={() => {
                    setView('MEMO');
                    setViewingMemosFor(null);
                    setHighlightedMemoId(memo.id);
                    setTimeout(() => {
                      const el = document.getElementById(`memo-${memo.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      setTimeout(() => setHighlightedMemoId(null), 2000);
                    }, 500);
                  }}
                  className={`${memo.color || 'bg-slate-50'} p-3 rounded-xl border border-slate-100 cursor-pointer hover:scale-[1.02] transition-all`}
                >
                  <p className="text-xs font-bold text-slate-700 line-clamp-3">{memo.content}</p>
                  <p className="text-[8px] text-slate-400 mt-1">{new Date(memo.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {memos.filter(m => 
                m.taskId === viewingMemosFor.taskId && 
                (!viewingMemosFor.subTaskId || m.subTaskId === viewingMemosFor.subTaskId)
              ).length === 0 && (
                <div className="py-10 text-center">
                  <i className="fa-solid fa-note-sticky text-2xl text-slate-200 mb-2"></i>
                  <p className="text-[10px] font-bold text-slate-400">{t.noMemos}</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="bg-emerald-50 p-3 rounded-xl mb-3">
                <textarea 
                  value={memoContent}
                  onChange={e => setMemoContent(e.target.value)}
                  placeholder={t.memoPlaceholder}
                  className="w-full bg-transparent border-none outline-none text-[11px] font-bold text-emerald-900 placeholder:text-emerald-300 resize-none h-16"
                />
                <div className="flex justify-end mt-1">
                  <button 
                    onClick={() => handleSaveMemo(viewingMemosFor.taskId, viewingMemosFor.subTaskId)}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-md active:scale-95 transition-all"
                  >
                    {t.save}
                  </button>
                </div>
              </div>
              <button 
                onClick={() => { setViewingMemosFor(null); setMemoContent(''); }}
                className="w-full py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-xs active:scale-95 transition-all"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memo Matching Modal */}
      {matchingMemoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-link text-emerald-500"></i>
              {t.matchTask}
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {tasks.map(task => (
                <div key={task.id} className="space-y-1">
                  <button 
                    onClick={() => handleMatchMemo(matchingMemoId, task.id)}
                    className="w-full p-3 text-left bg-slate-50 hover:bg-emerald-50 rounded-xl transition-all flex items-center justify-between group"
                  >
                    <span className="text-xs font-black text-slate-700 group-hover:text-emerald-700">{task.title}</span>
                    <i className="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
                  </button>
                  <div className="pl-4 space-y-1">
                    {task.subTasks.map(sub => (
                      <button 
                        key={sub.id}
                        onClick={() => handleMatchMemo(matchingMemoId, task.id, sub.id)}
                        className="w-full p-2 text-left bg-white border border-slate-100 hover:border-emerald-200 rounded-lg transition-all flex items-center justify-between group"
                      >
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-600">{sub.title}</span>
                        <i className="fa-solid fa-plus text-[8px] text-slate-200"></i>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setMatchingMemoId(null)}
              className="w-full mt-6 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-sm active:scale-95 transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* Add SubTask Modal */}
      {addingSubTaskToTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-plus-circle text-indigo-500"></i>
              {t.addSubTask}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.taskTitle}</label>
                <input 
                  value={newSubTaskTitle} 
                  onChange={e => setNewSubTaskTitle(e.target.value)} 
                  placeholder={t.taskTitle} 
                  className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.scheduledTime}</label>
                <input 
                  type="datetime-local" 
                  value={newSubTaskTime} 
                  onChange={e => setNewSubTaskTime(e.target.value)} 
                  className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold text-sm outline-none" 
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setAddingSubTaskToTaskId(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                {t.cancel}
              </button>
              <button 
                onClick={confirmAddSubTask}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SubTask Time Editing Modal */}
      {editingSubTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-clock text-indigo-500"></i>
              {t.updateTime}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 mb-6 uppercase tracking-wider">{t.newTimeDesc}</p>
            <input 
              type="datetime-local" 
              value={formatToLocalValue(editingSubTask.time).dateTime}
              onChange={(e) => setEditingSubTask({...editingSubTask, time: new Date(e.target.value).toISOString()})}
              className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black text-slate-700 mb-6 outline-none focus:ring-2 ring-indigo-100" 
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setEditingSubTask(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                {t.close}
              </button>
              <button 
                onClick={() => handleUpdateSubTaskTime(editingSubTask.tid, editingSubTask.sid, editingSubTask.time)}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                {t.updateComplete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 z-30 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto w-full px-2 py-3 flex justify-around items-center">
          <button onClick={() => setView('TASKS')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'TASKS' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}><i className="fa-solid fa-house-chimney text-lg"></i><span className="text-[9px] font-black uppercase">{t.tasks}</span></button>
          <button onClick={() => setView('SCHEDULE')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'SCHEDULE' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}><i className="fa-solid fa-calendar-check text-lg"></i><span className="text-[9px] font-black uppercase">{t.schedule}</span></button>
          <button onClick={() => setView('WORKFLOWS')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'WORKFLOWS' ? 'text-purple-600 scale-110' : 'text-slate-300'}`}><i className="fa-solid fa-layer-group text-lg"></i><span className="text-[9px] font-black uppercase">{t.workflows}</span></button>
          <button onClick={() => setView('MEMO')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'MEMO' ? 'text-emerald-600 scale-110' : 'text-slate-300'}`}><i className="fa-solid fa-note-sticky text-lg"></i><span className="text-[9px] font-black uppercase">{t.memo}</span></button>
        </div>
      </footer>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-check text-2xl"></i>
            </div>
            <h3 className="text-lg font-black text-slate-800 text-center mb-2">{t.completed}</h3>
            <p className="text-sm text-slate-500 text-center mb-6">{t.deleteConfirm}</p>
            <div className="flex gap-2">
              <button 
                onClick={() => keepCompleted(showDeleteConfirm.tid, showDeleteConfirm.sid)}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                {t.no}
              </button>
              <button 
                onClick={() => confirmDelete(showDeleteConfirm.tid, showDeleteConfirm.sid)}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                {t.yes}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Guide Modal */}
      {showPermissionGuide && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-bell text-2xl"></i>
            </div>
            <h3 className="text-lg font-black text-slate-800 text-center mb-2">{t.notificationPermissionTitle}</h3>
            <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed">{t.notificationPermissionDesc}</p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={async () => {
                  const granted = await notificationService.requestPermission();
                  if (granted) {
                    setShowPermissionGuide(false);
                    // Immediate onboarding notification
                    notificationService.showNotification(
                      'onboarding',
                      t.onboardingTitle,
                      t.onboardingDesc
                    );
                  }
                }}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                {t.allow}
              </button>
              <button 
                onClick={() => setShowPermissionGuide(false)}
                className="w-full py-4 bg-slate-100 text-slate-400 rounded-xl font-black text-sm active:scale-95 transition-all"
              >
                {t.later}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

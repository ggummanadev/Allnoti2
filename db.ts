
import { Task, WorkflowTemplate, AppSettings, Memo } from './types';
import { INITIAL_WORKFLOWS } from './constants';

const KEYS = {
  TASKS: 'swr_tasks',
  WORKFLOWS: 'swr_workflows',
  SETTINGS: 'swr_settings',
  MEMOS: 'swr_memos',
  SENT_NOTIFICATIONS: 'swr_sent_notifications'
};

const DEFAULT_SETTINGS: AppSettings = {
  language: 'ko',
  defaultNotificationMinutes: 15,
  notificationCount: 3,
  notificationInterval: 5,
  isFirstLaunch: true,
  regularNotification: {
    enabled: false,
    days: ['all'],
    frequency: 'daily',
    time: '09:00',
    contentType: 'all'
  }
};

export const db = {
  getTasks: (): Task[] => {
    const data = localStorage.getItem(KEYS.TASKS);
    return data ? JSON.parse(data) : [];
  },
  saveTasks: (tasks: Task[]) => {
    localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
  },
  getWorkflows: (): WorkflowTemplate[] => {
    const data = localStorage.getItem(KEYS.WORKFLOWS);
    return data ? JSON.parse(data) : INITIAL_WORKFLOWS;
  },
  saveWorkflows: (workflows: WorkflowTemplate[]) => {
    localStorage.setItem(KEYS.WORKFLOWS, JSON.stringify(workflows));
  },
  getSettings: (): AppSettings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    const settings = data ? JSON.parse(data) : DEFAULT_SETTINGS;
    // Deep merge or at least ensure regularNotification exists
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      regularNotification: {
        ...DEFAULT_SETTINGS.regularNotification,
        ...(settings.regularNotification || {})
      }
    };
  },
  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },
  getMemos: (): Memo[] => {
    const data = localStorage.getItem(KEYS.MEMOS);
    return data ? JSON.parse(data) : [];
  },
  saveMemos: (memos: Memo[]) => {
    localStorage.setItem(KEYS.MEMOS, JSON.stringify(memos));
  },
  getSentNotifications: (): string[] => {
    const data = localStorage.getItem(KEYS.SENT_NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  },
  saveSentNotifications: (ids: string[]) => {
    localStorage.setItem(KEYS.SENT_NOTIFICATIONS, JSON.stringify(ids));
  }
};

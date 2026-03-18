
export interface WorkflowStep {
  id: string;
  title: string;
  hoursBefore: number; // 1 to 720
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  icon?: string; // FontAwesome 클래스명 또는 base64 이미지 데이터
  steps: WorkflowStep[];
}

export interface SubTask {
  id: string;
  parentTaskId: string;
  title: string;
  scheduledTime: string; // ISO string
  isCompleted: boolean;
  isNotificationOn: boolean;
}

export interface Task {
  id: string;
  title: string;
  workflowId: string;
  icon?: string; // 워크플로우 아이콘 복사본
  dueDate: string; // ISO string
  isImportant: boolean;
  isCompleted: boolean;
  subTasks: SubTask[];
  createdAt: string;
  recurrence?: {
    type: 'days' | 'weeks' | 'months' | 'years' | 'weekday';
    value: number | string[]; // 일/주/월/년은 숫자, 요일은 ['Mon', 'Tue'...]
  };
}

export interface UserProfile {
  name: string;
  tier: 'FREE' | 'PRO';
  aiCredits: number;
  iconStyle: 'SOLID' | 'DUOTONE' | 'MINIMAL';
}

export type Language = 'ko' | 'en' | 'zh' | 'ja' | 'es' | 'vi';

export interface RegularNotificationSettings {
  enabled: boolean;
  days: string[]; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] or ['all']
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: string; // 'HH:mm'
  contentType: 'all' | 'overdue' | 'urgent';
}

export interface AppSettings {
  language: Language;
  defaultNotificationMinutes: number; // default 15
  notificationCount: number; // default 3
  notificationInterval: number; // default 5 (minutes)
  isFirstLaunch: boolean;
  regularNotification: RegularNotificationSettings;
}

export interface Memo {
  id: string;
  content: string;
  taskId?: string;
  subTaskId?: string;
  createdAt: string;
  updatedAt: string;
  color?: string;
}

export type ViewType = 'TASKS' | 'SCHEDULE' | 'WORKFLOWS' | 'MEMO' | 'CREATE_TASK' | 'CREATE_WORKFLOW' | 'MANUAL' | 'PRICING' | 'SETTINGS';

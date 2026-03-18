
import { db } from '../db';

// Track sent notifications to avoid duplicates
let sentNotifications = new Set<string>();

// Initialize from DB
try {
  const history = db.getSentNotifications();
  sentNotifications = new Set(history);
} catch (e) {
  console.error("Failed to load notification history:", e);
}

const ICON_URL = 'https://github.com/ggummanadev/privacy/blob/main/icon-512x512.png?raw=true';

export const notificationService = {
  /**
   * 런타임 권한 요청 (Android 13+ 호환)
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn("이 브라우저/기기는 알림 기능을 지원하지 않습니다.");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log("Notification permission status:", permission);
      return permission === 'granted';
    } catch (error) {
      console.error("알림 권한 요청 중 오류 발생:", error);
      return false;
    }
  },

  /**
   * 실제 알림 발송
   */
  async showNotification(id: string, title: string, body: string, force: boolean = false) {
    if (!force && sentNotifications.has(id)) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const options = {
          body,
          icon: ICON_URL,
          badge: ICON_URL,
          silent: false,
          vibrate: [200, 100, 200],
          tag: id,
          renotify: true,
          data: { id }
        };

        // Try Service Worker first (better for Android/TWA)
        if ('serviceWorker' in navigator) {
          try {
            const registration = await Promise.race([
              navigator.serviceWorker.ready,
              new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 2000))
            ]) as ServiceWorkerRegistration;

            if (registration && 'showNotification' in registration) {
              await registration.showNotification(title, options);
              if (!force) {
                sentNotifications.add(id);
                db.saveSentNotifications(Array.from(sentNotifications).slice(-100)); // Keep last 100
              }
              return;
            }
          } catch (swError) {
            console.warn("Service Worker notification failed or timed out, falling back to standard API:", swError);
          }
        }

        // Fallback to standard Notification API
        const n = new Notification(title, options as any);
        if (!force) {
          sentNotifications.add(id);
          db.saveSentNotifications(Array.from(sentNotifications).slice(-100));
        }
        setTimeout(() => n.close(), 10000);
      } catch (e) {
        console.error("알림 발송 실패:", e);
      }
    } else {
      console.warn("알림 권한이 없거나 지원되지 않는 환경입니다. Permission:", Notification.permission);
    }
  },

  getPermissionStatus(): NotificationPermission {
    return 'Notification' in window ? Notification.permission : 'denied';
  },

  clearSentHistory() {
    sentNotifications.clear();
    db.saveSentNotifications([]);
  }
};

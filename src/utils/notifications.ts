const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.error('This browser does not support notifications.');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

export const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    // Pre-load and play
    audio.load();
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.warn('Audio playback was prevented. Usually needs a user interaction first.', e);
      });
    }
  } catch (e) {
    console.error('Audio playback failed:', e);
  }
};

export const sendLocalNotification = (title: string, body: string, icon?: string) => {
  if (Notification.permission === 'granted') {
    const options = {
      body,
      icon: icon || '/favicon.ico',
      dir: 'rtl' as NotificationDirection,
      badge: '/favicon.ico',
    };
    new Notification(title, options);
  }
  playNotificationSound();
};

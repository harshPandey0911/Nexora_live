// Notification Sound Utility
// Plays notification sound when new booking request arrives

let audioContext = null;
let notificationSound = null;

// Initialize audio context
const initAudio = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
};

// Create a premium notification sound (Major Chord / Chime)
const createNotificationSound = (type = 'chime') => {
  if (!audioContext) initAudio();

  const primaryGain = audioContext.createGain();
  primaryGain.connect(audioContext.destination);

  const playTone = (freq, type, startTime, duration, vol) => {
    const osc = audioContext.createOscillator();
    const g = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(vol, startTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.connect(g);
    g.connect(primaryGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const now = audioContext.currentTime;

  if (type === 'chime') {
    // Richer chime using harmonics (C5, E5, G5)
    playTone(523.25, 'sine', now, 0.6, 0.2); // C5
    playTone(659.25, 'sine', now + 0.05, 0.5, 0.15); // E5
    playTone(783.99, 'sine', now + 0.1, 0.4, 0.1); // G5
  } else if (type === 'beep') {
    playTone(880, 'sine', now, 0.2, 0.2);
  } else if (type === 'ring') {
    // A more urgent "Electronic Ring"
    playTone(660, 'triangle', now, 0.1, 0.15);
    playTone(880, 'triangle', now + 0.1, 0.1, 0.15);
  }

  return primaryGain;
};

// Play notification sound (Premium Chime)
// Play notification sound (Premium Alert)
export const playNotificationSound = async () => {
  try {
    initAudio();

    // Ensure AudioContext is running (fix for 'suspended' state restriction)
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (e) {
        console.warn('Could not resume audio context:', e);
      }
    }

    // Play a sequence of tones for a more distinct alert
    const now = audioContext.currentTime;

    // Main chime (Louder and Clearer C Major 7th)
    const tones = [
      { freq: 523.25, time: 0, dur: 0.8 },   // C5
      { freq: 659.25, time: 0.1, dur: 0.8 }, // E5
      { freq: 783.99, time: 0.2, dur: 0.8 }, // G5
      { freq: 987.77, time: 0.3, dur: 1.0 }  // B5
    ];

    tones.forEach(({ freq, time, dur }) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      // Increased Volume
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.4, now + time + 0.05); // Faster attack, louder peak
      gain.gain.exponentialRampToValueAtTime(0.01, now + time + dur);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });

    return true;
  } catch (error) {
    console.error('Error playing notification sound:', error);
    return false;
  }
};

// Play single beep for small interactions
export const playSingleBeep = () => {
  try {
    initAudio();
    createNotificationSound('beep');
    return true;
  } catch (error) {
    console.error('Error playing beep:', error);
    return false;
  }
};

// Play urgent ring for booking alerts — uses Web Audio API (no MP3 file needed)
let alertRingInterval = null;
let alertRingActive = false;

const playAlertRingOnce = () => {
  try {
    initAudio();
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    const now = audioContext.currentTime;

    // Urgent "ding-dong" pattern using triangle waves
    const pattern = [
      { freq: 880, start: 0,    dur: 0.18, vol: 0.3 },
      { freq: 660, start: 0.2,  dur: 0.18, vol: 0.25 },
      { freq: 880, start: 0.45, dur: 0.18, vol: 0.3 },
      { freq: 660, start: 0.65, dur: 0.18, vol: 0.25 },
    ];

    pattern.forEach(({ freq, start, dur, vol }) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(vol, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });
  } catch (e) {
    // Silent fail — audio not critical
  }
};

export const playAlertRing = (loop = false) => {
  try {
    // Stop any previous ring first
    stopAlertRing();

    alertRingActive = true;
    // Play immediately
    playAlertRingOnce();

    // If looping, repeat every 1.2 seconds
    if (loop) {
      alertRingInterval = setInterval(() => {
        if (alertRingActive) {
          playAlertRingOnce();
        } else {
          clearInterval(alertRingInterval);
          alertRingInterval = null;
        }
      }, 1200);
    }

    return true;
  } catch (error) {
    console.error('Error in playAlertRing:', error);
    return false;
  }
};

export const stopAlertRing = () => {
  alertRingActive = false;
  if (alertRingInterval) {
    clearInterval(alertRingInterval);
    alertRingInterval = null;
  }
};

// Check if sound is enabled in settings
export const isSoundEnabled = (userType = 'vendor') => {
  let storageKey = 'vendorData';
  if (userType === 'user') storageKey = 'userData';
  else if (userType === 'worker') storageKey = 'workerData';
  else if (userType === 'admin') storageKey = 'adminData';

  const dataString = localStorage.getItem(storageKey);
  if (dataString) {
    try {
      const data = JSON.parse(dataString);
      return data.settings?.soundAlerts !== false; // Default true
    } catch (error) {
      return true;
    }
  }
  return true;
};

export default {
  playNotificationSound,
  playSingleBeep,
  playAlertRing,
  isSoundEnabled
};

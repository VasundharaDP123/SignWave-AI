import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Landmark, GestureDefinition } from './services/gestures';
import {
  ASL_DICTIONARY,
  ISL_DICTIONARY,
  predictGesture,
  getDistance
} from './services/gestures';
import Speech from './services/speech';

// --- Skeleton Connection Maps ---
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [0, 9], [9, 10], [10, 11], [11, 12], // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17] // Knuckles
];

// --- Skeleton Color Themes ---
const THEMES = {
  cyberpunk: { bones: "rgba(6, 182, 212, 0.85)", joints: "#06b6d4", tips: "#34d399", glow: "rgba(6, 182, 212, 0.6)" },
  gold: { bones: "rgba(180, 120, 30, 0.8)", joints: "#f59e0b", tips: "#fbbf24", glow: "rgba(245, 158, 11, 0.5)" },
  emerald: { bones: "rgba(16, 185, 129, 0.8)", joints: "#10b981", tips: "#34d399", glow: "rgba(16, 185, 129, 0.5)" },
  ice: { bones: "rgba(59, 130, 246, 0.8)", joints: "#6366f1", tips: "#38bdf8", glow: "rgba(59, 130, 246, 0.6)" }
};

interface ChatMessage {
  sender: string;
  text: string;
  typeClass: 'signer' | 'vocalist' | 'system';
}

interface Stats {
  streak: number;
  academyScore: number;
  roundsPlayed: number;
  customCount: number;
  lastActiveDate: string;
}

export const App: React.FC = () => {
  // --- UI Tabs and System States ---
  const [activeTab, setActiveTab] = useState<'guide' | 'academy' | 'stats'>('guide');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<string>("Initializing AI System...");
  const [currentGesture, setCurrentGesture] = useState<GestureDefinition>({
    name: "Camera Off",
    emoji: "📷",
    description: "Start camera to scan gestures."
  });

  // --- Sentence Timeline & Assembling ---
  const [sentence, setSentence] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("Original English sentence...");

  // --- Chat Log & Voice Engine Status ---
  const [chatLog, setChatLog] = useState<ChatMessage[]>([
    {
      sender: "System",
      text: "Welcome to SignWave! Use the dropdown below to translate hand-constructed sentences into other languages instantly.",
      typeClass: "vocalist"
    }
  ]);
  const [micListening, setMicListening] = useState<boolean>(false);
  const [micStatus, setMicStatus] = useState<string>("Click microphone to translate voice response");

  // --- Custom Gesture Studio ---
  const [customGestureName, setCustomGestureName] = useState<string>("");
  const [customGestureEmoji, setCustomGestureEmoji] = useState<string>("🏷️");

  // --- Search ---
  const [dictionarySearch, setDictionarySearch] = useState<string>("");

  // --- Accessibility, Themes, Presets ---
  const [outputSpeechLang, setOutputSpeechLang] = useState<string>("en");
  const [voiceProfile, setVoiceProfile] = useState<string | null>(null);
  const [theme, setTheme] = useState<'cyberpunk' | 'gold' | 'emerald' | 'ice'>('cyberpunk');
  const [preset, setPreset] = useState<'asl' | 'isl'>('asl');
  const [toggleGrammar, setToggleGrammar] = useState<boolean>(true);
  const [toggleHaptic, setToggleHaptic] = useState<boolean>(true);
  const [toggleContrast, setToggleContrast] = useState<boolean>(false);
  const [textMultiplier, setTextMultiplier] = useState<number>(1.0);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);

  // --- Practice Academy HUD ---
  const [academyActive, setAcademyActive] = useState<boolean>(false);
  const [academyScore, setAcademyScore] = useState<number>(0);
  const [academyRound, setAcademyRound] = useState<number>(0);
  const [academyTargetSign, setAcademyTargetSign] = useState<{ name: string; emoji: string } | null>(null);
  const [academyHoldProgress, setAcademyHoldProgress] = useState<number>(0);
  const [academyTimer, setAcademyTimer] = useState<number>(15);

  // --- Local DB / Server Sync Status ---
  const [customGestures, setCustomGestures] = useState<GestureDefinition[]>([]);
  const [stats, setStats] = useState<Stats>({
    streak: 1,
    academyScore: 0,
    roundsPlayed: 0,
    customCount: 0,
    lastActiveDate: ""
  });
  const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'synced'>('offline');
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // --- React Refs for Media & Canvas ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const voiceWaveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Core References for MediaPipe Capture Loops ---
  const streamRef = useRef<MediaStream | null>(null);
  const mediaPipeHandsRef = useRef<any>(null);
  const motionHistoryRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const lastPredictionNameRef = useRef<string>("");
  const predictionMatchCountRef = useRef<number>(0);
  const academyIntervalRef = useRef<any>(null);
  const roundTimerIntervalRef = useRef<any>(null);

  // Keep state refs in sync for asynchronous handlers
  const themeRef = useRef(theme);
  useEffect(() => { themeRef.current = theme; }, [theme]);

  const presetRef = useRef(preset);
  useEffect(() => { presetRef.current = preset; }, [preset]);

  const customGesturesRef = useRef(customGestures);
  useEffect(() => { customGesturesRef.current = customGestures; }, [customGestures]);

  const academyActiveRef = useRef(academyActive);
  useEffect(() => { academyActiveRef.current = academyActive; }, [academyActive]);

  const academyTargetSignRef = useRef(academyTargetSign);
  useEffect(() => { academyTargetSignRef.current = academyTargetSign; }, [academyTargetSign]);

  const currentGestureRef = useRef(currentGesture);
  useEffect(() => { currentGestureRef.current = currentGesture; }, [currentGesture]);

  const cameraActiveRef = useRef(cameraActive);
  useEffect(() => { cameraActiveRef.current = cameraActive; }, [cameraActive]);

  // --- Audio Tones Synthesizer ---
  const playBeep = (frequency: number, duration: number, type: OscillatorType = "sine") => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = type;
      oscillator.frequency.value = frequency;

      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.log("Audio context blocked by browser policy.");
    }
  };

  const playSuccessChime = () => {
    playBeep(587.33, 0.08); // D5
    setTimeout(() => playBeep(880, 0.15), 80); // A5
  };

  const playVictoryFanfare = () => {
    playBeep(523.25, 0.12); // C5
    setTimeout(() => playBeep(659.25, 0.12), 120); // E5
    setTimeout(() => playBeep(783.99, 0.12), 240); // G5
    setTimeout(() => playBeep(1046.50, 0.35), 360); // C6
  };

  const playFailBuzz = () => {
    playBeep(150, 0.35, "sawtooth");
  };

  // --- DB Synchronization ---
  const mergeData = (localG: GestureDefinition[], localS: Stats, serverData: any) => {
    const mergedGestures = [...localG];
    if (serverData.gestures && Array.isArray(serverData.gestures)) {
      serverData.gestures.forEach((sg: GestureDefinition) => {
        const idx = mergedGestures.findIndex(lg => lg.name.toLowerCase() === sg.name.toLowerCase());
        if (idx === -1) {
          mergedGestures.push(sg);
        } else {
          mergedGestures[idx] = sg;
        }
      });
    }

    const mergedStats = {
      streak: Math.max(localS?.streak || 1, serverData.stats?.streak || 1),
      academyScore: Math.max(localS?.academyScore || 0, serverData.stats?.academyScore || 0),
      roundsPlayed: Math.max(localS?.roundsPlayed || 0, serverData.stats?.roundsPlayed || 0),
      customCount: 0,
      lastActiveDate: localS?.lastActiveDate || serverData.stats?.lastActiveDate || ""
    };
    mergedStats.customCount = mergedGestures.length;

    return { gestures: mergedGestures, stats: mergedStats };
  };

  useEffect(() => {
    // Load local storage values
    const localGesturesStr = localStorage.getItem("signwave_custom_gestures");
    const localStatsStr = localStorage.getItem("signwave_stats");

    let localG: GestureDefinition[] = [];
    let localS: Stats = { streak: 1, academyScore: 0, roundsPlayed: 0, customCount: 0, lastActiveDate: "" };

    if (localGesturesStr) {
      try { localG = JSON.parse(localGesturesStr); } catch (e) { }
    }
    if (localStatsStr) {
      try { localS = JSON.parse(localStatsStr); } catch (e) { }
    }

    // Daily streak logic
    const todayStr = new Date().toDateString();
    if (localS.lastActiveDate !== todayStr) {
      if (localS.lastActiveDate) {
        const lastDate = new Date(localS.lastActiveDate);
        const diffTime = Math.abs(new Date(todayStr).getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          localS.streak += 1;
        } else if (diffDays > 1) {
          localS.streak = 1;
        }
      } else {
        localS.streak = 1;
      }
      localS.lastActiveDate = todayStr;
    }

    setCustomGestures(localG);
    setStats(localS);

    // Initial server sync retrieve
    fetch('/api/sync')
      .then(res => {
        if (!res.ok) throw new Error("Sync server GET failed");
        return res.json();
      })
      .then(serverData => {
        if (serverData && (serverData.gestures || serverData.stats)) {
          const merged = mergeData(localG, localS, serverData);
          setCustomGestures(merged.gestures);
          setStats(merged.stats);
          setSyncStatus("synced");
          localStorage.setItem("signwave_custom_gestures", JSON.stringify(merged.gestures));
          localStorage.setItem("signwave_stats", JSON.stringify(merged.stats));

          // Post merged database back to server
          fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged)
          }).catch(e => console.warn("POST merge failure:", e));
        }
      })
      .catch(err => {
        console.warn("Cloud sync server offline, running in offline mode:", err);
        setSyncStatus("offline");
      });

    // Populate system voice profile dropdown list
    const loadVoices = () => {
      const voices = Speech.getAllSystemVoices();
      setSystemVoices(voices);
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Initialize MediaPipe hands script
    setTimeout(() => {
      const HandsClass = (window as any).Hands;
      if (HandsClass) {
        setSystemStatus("SignWave AI Ready");
      }
    }, 800);

    return () => {
      stopCamera();
    };
  }, []);

  // Set contrast state on mount/update
  useEffect(() => {
    if (toggleContrast) {
      document.body.classList.add("high-contrast");
    } else {
      document.body.classList.remove("high-contrast");
    }
  }, [toggleContrast]);

  // --- Voice Command & Accent Filters ---
  const filteredVoices = useMemo(() => {
    if (outputSpeechLang === "en") {
      return systemVoices.filter(v => v.lang.toLowerCase().startsWith("en"));
    }
    return systemVoices.filter(v => v.lang.toLowerCase().startsWith(outputSpeechLang.toLowerCase()));
  }, [systemVoices, outputSpeechLang]);

  useEffect(() => {
    if (filteredVoices.length > 0) {
      if (!voiceProfile || !filteredVoices.some(v => v.name === voiceProfile)) {
        setVoiceProfile(filteredVoices[0].name);
        Speech.setCustomVoice(filteredVoices[0].name);
      }
    } else {
      setVoiceProfile(null);
      Speech.setCustomVoice("");
    }
  }, [filteredVoices, voiceProfile]);

  // --- Dynamic Search Filters ---
  const filteredStandardDict = useMemo(() => {
    const dict = preset === "isl" ? ISL_DICTIONARY : ASL_DICTIONARY;
    if (!dictionarySearch.trim()) return dict;
    const q = dictionarySearch.toLowerCase().trim();
    return dict.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  }, [preset, dictionarySearch]);

  const filteredCustomDict = useMemo(() => {
    if (!dictionarySearch.trim()) return customGestures;
    const q = dictionarySearch.toLowerCase().trim();
    return customGestures.filter(item =>
      item.name.toLowerCase().includes(q)
    );
  }, [customGestures, dictionarySearch]);

  // --- UI Event Handlers ---
  const appendChatMessage = (sender: string, text: string, typeClass: 'signer' | 'vocalist' | 'system') => {
    setChatLog(prev => {
      const next = [...prev, { sender, text, typeClass }];
      setTimeout(() => {
        const chatLogDiv = document.getElementById("chat-log");
        if (chatLogDiv) chatLogDiv.scrollTop = chatLogDiv.scrollHeight;
      }, 50);
      return next;
    });
  };

  const handleSyncCloud = async () => {
    setSyncStatus("syncing");
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gestures: customGestures, stats })
      });
      if (response.ok) {
        setSyncStatus("synced");
        playSuccessChime();
        appendChatMessage("System", "Cloud sync complete. Custom gestures and practice scores backed up securely.", "vocalist");
      } else {
        throw new Error("Sync failed");
      }
    } catch (err) {
      console.error("Cloud sync failed:", err);
      setSyncStatus("offline");
      alert("Failed to sync data with the server.");
    }
  };

  // --- MediaPipe Hands Callbacks ---
  const isHandMoving = () => {
    const history = motionHistoryRef.current;
    if (history.length < 5) return false;
    let minX = 1, maxX = 0;
    let minY = 1, maxY = 0;
    for (let i = history.length - 5; i < history.length; i++) {
      const pt = history[i];
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const xSpan = maxX - minX;
    const ySpan = maxY - minY;
    return xSpan > 0.05 || ySpan > 0.05;
  };

  const detectMotionGesture = (landmarks: Landmark[]): GestureDefinition | null => {
    if (!landmarks || landmarks.length < 21) return null;

    const wrist = landmarks[0];
    const history = motionHistoryRef.current;

    history.push({ x: wrist.x, y: wrist.y, time: Date.now() });
    if (history.length > 25) {
      history.shift();
    }

    if (history.length < 10) return null;

    let minX = 1, maxX = 0;
    let minY = 1, maxY = 0;
    for (let i = 0; i < history.length; i++) {
      const pt = history[i];
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const xSpan = maxX - minX;
    const ySpan = maxY - minY;

    let directionChangesX = 0;
    let prevDeltaX = 0;
    const MIN_DELTA = 0.008;

    for (let i = 1; i < history.length; i++) {
      const dx = history[i].x - history[i - 1].x;
      if (prevDeltaX !== 0) {
        if ((dx > MIN_DELTA && prevDeltaX < -MIN_DELTA) || (dx < -MIN_DELTA && prevDeltaX > MIN_DELTA)) {
          directionChangesX++;
          prevDeltaX = dx;
        }
      } else if (Math.abs(dx) > MIN_DELTA) {
        prevDeltaX = dx;
      }
    }

    if (directionChangesX >= 3 && xSpan > ySpan * 1.3 && xSpan > 0.12) {
      return {
        name: "Hello",
        emoji: "👋",
        description: "Hand waved side-to-side dynamically."
      };
    }

    let directionChangesY = 0;
    let prevDeltaY = 0;
    for (let i = 1; i < history.length; i++) {
      const dy = history[i].y - history[i - 1].y;
      if (prevDeltaY !== 0) {
        if ((dy > MIN_DELTA && prevDeltaY < -MIN_DELTA) || (dy < -MIN_DELTA && prevDeltaY > MIN_DELTA)) {
          directionChangesY++;
          prevDeltaY = dy;
        }
      } else if (Math.abs(dy) > MIN_DELTA) {
        prevDeltaY = dy;
      }
    }

    if (directionChangesY >= 3 && ySpan > xSpan * 1.3 && ySpan > 0.12) {
      return {
        name: "Yes",
        emoji: "✊",
        description: "Rapid vertical movement representing agreement."
      };
    }

    if (history.length >= 15) {
      const ratio = xSpan / (ySpan || 1);
      if (xSpan > 0.08 && ySpan > 0.08 && ratio > 0.6 && ratio < 1.7 && directionChangesX >= 1 && directionChangesY >= 1) {
        return {
          name: "Please",
          emoji: "🙏",
          description: "Circular rubbing motion representing politeness."
        };
      }
    }

    return null;
  };

  const detectTwoHandGesture = (hand1: Landmark[], hand2: Landmark[]): GestureDefinition | null => {
    if (!hand1 || !hand2) return null;

    const wrist1 = hand1[0];
    const wrist2 = hand2[0];

    const indexTip1 = hand1[8];
    const indexTip2 = hand2[8];

    const thumbTip1 = hand1[4];
    const thumbTip2 = hand2[4];

    const pinkyTip1 = hand1[20];
    const pinkyTip2 = hand2[20];

    const palm1 = getDistance(wrist1, hand1[9]);
    const palm2 = getDistance(wrist2, hand2[9]);
    const avgPalm = (palm1 + palm2) / 2;

    if (avgPalm === 0) return null;

    const indexTipsDist = getDistance(indexTip1, indexTip2);
    const wristsDist = getDistance(wrist1, wrist2);
    const thumbsDist = getDistance(thumbTip1, thumbTip2);

    if (indexTipsDist < avgPalm * 0.4 && wristsDist > avgPalm * 1.8 && thumbsDist < avgPalm * 0.9) {
      return {
        name: "House / Roof",
        emoji: "🏠",
        description: "Triangular shape formed by fingers, representing home."
      };
    }

    if (wristsDist < avgPalm * 0.6 && pinkyTip1 && pinkyTip2) {
      const pinkyDist = getDistance(pinkyTip1, pinkyTip2);
      const isHand1Open = getDistance(indexTip1, wrist1) > getDistance(hand1[6], wrist1);
      const isHand2Open = getDistance(indexTip2, wrist2) > getDistance(hand2[6], wrist2);

      if (pinkyDist < avgPalm * 0.6 && isHand1Open && isHand2Open) {
        return {
          name: "Book / Read",
          emoji: "📖",
          description: "Flat palms placed side-by-side like an open book."
        };
      }
    }

    if (indexTipsDist < avgPalm * 0.5) {
      const isIndex1Extended = getDistance(indexTip1, wrist1) > getDistance(hand1[6], wrist1);
      const isIndex2Extended = getDistance(indexTip2, wrist2) > getDistance(hand2[6], wrist2);
      const isOthersFolded1 = getDistance(hand1[12], wrist1) < getDistance(hand1[10], wrist1);
      const isOthersFolded2 = getDistance(hand2[12], wrist2) < getDistance(hand2[10], wrist2);

      if (isIndex1Extended && isIndex2Extended && isOthersFolded1 && isOthersFolded2) {
        return {
          name: "Friend",
          emoji: "🤝",
          description: "Hooked or touching index fingers representing association."
        };
      }
    }

    return null;
  };

  const onHandResults = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const activeTheme = THEMES[themeRef.current] || THEMES.cyberpunk;

      // Draw skeleton lines
      results.multiHandLandmarks.forEach((landmarks: Landmark[]) => {
        ctx.shadowBlur = 6;
        ctx.shadowColor = activeTheme.glow;
        ctx.lineWidth = 4;
        ctx.strokeStyle = activeTheme.bones;
        ctx.lineCap = "round";

        for (const connection of HAND_CONNECTIONS) {
          const pt1 = landmarks[connection[0]];
          const pt2 = landmarks[connection[1]];
          ctx.beginPath();
          ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
          ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
          ctx.stroke();
        }

        ctx.shadowBlur = 10;
        for (let i = 0; i < landmarks.length; i++) {
          const pt = landmarks[i];
          ctx.beginPath();
          ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 6, 0, 2 * Math.PI);

          if ([4, 8, 12, 16, 20].includes(i)) {
            ctx.fillStyle = activeTheme.tips;
            ctx.shadowColor = activeTheme.tips;
          } else {
            ctx.fillStyle = activeTheme.joints;
            ctx.shadowColor = activeTheme.joints;
          }
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      });

      let gesture: GestureDefinition | null = null;

      // Classify double hand gestures
      if (results.multiHandLandmarks.length >= 2) {
        gesture = detectTwoHandGesture(results.multiHandLandmarks[0], results.multiHandLandmarks[1]);
      }

      // Classify motion or static single-hand gestures
      if (!gesture) {
        const primaryHand = results.multiHandLandmarks[0];
        gesture = detectMotionGesture(primaryHand);

        if (!gesture) {
          if (isHandMoving()) {
            gesture = {
              name: "Scanning...",
              emoji: "✋",
              description: "Hold hand steady to trigger a sign."
            };
          } else {
            gesture = predictGesture(primaryHand, customGesturesRef.current, presetRef.current);
          }
        }
      }

      if (gesture) {
        handleStableGesture(gesture);
      }
    } else {
      motionHistoryRef.current = [];
      handleStableGesture({
        name: "Scanning...",
        emoji: "✋",
        description: "Hold hand clearly in webcam feed."
      });
    }
  };

  const handleStableGesture = (gesture: GestureDefinition) => {
    const isDynamicOrTwoHand = ["Hello", "Yes", "Please", "House / Roof", "Book / Read", "Friend"].includes(gesture.name);
    const targetThreshold = isDynamicOrTwoHand ? 4 : 6;

    if (gesture.name === lastPredictionNameRef.current) {
      predictionMatchCountRef.current++;
    } else {
      lastPredictionNameRef.current = gesture.name;
      predictionMatchCountRef.current = 0;
    }

    if (predictionMatchCountRef.current >= targetThreshold ||
      gesture.name.includes("Scanning") ||
      gesture.name.includes("No Hand") ||
      gesture.name.includes("Camera Off")) {

      setCurrentGesture(gesture);
    }
  };

  // --- Camera controls ---
  const resizeCanvas = () => {
    if (videoRef.current && canvasRef.current) {
      canvasRef.current.width = videoRef.current.clientWidth || 640;
      canvasRef.current.height = videoRef.current.clientHeight || 480;
    }
  };

  const initMediaPipe = () => {
    if (mediaPipeHandsRef.current) return;

    const HandsClass = (window as any).Hands;
    if (!HandsClass) {
      console.error("MediaPipe Hands library not found in global window context.");
      setSystemStatus("Offline Error");
      return;
    }

    try {
      const hands = new HandsClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      hands.onResults(onHandResults);
      mediaPipeHandsRef.current = hands;
      setSystemStatus("SignWave AI Ready");
    } catch (e) {
      console.error("Hands initialization error:", e);
      setSystemStatus("Offline Error");
    }
  };

  const startCamera = async () => {
    setSystemStatus("Opening camera...");
    try {
      const constraints = {
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false
      };
      const userStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = userStream;
      if (videoRef.current) {
        videoRef.current.srcObject = userStream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setSystemStatus("SignWave Active");

      initMediaPipe();
      resizeCanvas();
      startCaptureLoop();
    } catch (err) {
      console.error("Camera access failed:", err);
      setSystemStatus("Camera Blocked");
      alert("Webcam blocked. Please update camera site permissions in browser settings.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setSystemStatus("Camera Offline");

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setCurrentGesture({ name: "Camera Off", emoji: "📷", description: "Start camera to scan gestures." });
    if (academyActiveRef.current) {
      stopAcademy();
    }
  };

  const startCaptureLoop = () => {
    const captureFrame = async () => {
      if (!cameraActiveRef.current || !streamRef.current) return;
      try {
        if (videoRef.current && mediaPipeHandsRef.current) {
          await mediaPipeHandsRef.current.send({ image: videoRef.current });
        }
      } catch (err) {
        console.error("Frame skip:", err);
      }
      if (cameraActiveRef.current && streamRef.current) {
        requestAnimationFrame(captureFrame);
      }
    };
    requestAnimationFrame(captureFrame);
  };

  // --- Academy practice mode ---
  const startAcademy = () => {
    if (!cameraActive) {
      alert("Please activate the camera before entering the Academy practice sessions.");
      return;
    }

    setAcademyActive(true);
    setAcademyScore(0);
    setAcademyRound(0);
    setAcademyHoldProgress(0);

    appendChatMessage("SignWave Academy", "Starting practice session. Try to match the prompts on the left screen!", "signer");
    nextAcademyRound(1, 0);
  };

  const stopAcademy = () => {
    setAcademyActive(false);
    if (academyIntervalRef.current) clearInterval(academyIntervalRef.current);
    if (roundTimerIntervalRef.current) clearInterval(roundTimerIntervalRef.current);
    appendChatMessage("SignWave Academy", "Practice session ended.", "vocalist");
  };

  const nextAcademyRound = (roundNum: number, currentScore: number) => {
    if (roundNum > 5) {
      playVictoryFanfare();
      appendChatMessage("SignWave Academy", `🎉 Congratulations! You completed the academy quiz. Final Score: ${currentScore}/5`, "signer");

      const updatedStats = {
        ...stats,
        roundsPlayed: stats.roundsPlayed + 1,
        academyScore: stats.academyScore + currentScore
      };
      setStats(updatedStats);
      localStorage.setItem("signwave_stats", JSON.stringify(updatedStats));

      setAcademyActive(false);
      if (academyIntervalRef.current) clearInterval(academyIntervalRef.current);
      if (roundTimerIntervalRef.current) clearInterval(roundTimerIntervalRef.current);
      return;
    }

    setAcademyRound(roundNum);

    const standardList = presetRef.current === "isl" ? [
      { name: "Good / Yes", emoji: "👍" },
      { name: "Victory / 'V'", emoji: "✌️" },
      { name: "Direction", emoji: "👉" },
      { name: "I Love You", emoji: "🤟" },
      { name: "OK (ISL)", emoji: "👌" },
      { name: "Call Me", emoji: "🤙" },
      { name: "Water (ISL)", emoji: "💧" },
      { name: "Fist / Strength", emoji: "✊" }
    ] : [
      { name: "Thumbs Up", emoji: "👍" },
      { name: "Peace / 'V'", emoji: "✌️" },
      { name: "L Sign", emoji: "👉" },
      { name: "I Love You", emoji: "🤟" },
      { name: "OK", emoji: "👌" },
      { name: "Call Me", emoji: "🤙" },
      { name: "Fist / 'A'", emoji: "✊" }
    ];

    const customList = customGesturesRef.current.map(cg => ({ name: cg.name, emoji: cg.emoji }));
    const mergedList = [...standardList, ...customList];

    const randomIdx = Math.floor(Math.random() * mergedList.length);
    const target = mergedList[randomIdx];

    setAcademyTargetSign(target);
    setAcademyHoldProgress(0);
    setAcademyTimer(15);

    if (roundTimerIntervalRef.current) clearInterval(roundTimerIntervalRef.current);

    let timeLimit = 15;
    roundTimerIntervalRef.current = setInterval(() => {
      timeLimit--;
      setAcademyTimer(timeLimit);
      if (timeLimit <= 0) {
        clearInterval(roundTimerIntervalRef.current);
        playFailBuzz();
        appendChatMessage("SignWave Academy", `Round ${roundNum} timed out! Target sign was: "${target.name}".`, "vocalist");
        nextAcademyRound(roundNum + 1, currentScore);
      }
    }, 1000);
  };

  // Run the interval checker for academy hold progress
  useEffect(() => {
    if (academyActive) {
      academyIntervalRef.current = setInterval(() => {
        const activeName = currentGestureRef.current ? currentGestureRef.current.name : "";
        if (!academyTargetSignRef.current) return;
        const targetName = academyTargetSignRef.current.name;

        const isMatch = activeName === targetName ||
          activeName.includes(targetName) ||
          targetName.includes(activeName);

        if (isMatch && cameraActiveRef.current) {
          setAcademyHoldProgress(prev => {
            const next = Math.min(100, prev + 5);
            if (next >= 100 && prev < 100) {
              setTimeout(() => {
                clearInterval(roundTimerIntervalRef.current);
                setAcademyScore(s => {
                  const nextScore = s + 1;
                  playSuccessChime();
                  appendChatMessage("SignWave Academy", `🎯 Correctly held gesture: "${targetName}"!`, "signer");
                  nextAcademyRound(academyRound + 1, nextScore);
                  return nextScore;
                });
              }, 50);
            }
            return next;
          });
        } else {
          setAcademyHoldProgress(prev => Math.max(0, prev - 10));
        }
      }, 100);
    } else {
      if (academyIntervalRef.current) clearInterval(academyIntervalRef.current);
    }
    return () => {
      if (academyIntervalRef.current) clearInterval(academyIntervalRef.current);
    };
  }, [academyActive, academyRound]);

  // --- Sentence timeline builder ---
  const addWordToSentence = () => {
    if (!currentGesture) return;

    let wordToAdd = currentGesture.name;
    if (wordToAdd.includes(" / ")) {
      wordToAdd = wordToAdd.split(" / ")[0];
    }

    setSentence(prev => prev ? `${prev} ${wordToAdd}` : wordToAdd);

    if (toggleHaptic && navigator.vibrate) {
      navigator.vibrate([80]);
    }

    if (autoSpeak) {
      const spokenWord = toggleGrammar ? Speech.translateToSpokenGrammar(wordToAdd) : wordToAdd;
      Speech.speak(spokenWord);
    }
  };

  const clearSentence = () => {
    setSentence("");
    setTranslatedText("Original English sentence...");
  };

  const speakSentence = async () => {
    let text = sentence.trim();
    if (!text) return;

    if (toggleGrammar) {
      text = Speech.translateToSpokenGrammar(text);
    }

    const targetLang = outputSpeechLang;

    if (targetLang === "en") {
      appendChatMessage("Signer", text, "signer");
      Speech.speak(
        text,
        'en-US',
        () => { setIsSpeaking(true); },
        () => { setIsSpeaking(false); },
        () => { setIsSpeaking(false); }
      );
    } else {
      setTranslatedText("Translating...");
      const translated = await Speech.translate(text, targetLang);
      setTranslatedText(translated);
      appendChatMessage("Signer (Translated)", `${translated} ("${text}")`, "signer");

      const voiceAccents: Record<string, string> = { es: "es-ES", fr: "fr-FR", de: "de-DE", ja: "ja-JP" };
      const accent = voiceAccents[targetLang] || targetLang;

      Speech.speak(
        translated,
        accent,
        () => { setIsSpeaking(true); },
        () => { setIsSpeaking(false); },
        () => { setIsSpeaking(false); }
      );
    }
  };

  // Run async translation on sentence changes
  useEffect(() => {
    const updateTranslation = async () => {
      if (!sentence.trim()) {
        setTranslatedText("Original English sentence...");
        return;
      }

      let textToTranslate = sentence;
      if (toggleGrammar) {
        textToTranslate = Speech.translateToSpokenGrammar(sentence);
      }

      if (outputSpeechLang === "en") {
        setTranslatedText(textToTranslate);
        return;
      }

      setTranslatedText("Translating...");
      const translated = await Speech.translate(textToTranslate, outputSpeechLang);
      setTranslatedText(translated);
    };

    updateTranslation();
  }, [sentence, toggleGrammar, outputSpeechLang]);

  const speakQuickPhrase = async (phrase: string) => {
    const targetLang = outputSpeechLang;

    if (targetLang === "en") {
      appendChatMessage("Signer (Quick Phrase)", phrase, "signer");
      Speech.speak(phrase, 'en-US');
      setSentence(prev => prev ? `${prev} ${phrase}` : phrase);
    } else {
      const translated = await Speech.translate(phrase, targetLang);
      appendChatMessage("Signer (Quick Phrase)", `${translated} ("${phrase}")`, "signer");

      const voiceAccents: Record<string, string> = { es: "es-ES", fr: "fr-FR", de: "de-DE", ja: "ja-JP" };
      const accent = voiceAccents[targetLang] || targetLang;

      Speech.speak(translated, accent);
      setSentence(prev => prev ? `${prev} ${phrase}` : phrase);
    }
  };

  // --- Voice controls & microphone visualizers ---
  const toggleSpeechListening = () => {
    if (micListening) {
      Speech.stopListening((listening) => {
        setMicListening(listening);
        setMicStatus("Click microphone to translate voice response");
      });
    } else {
      Speech.startListening(
        (transcript) => {
          setMicStatus(`"${transcript.interim || transcript.final}"`);
          if (transcript.final) {
            appendChatMessage("Voice Reply", transcript.final, "vocalist");
            setMicStatus("Listening...");
          }
        },
        (command) => {
          handleVoiceCommand(command);
        },
        (listening) => {
          setMicListening(listening);
          if (listening) {
            setMicStatus("Listening... Speak now");
          } else {
            setMicStatus("Click microphone to translate voice response");
          }
        }
      );

      Speech.startVisualizerStream((dataArray) => {
        renderAudioWave(dataArray);
      });
    }
  };

  const handleVoiceCommand = (command: { action: string }) => {
    switch (command.action) {
      case "clear":
        clearSentence();
        appendChatMessage("Voice Command", "Cleared timeline.", "vocalist");
        break;
      case "speak_sentence":
        speakSentence();
        break;
      case "delete_word":
        setSentence(prev => {
          const words = prev.trim().split(" ");
          words.pop();
          return words.join(" ");
        });
        appendChatMessage("Voice Command", "Deleted last word.", "vocalist");
        break;
      case "add_sign":
        const isValid = !["Scanning...", "No Hand Detected", "Analyzing...", "Camera Off", "Scanning (0 fingers)", "Scanning (1 fingers)", "Scanning (2 fingers)", "Scanning (3 fingers)", "Scanning (4 fingers)", "Scanning (5 fingers)"].includes(currentGestureRef.current?.name || "");
        if (isValid) {
          addWordToSentence();
        }
        break;
      case "increase_font":
        adjustFontSize(0.1);
        break;
      case "decrease_font":
        adjustFontSize(-0.1);
        break;
    }
  };

  const adjustFontSize = (delta: number) => {
    setTextMultiplier(prev => Math.max(0.8, Math.min(1.8, prev + delta)));
  };

  const renderAudioWave = (dataArray: Uint8Array) => {
    const canvas = voiceWaveCanvasRef.current;
    if (!canvas) return;
    const waveCtx = canvas.getContext("2d");
    if (!waveCtx) return;

    waveCtx.clearRect(0, 0, canvas.width, canvas.height);

    const activeTheme = THEMES[themeRef.current] || THEMES.cyberpunk;
    const barWidth = (canvas.width / dataArray.length) * 1.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height * 0.95;

      const grad = waveCtx.createLinearGradient(0, canvas.height, 0, 0);
      grad.addColorStop(0, activeTheme.bones);
      grad.addColorStop(1, activeTheme.joints);

      waveCtx.fillStyle = grad;
      waveCtx.shadowBlur = 5;
      waveCtx.shadowColor = activeTheme.glow;

      const y = (canvas.height - barHeight) / 2;
      waveCtx.fillRect(x, y, barWidth - 1.5, barHeight);

      x += barWidth;
    }
    waveCtx.shadowBlur = 0;
  };

  // --- Export logs and profiles ---
  const exportChatLog = () => {
    if (chatLog.length <= 1) {
      alert("No logs to export yet. Build some sentences or speak to create logs.");
      return;
    }

    let logText = `========================================\n`;
    logText += `   SIGNWAVE AI ACCESS LOG\n`;
    logText += `   Date: ${new Date().toLocaleString()}\n`;
    logText += `========================================\n\n`;

    chatLog.forEach(msg => {
      logText += `[${msg.sender}]: ${msg.text}\n`;
    });

    const blob = new Blob([logText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `signwave_chat_log_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCustomGestures = () => {
    if (customGestures.length === 0) {
      alert("No custom gestures registered to export.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customGestures, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `signwave_custom_profile_${Date.now()}.json`);
    dlAnchorElem.click();
    appendChatMessage("System", "Exported custom gestures database successfully.", "vocalist");
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          let mergeCount = 0;
          const updatedCustom = [...customGestures];
          imported.forEach(item => {
            if (item.name && item.states) {
              const existsIdx = updatedCustom.findIndex(cg => cg.name.toLowerCase() === item.name.toLowerCase());
              if (existsIdx !== -1) {
                updatedCustom[existsIdx] = item;
              } else {
                updatedCustom.push(item);
              }
              mergeCount++;
            }
          });
          setCustomGestures(updatedCustom);
          localStorage.setItem("signwave_custom_gestures", JSON.stringify(updatedCustom));

          const updatedStats = {
            ...stats,
            customCount: updatedCustom.length
          };
          setStats(updatedStats);
          localStorage.setItem("signwave_stats", JSON.stringify(updatedStats));

          playSuccessChime();
          appendChatMessage("System", `Imported ${mergeCount} custom gestures successfully!`, "signer");
          alert(`Imported ${mergeCount} gestures successfully!`);
        } else {
          alert("Invalid file format. Profile must be a JSON array of gestures.");
        }
      } catch (err) {
        console.error("Profile import error:", err);
        alert("Failed to parse profile JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handleSaveCustomGesture = () => {
    const name = customGestureName.trim();
    const emoji = customGestureEmoji;

    if (!name) {
      alert("Please enter a label name for your custom hand gesture.");
      return;
    }

    if (!cameraActive) {
      alert("Camera must be active to record custom hand shapes.");
      return;
    }

    if (!currentGesture || !currentGesture.states) {
      alert("No hand shapes detected in camera feed. Adjust your lighting/position.");
      return;
    }

    const exists = customGestures.some(cg => cg.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert(`A gesture named "${name}" is already registered. Delete the existing one first.`);
      return;
    }

    const capturedStates = { ...currentGesture.states };

    const updatedCustom = [...customGestures, {
      name,
      emoji,
      description: "Custom recorded hand shape mapping.",
      states: capturedStates,
      isCustom: true
    }];

    setCustomGestures(updatedCustom);
    localStorage.setItem("signwave_custom_gestures", JSON.stringify(updatedCustom));
    setCustomGestureName("");

    const updatedStats = {
      ...stats,
      customCount: updatedCustom.length
    };
    setStats(updatedStats);
    localStorage.setItem("signwave_stats", JSON.stringify(updatedStats));

    playSuccessChime();
    appendChatMessage("System", `Successfully registered custom gesture: "${name}" ${emoji}`, "signer");
  };

  const handleDeleteCustomGesture = (index: number) => {
    const deleted = customGestures[index];
    const updatedCustom = customGestures.filter((_, idx) => idx !== index);

    setCustomGestures(updatedCustom);
    localStorage.setItem("signwave_custom_gestures", JSON.stringify(updatedCustom));

    const updatedStats = {
      ...stats,
      customCount: updatedCustom.length
    };
    setStats(updatedStats);
    localStorage.setItem("signwave_stats", JSON.stringify(updatedStats));

    appendChatMessage("System", `Deleted custom gesture: "${deleted.name}"`, "vocalist");
  };

  const isGuideItemActive = (name: string) => {
    if (!currentGesture) return false;
    const currentName = currentGesture.name;
    return currentName.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(currentName.toLowerCase());
  };

  const handleGuideItemClick = (item: { name: string; emoji: string; description: string }) => {
    setCurrentGesture({
      name: item.name,
      emoji: item.emoji,
      description: item.description,
      isPresetPreview: true
    });
  };

  const isValidSign = useMemo(() => {
    if (!currentGesture) return false;
    return !["Scanning...", "No Hand Detected", "Analyzing...", "Camera Off", "Scanning (0 fingers)", "Scanning (1 fingers)", "Scanning (2 fingers)", "Scanning (3 fingers)", "Scanning (4 fingers)", "Scanning (5 fingers)"].includes(currentGesture.name);
  }, [currentGesture]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      {/* Background orbs */}
      <div className="mesh-bg-gradient"></div>
      <div className="mesh-bg-orb orb-1"></div>
      <div className="mesh-bg-orb orb-2"></div>
      <div className="mesh-bg-orb orb-3"></div>

      <div className="app-wrapper">
        {/* Header section */}
        <header>
          <div className="logo-section">
            <div className="logo-icon">🌊</div>
            <div className="app-title-wrapper">
              <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400">
                SignWave AI
              </h1>
              <div className="app-subtitle">Advanced Accessibility Suite</div>
            </div>
          </div>

          <div className={`badge ${cameraActive ? 'badge-pulse' : 'badge-offline'}`}>
            <span>{systemStatus}</span>
          </div>
        </header>

        {/* Dashboard Grid */}
        <main className="dashboard-grid">
          
          {/* Left Panel: Guide / Academy / Stats */}
          <section className="glass-panel" style={{ minHeight: '580px' }} aria-label="Learning and Reference">
            
            {/* Tab header buttons */}
            <div className="tab-navigation flex gap-1.5 border-b border-[var(--border-color)] pb-2.5 -mb-1">
              <button
                onClick={() => setActiveTab('guide')}
                className={`tab-btn flex-1 py-2 text-xs justify-center ${activeTab === 'guide' ? 'active' : ''}`}
              >
                📚 Guide
              </button>
              <button
                onClick={() => setActiveTab('academy')}
                className={`tab-btn flex-1 py-2 text-xs justify-center ${activeTab === 'academy' ? 'active' : ''}`}
              >
                🎓 Academy
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`tab-btn flex-1 py-2 text-xs justify-center ${activeTab === 'stats' ? 'active' : ''}`}
              >
                📈 Stats
              </button>
            </div>

            {/* Tab 1: Dictionary Guide */}
            {activeTab === 'guide' && (
              <div className="flex flex-col gap-3 h-full">
                <div className="panel-header border-none p-0">
                  <h2 className="text-lg">📚 Reference Dictionary</h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)] -mt-1.5">
                  Supported signs catalog. Click to preview target finger shapes.
                </p>

                <input
                  type="text"
                  placeholder="🔍 Search vocabulary..."
                  value={dictionarySearch}
                  onChange={(e) => setDictionarySearch(e.target.value)}
                  className="w-full px-3 py-2 bg-black/25 border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-sm outline-none transition-[var(--transition)]"
                />

                <div className="guide-list max-h-[380px] overflow-y-auto pr-1">
                  {filteredCustomDict.length > 0 && (
                    <>
                      <div className="text-[10px] text-[var(--accent)] font-semibold mt-2 uppercase tracking-wide">
                        Custom Registered Vocabulary
                      </div>
                      <div className="flex flex-col gap-2 mt-2 mb-2">
                        {filteredCustomDict.map((cg, idx) => (
                          <div
                            key={`custom-${idx}`}
                            className={`custom-dict-item cursor-pointer ${isGuideItemActive(cg.name) ? 'border-[var(--accent)] bg-cyan-500/10' : ''}`}
                            onClick={() => handleGuideItemClick(cg)}
                          >
                            <div className="custom-dict-info">
                              <span>{cg.emoji}</span>
                              <span className="custom-dict-name font-bold">{cg.name}</span>
                            </div>
                            <button
                              className="btn-delete-custom text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomGesture(idx);
                              }}
                            >
                              🗑️ Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="text-[10px] text-[var(--text-secondary)] font-semibold mt-2 uppercase tracking-wide">
                    Standard Vocabulary
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    {filteredStandardDict.map((item, idx) => (
                      <div
                        key={`std-${idx}`}
                        className={`guide-item ${isGuideItemActive(item.name) ? 'active' : ''}`}
                        onClick={() => handleGuideItemClick(item)}
                      >
                        <div className="guide-emoji">{item.emoji}</div>
                        <div className="guide-info">
                          <span className="guide-name">{item.name}</span>
                          <span className="guide-desc">{item.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: SignWave Academy */}
            {activeTab === 'academy' && (
              <div className="flex flex-col gap-3 h-full">
                <div className="panel-header border-none p-0">
                  <h2 className="text-lg">🎓 SignWave Academy</h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)] -mt-1.5">
                  Interactive training game. Verify your hand signs against the AI in real-time.
                </p>

                {!academyActive ? (
                  <div className="mic-control-card p-3 bg-cyan-500/5 border-cyan-500/20">
                    <span className="text-3xl">🎯</span>
                    <h3 className="text-sm font-semibold mt-1">Practice Gestures</h3>
                    <button onClick={startAcademy} className="primary px-4 py-1.5 text-xs mt-2">
                      Start Practice Mode
                    </button>
                  </div>
                ) : (
                  <div className="mic-control-card p-4 bg-black/25 text-left items-stretch">
                    <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-2">
                      <span>ACADEMY QUIZ</span>
                      <span className="font-bold text-[var(--accent)]">
                        Round: {academyRound}/5 | Score: {academyScore}
                      </span>
                    </div>

                    {academyTargetSign && (
                      <div className="text-center my-3">
                        <div className="text-[10px] text-[var(--text-secondary)] tracking-wider">SHOW THIS GESTURE:</div>
                        <div className="text-5xl my-1 animate-[float_2.5s_ease-in-out_infinite]">
                          {academyTargetSign.emoji}
                        </div>
                        <div className="font-bold text-lg text-[var(--text-primary)]">
                          {academyTargetSign.name}
                        </div>
                      </div>
                    )}

                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mb-1">
                        <span>Hold Position...</span>
                        <span>{academyTimer}s</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden border border-[var(--border-color)]">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-[width] duration-100 ease-linear"
                          style={{ width: `${academyHoldProgress}%` }}
                        ></div>
                      </div>
                    </div>

                    <button onClick={stopAcademy} className="danger py-1.5 text-xs mt-3.5 w-full justify-center">
                      Quit Practice
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Learning Stats & Cloud Sync */}
            {activeTab === 'stats' && (
              <div className="flex flex-col gap-3 h-full">
                <div className="panel-header border-none p-0">
                  <h2 className="text-lg">📈 Learning Analytics</h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)] -mt-1.5">
                  Track your educational progress and sync your stats locally.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="mic-control-card p-2 bg-white/5 border border-[var(--border-color)]">
                    <span className="text-lg">🔥</span>
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Streak</div>
                    <div className="text-sm font-bold text-[var(--accent)] mt-0.5">
                      {stats.streak} Day{stats.streak > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="mic-control-card p-2 bg-white/5 border border-[var(--border-color)]">
                    <span className="text-lg">🎯</span>
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Total Pts</div>
                    <div className="text-sm font-bold text-[var(--accent)] mt-0.5">
                      {stats.academyScore} Pts
                    </div>
                  </div>
                  <div className="mic-control-card p-2 bg-white/5 border border-[var(--border-color)]">
                    <span className="text-lg">🏷️</span>
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Custom Signs</div>
                    <div className="text-sm font-bold text-[var(--accent)] mt-0.5">
                      {customGestures.length} Saved
                    </div>
                  </div>
                  <div className="mic-control-card p-2 bg-white/5 border border-[var(--border-color)]">
                    <span className="text-lg">🎓</span>
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold">Rounds Played</div>
                    <div className="text-sm font-bold text-[var(--accent)] mt-0.5">
                      {stats.roundsPlayed} Round{stats.roundsPlayed > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="mic-control-card p-2.5 bg-cyan-500/5 border-cyan-500/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">☁️ Cloud Storage Sync</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                      syncStatus === 'synced' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : syncStatus === 'syncing'
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse'
                          : 'bg-white/5 text-[var(--text-muted)] border-[var(--border-color)]'
                    }`}>
                      {syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline Cache'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] text-left leading-normal">
                    Sync gestures & stats locally. Press Sync to simulate secure cloud upload.
                  </div>
                  <button
                    onClick={handleSyncCloud}
                    disabled={syncStatus === 'syncing'}
                    className="primary py-1.5 text-xs w-full justify-center mt-1"
                  >
                    {syncStatus === 'syncing' ? (
                      <>
                        <span className="spinner-icon mr-1">🔄</span> Syncing...
                      </>
                    ) : (
                      '🔄 Sync Data'
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Middle Workspace: Webcam feed & Sentence timeline */}
          <section className="workspace-column">
            
            {/* Webcam video & landmarks overlays */}
            <div className="glass-panel video-panel">
              <video
                ref={videoRef}
                id="webcam"
                autoPlay
                playsInline
                muted
                style={{ display: cameraActive ? 'block' : 'none' }}
              ></video>
              <canvas
                ref={canvasRef}
                id="output-canvas"
                style={{ display: cameraActive ? 'block' : 'none' }}
              ></canvas>

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-center p-4">
                  <span className="text-5xl mb-2">📷</span>
                  <div className="font-bold text-lg mb-1">Camera Offline</div>
                  <p className="text-xs text-[var(--text-secondary)] max-w-xs">
                    Please click "Start Camera" below to activate real-time sign language landmark tracking.
                  </p>
                </div>
              )}

              {cameraActive && (
                <div className="camera-overlay-ui">
                  <div className="badge bg-cyan-500/25 border-[var(--accent)] text-xs">
                    <span>SignWave tracking engine</span>
                  </div>
                </div>
              )}
            </div>

            {/* Gesture Detection Preview Panel */}
            <div className="glass-panel">
              <div className="detection-card">
                <div className="detected-emoji-large">
                  {cameraActive ? currentGesture.emoji || "✋" : "📷"}
                </div>
                <div className="detected-details">
                  <div className="detected-label">Current Prediction</div>
                  <div className="detected-name">
                    {cameraActive ? currentGesture.name || "Analyzing..." : "Camera Offline"}
                  </div>
                  <div className="detected-desc">
                    {cameraActive ? currentGesture.description || "Forming finger layout..." : "Select 'Start Camera' below to initialize recognition."}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center flex-wrap gap-2.5">
                <button
                  onClick={cameraActive ? stopCamera : startCamera}
                  className={cameraActive ? "danger primary" : "primary"}
                >
                  {cameraActive ? "🔌 Stop Camera" : "📷 Start Camera"}
                </button>

                {cameraActive && currentGesture.states && (
                  <div className="flex gap-1.5">
                    <span className={`badge text-[10px] py-1 ${currentGesture.states.thumb ? 'badge-pulse' : 'badge-offline'}`}>Thumb</span>
                    <span className={`badge text-[10px] py-1 ${currentGesture.states.index ? 'badge-pulse' : 'badge-offline'}`}>Index</span>
                    <span className={`badge text-[10px] py-1 ${currentGesture.states.middle ? 'badge-pulse' : 'badge-offline'}`}>Middle</span>
                    <span className={`badge text-[10px] py-1 ${currentGesture.states.ring ? 'badge-pulse' : 'badge-offline'}`}>Ring</span>
                    <span className={`badge text-[10px] py-1 ${currentGesture.states.pinky ? 'badge-pulse' : 'badge-offline'}`}>Pinky</span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Gesture studio */}
            <div className="glass-panel p-4">
              <div className="panel-header pb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">🏷️ Custom Gesture Studio</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-2.5">
                Map a unique hand shape to a personalized word (saved in your browser).
              </p>

              <div className="flex gap-2.5 items-center flex-wrap">
                <input
                  type="text"
                  placeholder="Enter meaning (e.g. Water)"
                  value={customGestureName}
                  onChange={(e) => setCustomGestureName(e.target.value)}
                  className="flex-1 min-w-[160px] px-3 py-2 bg-black/25 border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-xs outline-none"
                />

                <select
                  value={customGestureEmoji}
                  onChange={(e) => setCustomGestureEmoji(e.target.value)}
                  className="p-2 bg-black/25 border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-xs outline-none"
                >
                  <option value="🏷️">🏷️ Tag</option>
                  <option value="💧">💧 Water</option>
                  <option value="🍎">🍎 Food</option>
                  <option value="☕">☕ Drink</option>
                  <option value="🏠">🏠 House</option>
                  <option value="❤️">❤️ Love</option>
                  <option value="🤝">🤝 Help</option>
                  <option value="✏️">✏️ Custom</option>
                </select>

                <button
                  onClick={handleSaveCustomGesture}
                  className="py-2 px-3 text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-300 font-semibold"
                >
                  💾 Save Current Shape
                </button>
              </div>

              <div className="flex gap-2.5 mt-2.5 border-t border-[var(--border-color)] pt-2.5 flex-wrap">
                <button
                  onClick={exportCustomGestures}
                  className="flex-1 py-1.5 text-[10px] justify-center bg-white/2"
                >
                  📤 Export Custom Profile
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-1.5 text-[10px] justify-center bg-white/2"
                >
                  📥 Import Custom Profile
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImportFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Sentence timeline assembling builder */}
            <div className="glass-panel sentence-builder-panel">
              <div className="panel-header">
                <h2>✍️ Sentence Timeline</h2>
              </div>

              {/* Quick phrases grid */}
              <div className="flex flex-col gap-1.5 bg-black/15 p-3 rounded-[var(--radius-sm)] border border-[var(--border-color)]">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">⚡ Quick phrases</div>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => speakQuickPhrase("Need Help")} className="btn-quick-phrase py-1.5 text-xs justify-center bg-cyan-500/5 border-cyan-500/10">🤝 Help</button>
                  <button onClick={() => speakQuickPhrase("Thank You")} className="btn-quick-phrase py-1.5 text-xs justify-center bg-emerald-500/5 border-emerald-500/10">❤️ Thanks</button>
                  <button onClick={() => speakQuickPhrase("I need water")} className="btn-quick-phrase py-1.5 text-xs justify-center bg-blue-500/5 border-blue-500/10">💧 Water</button>
                  <button onClick={() => speakQuickPhrase("Emergency")} className="btn-quick-phrase py-1.5 text-xs justify-center bg-red-500/5 border-red-500/10 text-red-300">🚨 Alarm</button>
                </div>
              </div>

              {/* Timeline container textarea */}
              <textarea
                className="sentence-display-area"
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                placeholder="Type words here, click dictionary signs, or use camera to build your sentence..."
                style={{ fontSize: `calc(1.15rem * ${textMultiplier})` }}
              ></textarea>

              {/* Live Translation output */}
              <div className="bg-cyan-500/5 border border-cyan-500/10 p-2.5 px-3.5 rounded-[var(--radius-sm)]">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Translated Output</div>
                <div className="text-sm font-medium text-[var(--accent)] min-h-[22px] mt-1">
                  {translatedText}
                </div>
              </div>

              {/* Word timeline controls */}
              <div className="controls-row">
                <button
                  onClick={addWordToSentence}
                  disabled={!isValidSign || !cameraActive}
                  className="primary"
                >
                  ➕ Add to Sentence
                </button>
                <button
                  onClick={speakSentence}
                  disabled={!sentence.trim() || isSpeaking}
                >
                  🔊 {isSpeaking ? "Speaking..." : "Speak Sentence"}
                </button>
                <button
                  onClick={clearSentence}
                  disabled={!sentence.trim()}
                  className="danger"
                >
                  🗑️ Clear
                </button>
              </div>
            </div>

          </section>

          {/* Right Panel: Voice Translation Chat logs */}
          <section className="glass-panel chat-panel" aria-label="Voice Translation Hub">
            <div>
              <div className="panel-header">
                <h2>💬 Translation & Voice</h2>
                <button onClick={exportChatLog} className="py-1 px-2 text-[10px] bg-white/5 rounded-[var(--radius-sm)]" aria-label="Export chat log">
                  📤 Export Log
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-3 mt-1.5">
                For the hearing partner: speak into the microphone to display your words to the signer.
              </p>

              {/* Interactive log */}
              <div className="chat-log pr-1 overflow-y-auto" id="chat-log" role="log">
                {chatLog.map((chat, idx) => (
                  <div key={`chat-${idx}`} className={`chat-message ${chat.typeClass}`}>
                    <div className="chat-sender">{chat.sender}</div>
                    <div>{chat.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mic wave visualizer amplitude */}
            <div className="flex flex-col gap-4">
              <div className="mic-control-card">
                <button
                  onClick={toggleSpeechListening}
                  className={`mic-button ${micListening ? 'listening' : ''}`}
                  aria-label="Toggle Voice Input"
                >
                  {micListening ? '🎙️' : '🎤'}
                </button>

                <div className="h-[30px] flex items-center justify-center my-1 w-full">
                  <canvas
                    ref={voiceWaveCanvasRef}
                    id="voice-wave-canvas"
                    width="180"
                    height="30"
                    style={{ display: micListening ? 'block' : 'none', width: '180px', height: '30px' }}
                  ></canvas>
                </div>

                <div className="mic-status-text font-medium">{micStatus}</div>
                <div className="voice-command-hint leading-relaxed">
                  Voice controls: <strong>"clear sentence"</strong>, <strong>"speak sentence"</strong>, <strong>"backspace"</strong>
                </div>
              </div>

              {/* System accessibility adjustments */}
              <div className="accessibility-settings">
                
                {/* Translator languages */}
                <div className="setting-row">
                  <span className="setting-label">🌐 Output Speech Language</span>
                  <select
                    value={outputSpeechLang}
                    onChange={(e) => setOutputSpeechLang(e.target.value)}
                    className="px-2 py-1 bg-black/25 border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-xs outline-none"
                  >
                    <option value="en">English (Default)</option>
                    <option value="es">Español (Spanish)</option>
                    <option value="fr">Français (French)</option>
                    <option value="de">Deutsch (German)</option>
                    <option value="ja">日本語 (Japanese)</option>
                  </select>
                </div>

                {/* Voice Profile select option */}
                {filteredVoices.length > 0 && (
                  <div className="setting-row">
                    <span className="setting-label">👤 Voice Profile</span>
                    <select
                      value={voiceProfile || ""}
                      onChange={(e) => {
                        setVoiceProfile(e.target.value);
                        Speech.setCustomVoice(e.target.value);
                      }}
                      className="max-w-[170px] px-2 py-1 bg-black/25 border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-xs outline-none"
                    >
                      {filteredVoices.map((voice, idx) => (
                        <option key={`voice-${idx}`} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Draw Skeleton Accent Color Themes */}
                <div className="setting-row">
                  <span className="setting-label">🎨 Skeleton Color Theme</span>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                    className="px-2 py-1 bg-black/25 border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-xs outline-none"
                  >
                    <option value="cyberpunk">Oceanic Wave (Neon)</option>
                    <option value="gold">Volt Gold</option>
                    <option value="emerald">Emerald Sea</option>
                    <option value="ice">Ice Indigo</option>
                  </select>
                </div>

                {/* Standard presets ASL/ISL dictionary */}
                <div className="setting-row">
                  <span className="setting-label">🌐 Sign Language Preset</span>
                  <select
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as any)}
                    className="px-2 py-1 bg-black/25 border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-xs outline-none"
                  >
                    <option value="asl">American Sign Language (ASL)</option>
                    <option value="isl">Indian Sign Language (ISL)</option>
                  </select>
                </div>

                {/* Grammar Translation Toggle */}
                <div className="setting-row">
                  <span className="setting-label">🧠 Correct Signed Grammar</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={toggleGrammar}
                      onChange={(e) => setToggleGrammar(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                {/* Haptic alerts */}
                <div className="setting-row">
                  <span className="setting-label">📳 Haptic Vibration Alerts</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={toggleHaptic}
                      onChange={(e) => setToggleHaptic(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                {/* Contrast Displays */}
                <div className="setting-row">
                  <span className="setting-label">🕶️ High Contrast Display</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={toggleContrast}
                      onChange={(e) => setToggleContrast(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                {/* Text Sizing zoom */}
                <div className="setting-row">
                  <span className="setting-label">🔤 Display Text Size</span>
                  <div className="btn-group">
                    <button onClick={() => adjustFontSize(-0.1)} aria-label="Shrink Text">A-</button>
                    <button onClick={() => adjustFontSize(0.1)} aria-label="Enlarge Text">A+</button>
                  </div>
                </div>

                {/* Auto speak on word append */}
                <div className="setting-row">
                  <span className="setting-label">🔊 Auto-Speak Sign Additions</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={autoSpeak}
                      onChange={(e) => setAutoSpeak(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
};

export default App;

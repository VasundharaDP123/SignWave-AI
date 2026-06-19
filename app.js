/**
 * SignWave - Main Application Controller
 * 
 * Orchestrates camera feed, MediaPipe hand tracking, customizable skeleton color themes,
 * live audio visualizers, dynamic local system voice list loads, sign dictionary search filters,
 * conversation chat log file exporters, and quick phrase tiles.
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const video = document.getElementById("webcam");
    const canvas = document.getElementById("output-canvas");
    const ctx = canvas.getContext("2d");
    
    const cameraBadge = document.getElementById("camera-badge");
    const systemStatus = document.getElementById("system-status");
    const toggleCameraBtn = document.getElementById("btn-toggle-camera");
    
    const detectedEmoji = document.getElementById("detected-emoji");
    const detectedName = document.getElementById("detected-name");
    const detectedDesc = document.getElementById("detected-desc");
    const detectedStates = document.getElementById("detected-states");
    
    const btnAddWord = document.getElementById("btn-add-word");
    const btnClearSentence = document.getElementById("btn-clear-sentence");
    const btnSpeakSentence = document.getElementById("btn-speak-sentence");
    const sentenceContainer = document.getElementById("sentence-container");
    const translationPreview = document.getElementById("translation-preview");
    const translationLangSelect = document.getElementById("translation-lang-select");
    
    const btnMicToggle = document.getElementById("btn-mic-toggle");
    const micStatus = document.getElementById("mic-status");
    const chatLog = document.getElementById("chat-log");
    
    const guideItems = document.querySelectorAll(".guide-item");
    const toggleContrast = document.getElementById("toggle-contrast");
    const btnFontDec = document.getElementById("btn-font-dec");
    const btnFontInc = document.getElementById("btn-font-inc");
    const toggleAutoSpeak = document.getElementById("toggle-auto-speak");

    // V3: Audio Waveform DOM
    const voiceWaveCanvas = document.getElementById("voice-wave-canvas");
    const waveCtx = voiceWaveCanvas.getContext("2d");

    // V3: Custom Theme DOM
    const themeSelect = document.getElementById("theme-select");

    // V3: Custom System Voice DOM
    const voiceProfileRow = document.getElementById("voice-profile-row");
    const voiceProfileSelect = document.getElementById("voice-profile-select");

    // V3: Dictionary Search DOM
    const dictionarySearch = document.getElementById("dictionary-search");

    // V3: Emergency Phrases DOM
    const quickPhraseBtns = document.querySelectorAll(".btn-quick-phrase");

    // V3: Chat Exporter DOM
    const btnExportChat = document.getElementById("btn-export-chat");

    // Custom Gesture DOM Elements
    const customGestureName = document.getElementById("custom-gesture-name");
    const customGestureEmoji = document.getElementById("custom-gesture-emoji");
    const btnRecordGesture = document.getElementById("btn-record-gesture");
    const customDictHeader = document.getElementById("custom-dictionary-header");
    const customDictList = document.getElementById("custom-dictionary-list");

    // Academy Quiz DOM Elements
    const btnStartAcademy = document.getElementById("btn-start-academy");
    const btnStopAcademy = document.getElementById("btn-stop-academy");
    const academyIdleState = document.getElementById("academy-idle-state");
    const academyActiveState = document.getElementById("academy-active-state");
    const academyPromptEmoji = document.getElementById("academy-prompt-emoji");
    const academyPromptName = document.getElementById("academy-prompt-name");
    const academyScoreText = document.getElementById("academy-score");
    const academyTimerText = document.getElementById("academy-timer");
    const academyProgressBar = document.getElementById("academy-progress-bar");

    // --- State Variables ---
    let stream = null;
    let cameraActive = false;
    let currentGesture = null;
    let mediaPipeHands = null;
    let fontMultiplier = 1.0;
    let autoSpeakEnabled = true;

    // Custom Gestures database
    let customGestures = [];
    loadCustomGestures();

    // Debounce predictions to avoid rapid flickering
    let lastPredictionName = "";
    let predictionMatchCount = 0;
    const CONFIRM_THRESHOLD = 5;

    // Academy Practice States
    let academyActive = false;
    let academyScore = 0;
    let academyRound = 0;
    let academyTargetSign = null;
    let academyHoldProgress = 0; // 0 to 100%
    const HOLD_TIME_REQUIRED = 2000; // 2 seconds hold
    let academyInterval = null;
    let roundTimeLimit = 15; // 15 seconds per round
    let roundTimerInterval = null;

    // --- V3: Skeleton Custom Theme Mapping ---
    const THEMES = {
        cyberpunk: { bones: "rgba(139, 92, 246, 0.8)", joints: "#d946ef", tips: "#10b981", glow: "rgba(139, 92, 246, 0.6)" },
        gold: { bones: "rgba(245, 158, 11, 0.8)", joints: "#f97316", tips: "#fbbf24", glow: "rgba(245, 158, 11, 0.6)" },
        emerald: { bones: "rgba(20, 184, 166, 0.8)", joints: "#10b981", tips: "#22d3ee", glow: "rgba(20, 184, 166, 0.6)" },
        ice: { bones: "rgba(59, 130, 246, 0.8)", joints: "#6366f1", tips: "#38bdf8", glow: "rgba(59, 130, 246, 0.6)" }
    };

    // --- Skeleton Connection Maps ---
    const HAND_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [5, 9], [9, 13], [13, 17] // Knuckles
    ];

    // --- Web Audio Synthesizer for UI Tones ---
    function playBeep(frequency, duration, type = "sine") {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    }

    function playSuccessChime() {
        playBeep(587.33, 0.08); // D5
        setTimeout(() => playBeep(880, 0.15), 80); // A5
    }

    function playVictoryFanfare() {
        playBeep(523.25, 0.12); // C5
        setTimeout(() => playBeep(659.25, 0.12), 120); // E5
        setTimeout(() => playBeep(783.99, 0.12), 240); // G5
        setTimeout(() => playBeep(1046.50, 0.35), 360); // C6
    }

    function playFailBuzz() {
        playBeep(150, 0.35, "sawtooth");
    }

    // --- V3: Audio Visualizer Drawing Loop ---
    function renderAudioWave(dataArray) {
        waveCtx.clearRect(0, 0, voiceWaveCanvas.width, voiceWaveCanvas.height);
        
        const activeTheme = THEMES[themeSelect.value] || THEMES.cyberpunk;
        const barWidth = (voiceWaveCanvas.width / dataArray.length) * 1.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            barHeight = (dataArray[i] / 255) * voiceWaveCanvas.height * 0.95;
            
            // Draw gradient reflecting the active accent theme
            const grad = waveCtx.createLinearGradient(0, voiceWaveCanvas.height, 0, 0);
            grad.addColorStop(0, activeTheme.bones);
            grad.addColorStop(1, activeTheme.joints);
            
            waveCtx.fillStyle = grad;
            waveCtx.shadowBlur = 5;
            waveCtx.shadowColor = activeTheme.glow;
            
            // Center bars vertically
            const y = (voiceWaveCanvas.height - barHeight) / 2;
            waveCtx.fillRect(x, y, barWidth - 1.5, barHeight);
            
            x += barWidth;
        }
        waveCtx.shadowBlur = 0;
    }

    // --- Canvas Resize ---
    function resizeCanvas() {
        canvas.width = video.clientWidth || 640;
        canvas.height = video.clientHeight || 480;
    }
    window.addEventListener("resize", resizeCanvas);

    // --- MediaPipe Hands ---
    function initMediaPipe() {
        try {
            mediaPipeHands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            mediaPipeHands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.7
            });

            mediaPipeHands.onResults(onHandResults);
            systemStatus.textContent = "SignWave AI Ready";
        } catch (e) {
            console.error("Failed to load MediaPipe Hands:", e);
            systemStatus.textContent = "Offline Error";
        }
    }

    // --- Camera Handling ---
    async function startCamera() {
        systemStatus.textContent = "Opening camera...";
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: "user" },
                audio: false
            });
            video.srcObject = stream;
            await video.play();
            
            cameraActive = true;
            cameraBadge.className = "badge badge-pulse";
            cameraBadge.innerHTML = '<span id="system-status">SignWave Active</span>';
            toggleCameraBtn.innerHTML = "🔌 Stop Camera";
            toggleCameraBtn.classList.add("danger");
            
            resizeCanvas();
            startCaptureLoop();
        } catch (err) {
            console.error("Camera access failed:", err);
            systemStatus.textContent = "Camera Blocked";
            alert("Webcam blocked. Please update camera site permissions in browser settings.");
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        cameraActive = false;
        cameraBadge.className = "badge badge-offline";
        cameraBadge.innerHTML = '<span id="system-status">Camera Offline</span>';
        toggleCameraBtn.innerHTML = "📷 Start Camera";
        toggleCameraBtn.classList.remove("danger");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        updateGestureUI({ name: "Camera Off", emoji: "📷", description: "Start camera to scan gestures." });
        if (academyActive) stopAcademy();
    }

    async function startCaptureLoop() {
        if (!cameraActive) return;
        const captureFrame = async () => {
            if (!cameraActive) return;
            try {
                await mediaPipeHands.send({ image: video });
            } catch (err) {
                console.error("Frame skip:", err);
            }
            requestAnimationFrame(captureFrame);
        };
        requestAnimationFrame(captureFrame);
    }

    // --- MediaPipe Callback & Theme-Driven Draw ---
    function onHandResults(results) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // V3: Get Active skeleton theme parameters
            const activeTheme = THEMES[themeSelect.value] || THEMES.cyberpunk;

            // Draw skeleton lines (Bones)
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

            // Draw joints (Knuckles vs Tips)
            ctx.shadowBlur = 10;
            for (let i = 0; i < landmarks.length; i++) {
                const pt = landmarks[i];
                ctx.beginPath();
                ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 6, 0, 2 * Math.PI);
                
                if ([4, 8, 12, 16, 20].includes(i)) {
                    ctx.fillStyle = activeTheme.tips; // Tip
                    ctx.shadowColor = activeTheme.tips;
                } else {
                    ctx.fillStyle = activeTheme.joints; // Knuckle
                    ctx.shadowColor = activeTheme.joints;
                }
                ctx.fill();
            }

            ctx.shadowBlur = 0;

            // Run predictions
            const gesture = predictGesture(landmarks, customGestures);
            handleStableGesture(gesture);
        } else {
            handleStableGesture({ name: "Scanning...", emoji: "✋", description: "Hold hand clearly in webcam feed." });
        }
    }

    function handleStableGesture(gesture) {
        if (gesture.name === lastPredictionName) {
            predictionMatchCount++;
        } else {
            lastPredictionName = gesture.name;
            predictionMatchCount = 0;
        }

        if (predictionMatchCount >= CONFIRM_THRESHOLD || gesture.name.includes("Scanning") || gesture.name.includes("No Hand") || gesture.name.includes("Camera Off")) {
            currentGesture = gesture;
            updateGestureUI(currentGesture);
            
            const isValidSign = !["Scanning...", "No Hand Detected", "Analyzing...", "Camera Off", "Scanning (0 fingers)", "Scanning (1 fingers)", "Scanning (2 fingers)", "Scanning (3 fingers)", "Scanning (4 fingers)", "Scanning (5 fingers)"].includes(gesture.name);
            btnAddWord.disabled = !isValidSign;
            
            highlightGuideItem(gesture.name);
        }
    }

    // --- UI Render ---
    function updateGestureUI(gesture) {
        detectedEmoji.textContent = gesture.emoji || "👋";
        detectedName.textContent = gesture.name || "Ready";
        detectedDesc.textContent = gesture.description || "Start camera to begin.";

        if (gesture.states) {
            detectedStates.innerHTML = `
                <span class="badge ${gesture.states.thumb ? 'badge-pulse' : 'badge-offline'}">Thumb</span>
                <span class="badge ${gesture.states.index ? 'badge-pulse' : 'badge-offline'}">Index</span>
                <span class="badge ${gesture.states.middle ? 'badge-pulse' : 'badge-offline'}">Middle</span>
                <span class="badge ${gesture.states.ring ? 'badge-pulse' : 'badge-offline'}">Ring</span>
                <span class="badge ${gesture.states.pinky ? 'badge-pulse' : 'badge-offline'}">Pinky</span>
            `;
        } else {
            detectedStates.innerHTML = '';
        }
    }

    function highlightGuideItem(gestureName) {
        const items = document.querySelectorAll(".guide-item, .custom-dict-item");
        items.forEach(item => {
            const nameEl = item.querySelector(".guide-name") || item.querySelector(".custom-dict-name");
            if (!nameEl) return;
            const name = nameEl.textContent;
            if (gestureName.includes(name) || name.includes(gestureName)) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
    }

    // --- Custom Gestures Module ---

    function loadCustomGestures() {
        const saved = localStorage.getItem("signwave_custom_gestures");
        if (saved) {
            try {
                customGestures = JSON.parse(saved);
                renderCustomDictionary();
            } catch (e) {
                console.error("Error reading custom vocabulary database:", e);
                customGestures = [];
            }
        }
    }

    function saveCustomGestures() {
        localStorage.setItem("signwave_custom_gestures", JSON.stringify(customGestures));
        renderCustomDictionary();
    }

    function recordCurrentGesture() {
        const name = customGestureName.value.trim();
        const emoji = customGestureEmoji.value;

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
        
        customGestures.push({
            name: name,
            emoji: emoji,
            description: "Custom recorded hand shape mapping.",
            states: capturedStates
        });

        saveCustomGestures();
        customGestureName.value = "";
        
        playSuccessChime();
        appendChatMessage("System", `Successfully registered custom gesture: "${name}" ${emoji}`, "signer");
    }

    function deleteCustomGesture(index) {
        const deleted = customGestures[index];
        customGestures.splice(index, 1);
        saveCustomGestures();
        appendChatMessage("System", `Deleted custom gesture: "${deleted.name}"`, "vocalist");
    }

    function renderCustomDictionary() {
        customDictList.innerHTML = "";
        
        if (customGestures.length === 0) {
            customDictHeader.style.display = "none";
            return;
        }

        customDictHeader.style.display = "block";
        
        customGestures.forEach((cg, idx) => {
            const item = document.createElement("div");
            item.className = "custom-dict-item";
            
            const info = document.createElement("div");
            info.className = "custom-dict-info";
            
            const emojiEl = document.createElement("span");
            emojiEl.textContent = cg.emoji;
            
            const nameEl = document.createElement("span");
            nameEl.className = "custom-dict-name";
            nameEl.textContent = cg.name;
            nameEl.style.fontWeight = "bold";

            info.appendChild(emojiEl);
            info.appendChild(nameEl);
            
            const delBtn = document.createElement("button");
            delBtn.className = "btn-delete-custom";
            delBtn.textContent = "🗑️ Remove";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteCustomGesture(idx);
            };

            item.appendChild(info);
            item.appendChild(delBtn);
            
            item.onclick = () => {
                currentGesture = {
                    name: cg.name,
                    emoji: cg.emoji,
                    description: `Custom registered sign. Matching states: Thumb: ${cg.states.thumb ? 'UP' : 'DOWN'}, Index: ${cg.states.index ? 'UP' : 'DOWN'}.`
                };
                updateGestureUI(currentGesture);
                btnAddWord.disabled = false;
            };

            customDictList.appendChild(item);
        });
    }

    // --- SignWave Academy (Practice Mode) ---

    function startAcademy() {
        if (!cameraActive) {
            alert("Please activate the camera before entering the Academy practice sessions.");
            return;
        }
        
        academyActive = true;
        academyScore = 0;
        academyRound = 0;
        
        academyIdleState.style.display = "none";
        academyActiveState.style.display = "block";
        
        appendChatMessage("SignWave Academy", "Starting practice session. Try to match the prompts on the left screen!", "signer");
        nextAcademyRound();
        
        academyInterval = setInterval(checkAcademyProgress, 100);
    }

    function stopAcademy() {
        academyActive = false;
        clearInterval(academyInterval);
        clearInterval(roundTimerInterval);
        
        academyIdleState.style.display = "block";
        academyActiveState.style.display = "none";
        
        appendChatMessage("SignWave Academy", "Practice session ended.", "vocalist");
    }

    function nextAcademyRound() {
        academyRound++;
        if (academyRound > 5) {
            playVictoryFanfare();
            appendChatMessage("SignWave Academy", `🎉 Congratulations! You completed the academy quiz. Final Score: ${academyScore}/5`, "signer");
            stopAcademy();
            return;
        }

        const standardList = [
            { name: "Thumbs Up", emoji: "👍" },
            { name: "Peace / 'V'", emoji: "✌️" },
            { name: "L Sign", emoji: "👉" },
            { name: "I Love You", emoji: "🤟" },
            { name: "OK", emoji: "👌" },
            { name: "Call Me", emoji: "🤙" },
            { name: "Fist / 'A'", emoji: "✊" }
        ];

        const customList = customGestures.map(cg => ({ name: cg.name, emoji: cg.emoji }));
        const mergedList = [...standardList, ...customList];

        const randomIdx = Math.floor(Math.random() * mergedList.length);
        academyTargetSign = mergedList[randomIdx];
        
        academyPromptEmoji.textContent = academyTargetSign.emoji;
        academyPromptName.textContent = academyTargetSign.name;
        academyScoreText.textContent = `Round: ${academyRound}/5 | Score: ${academyScore}`;
        
        academyHoldProgress = 0;
        academyProgressBar.style.width = "0%";
        
        roundTimeLimit = 15;
        academyTimerText.textContent = `${roundTimeLimit}s`;
        
        clearInterval(roundTimerInterval);
        roundTimerInterval = setInterval(() => {
            roundTimeLimit--;
            academyTimerText.textContent = `${roundTimeLimit}s`;
            if (roundTimeLimit <= 0) {
                playFailBuzz();
                appendChatMessage("SignWave Academy", `Round ${academyRound} timed out! Target sign was: "${academyTargetSign.name}".`, "vocalist");
                nextAcademyRound();
            }
        }, 1000);
    }

    function checkAcademyProgress() {
        if (!academyActive || !academyTargetSign) return;

        const activeName = currentGesture ? currentGesture.name : "";
        const targetName = academyTargetSign.name;

        const isMatch = activeName === targetName || 
                        activeName.includes(targetName) || 
                        targetName.includes(activeName);

        if (isMatch && cameraActive) {
            academyHoldProgress += 5; // 2 seconds
            academyHoldProgress = Math.min(100, academyHoldProgress);
        } else {
            academyHoldProgress = Math.max(0, academyHoldProgress - 10);
        }

        academyProgressBar.style.width = `${academyHoldProgress}%`;

        if (academyHoldProgress >= 100) {
            clearInterval(roundTimerInterval);
            academyScore++;
            playSuccessChime();
            
            academyActiveState.classList.add("academy-success");
            setTimeout(() => {
                academyActiveState.classList.remove("academy-success");
            }, 1000);

            appendChatMessage("SignWave Academy", `🎯 Correctly held gesture: "${targetName}"!`, "signer");
            nextAcademyRound();
        }
    }

    // --- Multi-Language Translation ---

    async function updateTranslationDisplay() {
        const sentenceText = sentenceContainer.value.trim();
        if (sentenceText.length === 0) {
            translationPreview.innerHTML = '<span style="color: var(--text-muted);">Original translation...</span>';
            return;
        }

        const targetLang = translationLangSelect.value;

        if (targetLang === "en") {
            translationPreview.textContent = sentenceText;
            return;
        }

        translationPreview.textContent = "Translating...";
        const translated = await window.Speech.translate(sentenceText, targetLang);
        translationPreview.textContent = translated;
    }

    // --- V3: System Voice Dropdown Populator ---
    function populateVoicesDropdown() {
        const targetLang = translationLangSelect.value;
        const allVoices = window.Speech.getAllSystemVoices();
        
        voiceProfileSelect.innerHTML = "";

        // Filter voices that match active language
        let filtered = allVoices.filter(v => v.lang.toLowerCase().startsWith(targetLang.toLowerCase()));
        
        if (targetLang === "en") {
            // Include all English voices
            filtered = allVoices.filter(v => v.lang.toLowerCase().startsWith("en"));
        }

        if (filtered.length > 0) {
            voiceProfileRow.style.display = "flex";
            
            filtered.forEach(voice => {
                const opt = document.createElement("option");
                opt.value = voice.name;
                opt.textContent = `${voice.name} (${voice.lang})`;
                voiceProfileSelect.appendChild(opt);
            });

            // Bind first voice by default
            window.Speech.setCustomVoice(voiceProfileSelect.value);
        } else {
            voiceProfileRow.style.display = "none";
            window.Speech.setCustomVoice(null); // Clear custom profile, fallback to default lang matching
        }
    }

    // --- V3: Real-time Dictionary Search Filter ---
    dictionarySearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        // Filter standard list items
        document.querySelectorAll("#dictionary-guide .guide-item").forEach(item => {
            const name = item.querySelector(".guide-name").textContent.toLowerCase();
            const desc = item.querySelector(".guide-desc").textContent.toLowerCase();
            
            if (name.includes(query) || desc.includes(query)) {
                item.style.display = "flex";
            } else {
                item.style.display = "none";
            }
        });

        // Filter custom registered items
        document.querySelectorAll("#custom-dictionary-list .custom-dict-item").forEach(item => {
            const name = item.querySelector(".custom-dict-name").textContent.toLowerCase();
            
            if (name.includes(query)) {
                item.style.display = "flex";
            } else {
                item.style.display = "none";
            }
        });
    });

    // --- V3: Emergency / Quick Phrase Handlers ---
    quickPhraseBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const phrase = btn.getAttribute("data-phrase");
            speakQuickPhrase(phrase);
        });
    });

    async function speakQuickPhrase(phrase) {
        const targetLang = translationLangSelect.value;
        
        if (targetLang === "en") {
            appendChatMessage("Signer (Quick Phrase)", phrase, "signer");
            window.Speech.speak(phrase, 'en-US');
            
            // Also append to textarea
            const currentText = sentenceContainer.value.trim();
            sentenceContainer.value = currentText ? `${currentText} ${phrase}` : phrase;
            renderSentence();
            updateTranslationDisplay();
        } else {
            const translated = await window.Speech.translate(phrase, targetLang);
            appendChatMessage("Signer (Quick Phrase)", `${translated} ("${phrase}")`, "signer");
            
            const voiceAccents = { es: "es-ES", fr: "fr-FR", de: "de-DE", ja: "ja-JP" };
            const accent = voiceAccents[targetLang] || targetLang;

            window.Speech.speak(translated, accent);
            
            // Also append to textarea
            const currentText = sentenceContainer.value.trim();
            sentenceContainer.value = currentText ? `${currentText} ${phrase}` : phrase;
            renderSentence();
            updateTranslationDisplay();
        }
    }

    // --- V3: Conversation Exporter ---
    btnExportChat.addEventListener("click", () => {
        const chatMessages = document.querySelectorAll(".chat-message");
        if (chatMessages.length <= 1) {
            alert("No logs to export yet. Build some sentences or speak to create logs.");
            return;
        }

        let logText = `========================================\n`;
        logText += `   SIGNWAVE AI ACCESS LOG\n`;
        logText += `   Date: ${new Date().toLocaleString()}\n`;
        logText += `========================================\n\n`;

        chatMessages.forEach(msg => {
            const sender = msg.querySelector(".chat-sender").textContent;
            const content = msg.lastChild.textContent;
            logText += `[${sender}]: ${content}\n`;
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
    });

    // --- Sentence Builder Actions ---
    function addWordToSentence() {
        if (!currentGesture) return;
        
        let wordToAdd = currentGesture.name;
        if (wordToAdd.includes(" / ")) {
            wordToAdd = wordToAdd.split(" / ")[0];
        }

        const currentText = sentenceContainer.value.trim();
        sentenceContainer.value = currentText ? `${currentText} ${wordToAdd}` : wordToAdd;
        
        renderSentence();
        updateTranslationDisplay();

        if (autoSpeakEnabled) {
            window.Speech.speak(wordToAdd);
        }
    }

    function renderSentence() {
        const hasText = sentenceContainer.value.trim().length > 0;
        btnSpeakSentence.disabled = !hasText;
        btnClearSentence.disabled = !hasText;
    }

    function clearSentence() {
        sentenceContainer.value = "";
        renderSentence();
        updateTranslationDisplay();
    }

    async function speakSentence() {
        const text = sentenceContainer.value.trim();
        if (!text) return;

        const targetLang = translationLangSelect.value;
        
        if (targetLang === "en") {
            appendChatMessage("Signer", text, "signer");
            window.Speech.speak(
                text,
                'en-US',
                () => { btnSpeakSentence.innerHTML = "🔊 Speaking..."; },
                () => { btnSpeakSentence.innerHTML = "🔊 Speak Sentence"; },
                () => { btnSpeakSentence.innerHTML = "🔊 Speak Sentence"; }
            );
        } else {
            const translated = await window.Speech.translate(text, targetLang);
            appendChatMessage(`Signer (Translated)`, `${translated} ("${text}")`, "signer");
            
            const voiceAccents = { es: "es-ES", fr: "fr-FR", de: "de-DE", ja: "ja-JP" };
            const accent = voiceAccents[targetLang] || targetLang;

            window.Speech.speak(
                translated,
                accent,
                () => { btnSpeakSentence.innerHTML = "🔊 Speaking..."; },
                () => { btnSpeakSentence.innerHTML = "🔊 Speak Sentence"; },
                () => { btnSpeakSentence.innerHTML = "🔊 Speak Sentence"; }
            );
        }
    }

    function appendChatMessage(sender, text, typeClass) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `chat-message ${typeClass}`;
        
        const senderSpan = document.createElement("div");
        senderSpan.className = "chat-sender";
        senderSpan.textContent = sender;
        
        const contentDiv = document.createElement("div");
        contentDiv.textContent = text;
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(contentDiv);
        
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    // --- Speech Recognition & Visualizer ---
    let isListening = false;
    
    function toggleSpeechListening() {
        if (!window.Speech.recognition) {
            alert("Voice Recognition is not supported in this browser version or context. Please use Google Chrome or Microsoft Edge, and ensure you have granted microphone permissions in your site settings.");
            return;
        }
        if (isListening) {
            window.Speech.stopListening((listening) => {
                isListening = listening;
                updateMicUI();
                voiceWaveCanvas.style.display = "none";
            });
        } else {
            voiceWaveCanvas.style.display = "block";
            
            window.Speech.startListening(
                (transcript) => {
                    micStatus.textContent = `"${transcript.interim || transcript.final}"`;
                    if (transcript.final) {
                        appendChatMessage("Voice Reply", transcript.final, "vocalist");
                        micStatus.textContent = "Listening...";
                    }
                },
                (command) => {
                    handleVoiceCommand(command);
                },
                (listening) => {
                    isListening = listening;
                    updateMicUI();
                }
            );

            // V3: Pipeline mic levels to audio waveform drawing loop
            window.Speech.startVisualizerStream((dataArray) => {
                renderAudioWave(dataArray);
            });
        }
    }

    function updateMicUI() {
        if (isListening) {
            btnMicToggle.classList.add("listening");
            btnMicToggle.innerHTML = "🎙️";
            micStatus.textContent = "Listening... Speak now";
        } else {
            btnMicToggle.classList.remove("listening");
            btnMicToggle.innerHTML = "🎤";
            micStatus.textContent = "Click microphone to translate voice response";
        }
    }

    function handleVoiceCommand(command) {
        switch (command.action) {
            case "clear":
                clearSentence();
                appendChatMessage("Voice Command", "Cleared timeline.", "vocalist");
                break;
            case "speak_sentence":
                speakSentence();
                break;
            case "delete_word":
                const words = sentenceContainer.value.trim().split(" ");
                words.pop();
                sentenceContainer.value = words.join(" ");
                renderSentence();
                updateTranslationDisplay();
                appendChatMessage("Voice Command", "Deleted last word.", "vocalist");
                break;
            case "add_sign":
                if (btnAddWord.disabled === false) {
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
    }

    // --- Accessibility Settings ---
    function adjustFontSize(delta) {
        fontMultiplier = Math.max(0.8, Math.min(1.8, fontMultiplier + delta));
        document.documentElement.style.setProperty("--font-multiplier", fontMultiplier);
        document.querySelector(".sentence-display-area").style.fontSize = `calc(1.15rem * ${fontMultiplier})`;
    }

    // --- Event Bindings ---
    toggleCameraBtn.addEventListener("click", () => {
        if (cameraActive) {
            stopCamera();
        } else {
            startCamera();
        }
    });

    btnAddWord.addEventListener("click", addWordToSentence);
    btnClearSentence.addEventListener("click", clearSentence);
    btnSpeakSentence.addEventListener("click", speakSentence);
    btnMicToggle.addEventListener("click", toggleSpeechListening);

    // Custom gesture binds
    btnRecordGesture.addEventListener("click", recordCurrentGesture);

    // Academy Quiz binds
    btnStartAcademy.addEventListener("click", startAcademy);
    btnStopAcademy.addEventListener("click", stopAcademy);

    // Translation Selector & Voice loader integrations
    translationLangSelect.addEventListener("change", () => {
        updateTranslationDisplay();
        populateVoicesDropdown();
    });

    voiceProfileSelect.addEventListener("change", (e) => {
        window.Speech.setCustomVoice(e.target.value);
    });

    // Accessibility binds
    toggleContrast.addEventListener("change", (e) => {
        if (e.target.checked) {
            document.body.classList.add("high-contrast");
        } else {
            document.body.classList.remove("high-contrast");
        }
    });

    btnFontDec.addEventListener("click", () => adjustFontSize(-0.1));
    btnFontInc.addEventListener("click", () => adjustFontSize(0.1));
    
    toggleAutoSpeak.addEventListener("change", (e) => {
        autoSpeakEnabled = e.target.checked;
    });

    // Reference guides click simulation
    guideItems.forEach(item => {
        item.addEventListener("click", () => {
            const name = item.querySelector(".guide-name").textContent;
            const emoji = item.querySelector(".guide-emoji").textContent;
            const desc = item.querySelector(".guide-desc").textContent;
            
            currentGesture = {
                name: name,
                emoji: emoji,
                description: desc
            };
            
            updateGestureUI(currentGesture);
            btnAddWord.disabled = false;
        });
    });

    // V3: Load custom voices on startup or system changes
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
            populateVoicesDropdown();
        };
    }
    setTimeout(populateVoicesDropdown, 500); // Fail-safe loader

    // --- Init App ---
    initMediaPipe();
    resizeCanvas();
    renderSentence();
});

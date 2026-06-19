/**
 * SignWave - Main Application Controller
 * 
 * Orchestrates camera feed, MediaPipe hand tracking, custom landmark canvas,
 * custom gesture storage, interactive quiz loops with Web Audio synthesizers,
 * and live sentence translation.
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
    let sentenceWords = [];
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

    // --- Skeleton Connection Maps ---
    const HAND_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [5, 9], [9, 13], [13, 17] // Knuckles
    ];

    // --- Web Audio Synthesizer for Audio Feedback ---
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
            console.log("Audio feedback blocked by browser policies.");
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

    // --- MediaPipe Callback & Glowing Draw ---
    function onHandResults(results) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // Draw skeleton lines (glowing violet)
            ctx.shadowBlur = 6;
            ctx.shadowColor = "rgba(139, 92, 246, 0.6)";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(139, 92, 246, 0.8)";
            ctx.lineCap = "round";

            for (const connection of HAND_CONNECTIONS) {
                const pt1 = landmarks[connection[0]];
                const pt2 = landmarks[connection[1]];
                ctx.beginPath();
                ctx.moveTo(pt1.x * canvas.width, pt1.y * canvas.height);
                ctx.lineTo(pt2.x * canvas.width, pt2.y * canvas.height);
                ctx.stroke();
            }

            // Draw joints (magenta joints, green tips)
            ctx.shadowBlur = 10;
            for (let i = 0; i < landmarks.length; i++) {
                const pt = landmarks[i];
                ctx.beginPath();
                ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 6, 0, 2 * Math.PI);
                
                if ([4, 8, 12, 16, 20].includes(i)) {
                    ctx.fillStyle = "#10b981"; // Tip
                    ctx.shadowColor = "#10b981";
                } else {
                    ctx.fillStyle = "#d946ef"; // Knuckle
                    ctx.shadowColor = "#d946ef";
                }
                ctx.fill();
            }

            ctx.shadowBlur = 0;

            // Run math predictions (passing custom gestures database)
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
            
            // Enable button if prediction is solid
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
        // Highlight active guide
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

        // Validate duplicates
        const exists = customGestures.some(cg => cg.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert(`A gesture named "${name}" is already registered. Delete the existing one first.`);
            return;
        }

        // Capture active finger structure
        const capturedStates = { ...currentGesture.states };
        
        customGestures.push({
            name: name,
            emoji: emoji,
            description: "Custom recorded hand shape mapping.",
            states: capturedStates
        });

        saveCustomGestures();
        customGestureName.value = "";
        
        // Local synth confirmation
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
            
            // Preview shape mapping upon clicking
            item.onclick = () => {
                updateGestureUI({
                    name: cg.name,
                    emoji: cg.emoji,
                    description: `Custom registered sign. Matching states: Thumb: ${cg.states.thumb ? 'UP' : 'DOWN'}, Index: ${cg.states.index ? 'UP' : 'DOWN'}.`,
                    states: cg.states
                });
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
        
        // Start checker intervals
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
            // Academy Quiz Completion
            playVictoryFanfare();
            appendChatMessage("SignWave Academy", `🎉 Congratulations! You completed the academy quiz. Final Score: ${academyScore}/5`, "signer");
            stopAcademy();
            return;
        }

        // Compile list of potential target signs (standard + custom)
        const standardList = [
            { name: "Thumbs Up", emoji: "👍" },
            { name: "Peace / 'V'", emoji: "✌️" },
            { name: "L Sign", emoji: "👉" },
            { name: "I Love You", emoji: "🤟" },
            { name: "OK", emoji: "👌" },
            { name: "Call Me", emoji: "🤙" },
            { name: "Fist / 'A'", emoji: "✊" }
        ];

        // Merge user custom items to keep training personalized
        const customList = customGestures.map(cg => ({ name: cg.name, emoji: cg.emoji }));
        const mergedList = [...standardList, ...customList];

        // Select random target sign
        const randomIdx = Math.floor(Math.random() * mergedList.length);
        academyTargetSign = mergedList[randomIdx];
        
        academyPromptEmoji.textContent = academyTargetSign.emoji;
        academyPromptName.textContent = academyTargetSign.name;
        academyScoreText.textContent = `Round: ${academyRound}/5 | Score: ${academyScore}`;
        
        // Reset timers
        academyHoldProgress = 0;
        academyProgressBar.style.width = "0%";
        
        roundTimeLimit = 15;
        academyTimerText.textContent = `${roundTimeLimit}s`;
        
        clearInterval(roundTimerInterval);
        roundTimerInterval = setInterval(() => {
            roundTimeLimit--;
            academyTimerText.textContent = `${roundTimeLimit}s`;
            if (roundTimeLimit <= 0) {
                // Out of time
                playFailBuzz();
                appendChatMessage("SignWave Academy", `Round ${academyRound} timed out! Target sign was: "${academyTargetSign.name}".`, "vocalist");
                nextAcademyRound();
            }
        }, 1000);
    }

    function checkAcademyProgress() {
        if (!academyActive || !academyTargetSign) return;

        // Verify if active hand prediction matches target
        const activeName = currentGesture ? currentGesture.name : "";
        const targetName = academyTargetSign.name;

        // Check matching conditions (either exact matches or partial overlaps)
        const isMatch = activeName === targetName || 
                        activeName.includes(targetName) || 
                        targetName.includes(activeName);

        if (isMatch && cameraActive) {
            // Increase progress
            academyHoldProgress += 5; // Takes 20 steps (2 seconds)
            academyHoldProgress = Math.min(100, academyHoldProgress);
        } else {
            // Drop progress if match breaks
            academyHoldProgress = Math.max(0, academyHoldProgress - 10);
        }

        academyProgressBar.style.width = `${academyHoldProgress}%`;

        if (academyHoldProgress >= 100) {
            // Point scored!
            clearInterval(roundTimerInterval);
            academyScore++;
            playSuccessChime();
            
            // HUD Flash Effect
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
        if (sentenceWords.length === 0) {
            translationPreview.innerHTML = '<span style="color: var(--text-muted);">Original translation...</span>';
            return;
        }

        const sentenceText = sentenceWords.join(" ");
        const targetLang = translationLangSelect.value;

        if (targetLang === "en") {
            translationPreview.textContent = sentenceText;
            return;
        }

        translationPreview.textContent = "Translating...";
        
        // Invoke translation fetch
        const translated = await window.Speech.translate(sentenceText, targetLang);
        translationPreview.textContent = translated;
    }

    // --- Sentence Builder Actions ---
    function addWordToSentence() {
        if (!currentGesture) return;
        
        let wordToAdd = currentGesture.name;
        if (wordToAdd.includes(" / ")) {
            wordToAdd = wordToAdd.split(" / ")[0];
        }

        sentenceWords.push(wordToAdd);
        renderSentence();
        updateTranslationDisplay();

        if (autoSpeakEnabled) {
            window.Speech.speak(wordToAdd);
        }
    }

    function renderSentence() {
        sentenceContainer.innerHTML = "";
        
        if (sentenceWords.length === 0) {
            sentenceContainer.innerHTML = '<span class="sentence-display-placeholder">Assembled signs will display here...</span>';
            btnSpeakSentence.disabled = true;
            btnClearSentence.disabled = true;
            return;
        }

        btnSpeakSentence.disabled = false;
        btnClearSentence.disabled = false;

        sentenceWords.forEach((word) => {
            const bubble = document.createElement("div");
            bubble.className = "word-bubble";
            bubble.textContent = word;
            sentenceContainer.appendChild(bubble);
        });
    }

    function clearSentence() {
        sentenceWords = [];
        renderSentence();
        updateTranslationDisplay();
    }

    async function speakSentence() {
        const text = sentenceWords.join(" ");
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
            // Translate first, then speak in native accent
            const translated = await window.Speech.translate(text, targetLang);
            appendChatMessage(`Signer (Translated)`, `${translated} ("${text}")`, "signer");
            
            // Map simple lang codes to browser synth speech parameters
            const voiceAccents = {
                es: "es-ES",
                fr: "fr-FR",
                de: "de-DE",
                ja: "ja-JP"
            };
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

    // --- Speech Recognition ---
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
            });
        } else {
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
                sentenceWords.pop();
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
        document.querySelector(".sentence-display-area").style.fontSize = `calc(1.2rem * ${fontMultiplier})`;
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

    // Translation Selector
    translationLangSelect.addEventListener("change", updateTranslationDisplay);

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

    // Reference guides
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

    // --- Init App ---
    initMediaPipe();
    resizeCanvas();
    renderSentence();
});

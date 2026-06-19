# SignWave - AI Sign Language Suite & Practice Hub

SignWave is a premium, fully client-side accessibility web application. It uses real-time computer vision (MediaPipe Hands) to translate hand gestures into speech, record custom hand shapes, practice sign accuracy through a real-time gamified HUD, and translate constructed sentences into multiple languages.

---

## 🌟 Key Features

1. **Real-time Sign Recognition**: Maps 21 hand joints (X, Y, Z) at 30+ FPS and predicts gesture shapes directly in your browser.
2. **Neon Skeleton Render**: Transparent overlay rendering hand skeletons with glowing violet bones and green/magenta tracking joints.
3. **Dynamic Custom Gesture Studio**: Capture any hand shape in real-time, name it (e.g. *Water*, *Help*), select an emoji, and save it in the browser's `localStorage`. Saved gestures override default vocabulary.
4. **SignWave Academy (Practice Game)**: A gamified HUD that challenges you to show random signs. Verify holding accuracy over a 2-second interval, complete with built-in native synthesizer feedback (success beeps, victory fanfare, and error buzzes).
5. **Multi-Language Translator**: Select from Spanish, French, German, or Japanese, and dynamically translate sign sentences via the free, client-side MyMemory API.
6. **Localized Speech Accents**: Text-to-Speech synthesis automatically matches your browser's local regional voices (e.g., reads Spanish translations with a Spanish accent, Japanese with a Japanese accent).
7. **Accessibility Suite**: Features High Contrast Display mode, adjustable font zoom levels (+/-), and toggles for Auto-Speak.
8. **Speech-to-Text & Voice Command Navigation**: Transcribes hearing speakers' voices and supports hands-free controls (*"clear sentence"*, *"delete word"*, *"speak sentence"*).

---

## 🚀 How to Launch SignWave

The application is completely self-contained (no Python environments, node dependencies, or cloud servers are required to compile or run).

### Option 1: Direct File Open (Easiest)
Simply double-click the [index.html](file:///c:/Users/dpvas/OneDrive/Documents/Desktop/sign_lang/index.html) file to open it in Google Chrome or Microsoft Edge.

*Note: Some browser security sandboxes block camera activation when loading files via the raw `file://` protocol. If the camera doesn't start, use Option 2.*

### Option 2: Run a Simple Local Web Server (Recommended)
Open your terminal in this directory and start a local host:

* **Python 3**:
  ```bash
  python -m http.server 8000
  ```
  Then visit: **http://localhost:8000**

* **Node.js / npm**:
  ```bash
  npx live-server
  # OR
  npx serve .
  ```

---

## 🎒 SignWave Academy: Practice Game HUD
When you start Practice Mode:
1. The AI prompts you with a target gesture (e.g., Peace / 'V' ✌️).
2. You must form the shape in front of your camera.
3. When the AI detects a match, a progress bar fills up. You must hold the shape stable for 2 seconds.
4. Completing a sign plays a success chime (synthesized using the Web Audio API) and selects a new target.
5. Score as many as you can before the 15-second round timer runs out! Complete all 5 rounds to hear the victory fanfare.

---

## 🏷️ Custom Gesture Studio: How to Train Signs
1. Select **"Start Camera"**.
2. Type the label name of your custom gesture in the input box (e.g. `Water`).
3. Select an emoji representing your custom sign.
4. Form your custom hand shape in front of the lens (ensure the neon joint tracker is active).
5. Click **"Save Current Shape"**.
6. The gesture registers immediately, pops into the Dictionary list, and overrides any default sign using that same finger configuration.

---

## 🗣️ Voice Activated Dashboard Commands
While the microphone icon is pulsing red, speak the following phrases to navigate:
* **"clear sentence"** or **"reset sentence"**: Clears all word bubbles from your sentence builder.
* **"speak sentence"** or **"read aloud"**: Translates and speaks your timeline out loud.
* **"backspace"** or **"delete last word"**: Removes the most recently added sign bubble.
* **"add word"** or **"add sign"**: Appends the active prediction to your sentence builder.
* **"increase font"** or **"zoom in"**: Enlarges text display size.
* **"decrease font"** or **"zoom out"**: Shrinks text display size.

# 🌊 SignWave AI - Real-Time Sign Language Suite & Practice Hub

[![Technology: Vanilla JS](https://img.shields.io/badge/Technology-Vanilla%20JS-06b6d4.svg)](#)
[![Library: MediaPipe](https://img.shields.io/badge/Library-MediaPipe--Hands-0f766e.svg)](#)
[![Auditory: Web Audio API](https://img.shields.io/badge/Auditory-Web%20Audio--API-10b981.svg)](#)
[![Access: Offline Ready](https://img.shields.io/badge/Access-Offline%20Ready-success.svg)](#)

SignWave AI is a premium, client-side sign language translation and practice suite designed to bridge communication gaps for the Deaf and Hard of Hearing community. Powered by real-time computer vision, standard Web Speech Synthesis/Recognition APIs, and the Web Audio API, the application runs entirely client-side, ensuring complete privacy, zero server lag, and full offline accessibility.

Featuring a sleek, modern **Oceanic Wave branding design** with glowing cyan/teal elements and glassmorphic layouts, SignWave provides an immersive visual and auditory feedback loop for learning, translating, and customized communication.

---

## 🗺️ System Interface & Architecture

```
                                  +----------------------+
                                  |     User Webcam      |
                                  +----------+-----------+
                                             |
                                             v
                                  +----------+-----------+
                                  |   MediaPipe Hands    |
                                  | (Landmark Detection) |
                                  +----------+-----------+
                                             |
                                             v
                    +------------------------+------------------------+
                    |                                                 |
                    v                                                 v
        +-----------+-----------+                         +-----------+-----------+
        |   Gesture Classifier  |                         |  Synthesized Audio /  |
        |  (Default vs Custom)  |                         |  Speech Transcription |
        +-----------+-----------+                         +-----------+-----------+
                    |                                                 |
                    v                                                 v
        +-----------+-----------+                         +-----------+-----------+
        |  Sentence Timeline    +<------------------------+  Voice Command Engine |
        |  & Chat Log Builder   |                         |  (Navigation & Ops)  |
        +-----------+-----------+                         +-----------------------+
                    |
                    v
        +-----------+-----------+
        |   Log / Data Exporter |
        +-----------------------+
```

---

## 🌟 Key Features

*   **Real-Time Sign Recognition**: Employs MediaPipe's high-fidelity hand-tracking model to analyze 21 individual joint landmarks (X, Y, Z coordinates) at 30+ FPS directly in the browser.
*   **Oceanic Wave Branding**: Fluid mesh gradient backgrounds with floating teal (`#0f766e`) and sky blue (`#0ea5e9`) orbs, modern typography, and glassmorphic panels that adapt seamlessly to different viewport sizes.
*   **Custom Gesture Studio**: Capture unique hand shapes in real-time, label them, assign emojis, and save them directly to `localStorage` to override default signs.
*   **SignWave Practice Academy**: An interactive training game to learn and refine gestures. Users match target signs, hold them for 2 seconds to earn points, and play against a 15-second round timer with Web Audio sound chimes.
*   **Dynamic Trace Color Themes**: Choose from premium trace overlays to highlight hand landmarks:
    *   🌊 **Oceanic Wave (Neon)**: Cyan bones, emerald joints, light blue tips (Default).
    *   ⚡ **Volt Gold**: Bronze bones, orange joints, gold tips.
    *   🌿 **Emerald Sea**: Teal bones, emerald joints, cyan tips.
    *   ❄️ **Ice Indigo**: Cobalt bones, indigo joints, light blue tips.
*   **Hands-Free Voice Navigation**: Execute system commands through voice recognition to modify sentences, zoom text, or request speech playback.
*   **Flexible Layout**: Responsive dashboard container that fits standard laptop resolutions without clipping components, maintaining high visual hierarchy and scrollable panels.
*   **Local Session Exporter**: Download interactive translations and chat histories as a clean text file (`signwave_chat_log.txt`) instantly.
*   **Master Premium Additions**: SVG Hand Blueprint Visualizers, Bi-directional Speech-to-Sign/Search Tutorials, Persisted Translation History logs with Flask server sync, Time-Attack Quiz Challenges, and interactive progress scoring line charts.

---

## 📖 Reference Sign Dictionary

SignWave includes a set of standard gestures built on finger joint angle analyses. Custom signs added via the Gesture Studio will dynamically override these defaults:

| Gesture | Label | Description / Finger Configuration |
| :---: | :--- | :--- |
| 👋 | **Hello** | Open palm, all fingers extended vertically. |
| ✊ | **Yes** | Fully closed fist, all fingers folded. |
| ✋ | **Stop** | Open flat hand facing forward. |
| ✌️ | **Peace / 'V'** | Index and middle fingers extended, others folded. |
| ☝️ | **Pointing / '1'**| Only the index finger extended vertically. |
| 👌 | **OK** | Thumb and index finger tips touching in a loop. |
| 👍 | **Thumbs Up** | Thumb extended vertically upward, others folded. |
| 👎 | **Thumbs Down**| Thumb extended vertically downward, others folded. |
| 🤘 | **Rock On** | Index and pinky extended, middle and ring folded. |
| 🤙 | **Call Me** | Thumb and pinky extended, other fingers folded. |

---

## 🗣️ Voice Command Reference

When the microphone is active (visualized by the glowing audio amplitude waveform), speak any of the following phrases to control the application hands-free:

| Spoken Phrase | Action Triggered |
| :--- | :--- |
| `"add word"` / `"add sign"` | Appends the current hand prediction bubble to the sentence timeline. |
| `"backspace"` / `"delete last word"` | Deletes the last word bubble added to the timeline. |
| `"clear sentence"` / `"reset sentence"` | Empties the sentence text area completely. |
| `"speak sentence"` / `"read aloud"` | Translates the timeline text and speaks it using the active OS voice profile. |
| `"increase font"` / `"zoom in"` | Scales up dashboard text size. |
| `"decrease font"` / `"zoom out"` | Scales down dashboard text size. |

---

## 🛠️ Technology Stack & Libraries

*   **HTML5 & Vanilla CSS3**: Structured layouts using flexbox, grids, variables, and GPU-accelerated keyframe animation.
*   **MediaPipe Hands API**: Google's machine learning pipeline for sub-millisecond hand landmark tracking.
*   **Web Audio API**: Dynamically synthesizes real-time sound effects (practice chimes, success fanfares, and visualizer streams) without external audio files.
*   **Web Speech API**:
    *   *SpeechRecognition*: Transcribes voice commands and conversational inputs locally.
    *   *SpeechSynthesis*: Translates sign sentences into audible spoken words using premium OS voice profiles.
*   **Web Storage API (`localStorage`)**: Saves custom-built sign templates persistently across browser reloads.

---

## 🚀 Getting Started & Local Setup

SignWave AI is structured as a client-side web application. It runs directly in the browser and does not require complex build steps or compiler setups.

### Option 1: Direct File Open (Standard Sandbox)
Double-click [index.html](file:///c:/Users/dpvas/OneDrive/Documents/Desktop/sign_lang/index.html) to open the application in a modern browser (Google Chrome or Microsoft Edge recommended). 

> [!NOTE]
> Some browser security models block camera permissions when opening files using the `file://` protocol. If the webcam fails to load, use the local server option below.

### Option 2: Run a Local Web Server (Recommended)
Navigate to the project root directory and start a web server:

*   **Using Python 3**:
    ```bash
    python -m http.server 8000
    ```
    Then open: **[http://localhost:8000](http://localhost:8000)**

*   **Using Node.js (`npx`)**:
    ```bash
    npx serve .
    # OR
    npx live-server
    ```


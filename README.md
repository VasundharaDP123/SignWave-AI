# SignWave - AI Sign Language Suite & Practice Hub

SignWave is a premium, client-side accessibility web suite. Using real-time computer vision (MediaPipe Hands), standard Speech Synthesis/Recognition APIs, and the Web Audio API, the application functions fully offline or online directly inside the browser.

---

## 🌟 Key Features

1. **Real-time Sign Recognition**: Tracks 21 hand joints (X, Y, Z) at 30+ FPS and predicts gesture shapes directly in your browser.
2. **Neon Skeleton Render**: Overlays a glowing skeleton with joints and tip markers onto the camera feed.
3. **Animated Gradient Mesh Background**: Translucent glassmorphism panels flow on top of organic, floating gradient background orbs (violet, magenta, emerald) for a premium dashboard design.
4. **Dynamic Custom Gesture Studio**: Capture unique hand shapes in real-time, label them (e.g. *Water*, *Help*), associate an emoji, and store them locally inside the browser's `localStorage` to override default signs.
5. **Live Audio Waveform Visualizer**: Activating the voice assist microphone connects to the Web Audio API and renders a responsive, glowing amplitude frequency wave next to the microphone icon.
6. **Custom OS Voice Profiles**: Automatically loads and filters all native, premium voices installed on your operating system (Male, Female, Natural, and regional voices) so that speech translations sound native.
7. **Trace Color Themes**: Customize your hand skeleton tracing styles dynamically using the settings selector:
   * **Cyberpunk (Neon)**: Violet bones, magenta joints, green tips (Default).
   * **Volt Gold**: Bronze bones, orange joints, gold tips.
   * **Emerald Sea**: Teal bones, emerald joints, cyan tips.
   * **Ice Indigo**: Cobalt bones, indigo joints, light blue tips.
8. **Real-time Search Filter**: A search bar inside the Reference Dictionary sidebar so users can filter signs instantly by name or description.
9. **Emergency Quick Phrases**: One-click speech cards for vital phrases (*Need Help*, *Thank You*, *Water*, *Emergency*) to speed up critical communication.
10. **Conversation Exporter**: Download your full interactive session logs as a clean text file (`signwave_chat_log.txt`) by clicking **"Export Log"**.
11. **Text-to-Speech & Speech-to-Text**: Converts timelines into spoken sentences, and transcribes spoken voice answers into visual text logs.
12. **Hands-free Voice Commands**: Supports navigational keywords (*"clear sentence"*, *"delete word"*, *"speak sentence"*, *"add word"*, *"zoom in"*, *"zoom out"*).

---

## 🚀 How to Launch SignWave

The application is fully client-side and requires **no complex installation steps**.

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
2. Form the shape in front of your camera.
3. When the AI detects a match, a progress bar fills up. Hold the shape stable for 2 seconds.
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

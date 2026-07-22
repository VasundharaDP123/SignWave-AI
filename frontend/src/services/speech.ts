export class SpeechService {
  public synth: SpeechSynthesis | null = null;
  private recognition: any = null; // Web Speech API type
  public isListening = false;
  public selectedVoice: SpeechSynthesisVoice | null = null;
  public customVoice: SpeechSynthesisVoice | null = null;

  // Web Audio components
  private audioContext: AudioContext | null = null;
  private audioStream: MediaStream | null = null;
  private audioSource: MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis;
      this.initSynthesis();
      this.initRecognition();
    }
  }

  // --- Text-to-Speech (TTS) & Custom Voices ---
  private initSynthesis() {
    if (!this.synth) {
      console.warn("Speech Synthesis is not supported in this browser.");
      return;
    }

    const loadVoices = () => {
      if (!this.synth) return;
      const voices = this.synth.getVoices();
      this.selectedVoice =
        voices.find((v) => v.name.includes("Google US English") || v.name.includes("Natural")) ||
        voices.find((v) => v.lang.startsWith("en-")) ||
        voices[0] ||
        null;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  public getAllSystemVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  public setCustomVoice(voiceName: string) {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    this.customVoice = voices.find((v) => v.name === voiceName) || null;
  }

  public speak(
    text: string,
    langCode = 'en-US',
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ) {
    if (!this.synth) return;

    this.synth.cancel();
    if (!text || text.trim() === "") return;

    const utterance = new SpeechSynthesisUtterance(text);

    // Prioritize manually selected custom voice
    if (this.customVoice) {
      utterance.voice = this.customVoice;
      utterance.lang = this.customVoice.lang;
    } else {
      // Fallback: match voice with the target language code
      const voices = this.synth.getVoices();
      let voice = voices.find((v) => v.lang.toLowerCase().startsWith(langCode.toLowerCase()));

      if (!voice) {
        const baseLang = langCode.split("-")[0];
        voice = voices.find((v) => v.lang.toLowerCase().startsWith(baseLang.toLowerCase()));
      }

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang;
      }
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    if (onError) utterance.onerror = onError;

    this.synth.speak(utterance);
  }

  public stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  // --- Web Audio Analyser piping for Canvas Visualizer ---
  public async startVisualizerStream(onAudioData: (data: Uint8Array) => void) {
    if (this.audioContext) this.stopVisualizerStream();

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // Audio context configuration
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.audioSource = this.audioContext.createMediaStreamSource(this.audioStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128; // Small size for responsive waveforms

      this.audioSource.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const processData = () => {
        if (!this.isListening || !this.analyser) {
          this.stopVisualizerStream();
          return;
        }
        this.analyser.getByteFrequencyData(dataArray);
        onAudioData(dataArray);
        requestAnimationFrame(processData);
      };

      processData();
    } catch (err) {
      console.warn("Could not start micro analysis context for wave visualizer:", err);
    }
  }

  public stopVisualizerStream() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.audioSource = null;
  }

  // --- Live Translation Module ---
  public async translate(text: string, targetLang: string): Promise<string> {
    if (!text || text.trim() === "" || targetLang === "en") {
      return text;
    }

    // Try backend translation first
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_lang: targetLang })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.translatedText) {
          return data.translatedText;
        }
      }
    } catch (e) {
      console.warn("Backend translation failed, falling back to direct API:", e);
    }

    const langpair = `en|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Translation request failed.");

      const data = await response.json();
      if (data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
      return this.localTranslateFallback(text, targetLang);
    } catch (e) {
      console.warn("Translation API issue, falling back:", e);
      return this.localTranslateFallback(text, targetLang);
    }
  }

  private localTranslateFallback(text: string, targetLang: string): string {
    const dictionary: Record<string, Record<string, string>> = {
      es: {
        "hello": "hola", "stop": "alto", "fist": "puño", "i love you": "te amo",
        "peace": "paz", "l sign": "letra l", "pointing": "señalar", "ok": "correcto",
        "thumbs up": "bien", "thumbs down": "mal", "rock on": "rockear", "call me": "llámame",
        "yes": "sí", "no": "no", "good": "bueno", "bad": "malo", "water": "agua", "food": "comida",
        "need help": "necesito ayuda", "thank you": "gracias", "i need water": "necesito agua", "emergency": "emergencia"
      },
      fr: {
        "hello": "bonjour", "stop": "arrêter", "fist": "poing", "i love you": "je t'aime",
        "peace": "paix", "l sign": "signe l", "pointing": "pointer", "ok": "d'accord",
        "thumbs up": "super", "thumbs down": "mauvais", "rock on": "en avant la musique", "call me": "appelle-moi",
        "yes": "oui", "no": "non", "good": "bon", "bad": "mauvais", "water": "eau", "food": "nourriture",
        "need help": "besoin d'aide", "thank you": "merci", "i need water": "j'ai besoin d'eau", "emergency": "urgence"
      },
      de: {
        "hello": "hallo", "stop": "halt", "fist": "faust", "i love you": "ich liebe dich",
        "peace": "frieden", "l sign": "l-zeichen", "pointing": "zeigen", "ok": "in ordnung",
        "thumbs up": "gut", "thumbs down": "schlecht", "rock on": "rocken", "call me": "ruf mich an",
        "yes": "ja", "no": "nein", "good": "gut", "bad": "schlecht", "water": "wasser", "food": "essen",
        "need help": "brauche hilfe", "thank you": "danke", "i need water": "ich brauche wasser", "emergency": "notfall"
      },
      ja: {
        "hello": "こんにちは", "stop": "止まれ", "fist": "拳", "i love you": "愛しています",
        "peace": "ピース", "l sign": "lのサイン", "pointing": "指さし", "ok": "了解",
        "thumbs up": "いいね", "thumbs down": "だめ", "rock on": "ロックオン", "call me": "電話して",
        "yes": "はい", "no": "いいえ", "good": "良い", "bad": "悪い", "water": "水", "food": "食べ物",
        "need help": "助けが必要です", "thank you": "ありがとう", "i need water": "水が必要です", "emergency": "緊急事態"
      }
    };

    const words = text.toLowerCase().split(" ");
    const translatedWords = words.map((word) => {
      const baseWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      if (dictionary[targetLang] && dictionary[targetLang][baseWord]) {
        return dictionary[targetLang][baseWord];
      }
      return word;
    });
    return translatedWords.join(" ");
  }

  // --- Speech-to-Text (STT) ---
  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition is not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
  }

  public startListening(
    onResult: (res: { final: string; interim: string }) => void,
    onCommand: (cmd: { action: string }) => void,
    onStateChange: (listening: boolean) => void
  ) {
    if (!this.recognition) return;
    if (this.isListening) return;

    this.isListening = true;
    onStateChange(true);

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece;
          const command = this.parseCommand(transcriptPiece.trim().toLowerCase());
          if (command && onCommand) {
            onCommand(command);
            return;
          }
        } else {
          interimTranscript += transcriptPiece;
        }
      }

      if (onResult && (finalTranscript || interimTranscript)) {
        onResult({
          final: finalTranscript.trim(),
          interim: interimTranscript.trim()
        });
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      if (event.error === 'not-allowed') {
        this.stopListening(onStateChange);
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          console.log("Error restarting voice engine:", e);
        }
      }
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error("Recognition start error:", e);
    }
  }

  public stopListening(onStateChange: (listening: boolean) => void) {
    this.isListening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
    this.stopVisualizerStream();
    onStateChange(false);
  }

  private parseCommand(phrase: string) {
    if (phrase.includes("clear sentence") || phrase === "clear all" || phrase === "reset sentence") {
      return { action: "clear" };
    }
    if (phrase.includes("speak sentence") || phrase === "speak all" || phrase === "read aloud" || phrase === "read sentence") {
      return { action: "speak_sentence" };
    }
    if (phrase === "backspace" || phrase === "delete last word" || phrase === "delete word" || phrase === "remove last") {
      return { action: "delete_word" };
    }
    if (phrase === "add word" || phrase === "select sign" || phrase === "add sign") {
      return { action: "add_sign" };
    }
    if (phrase === "increase font" || phrase === "larger text" || phrase === "zoom in") {
      return { action: "increase_font" };
    }
    if (phrase === "decrease font" || phrase === "smaller text" || phrase === "zoom out") {
      return { action: "decrease_font" };
    }
    return null;
  }

  // --- V5: Signed Grammar Translator Engine ---
  public translateToSpokenGrammar(sentenceText: string): string {
    if (!sentenceText || sentenceText.trim() === "") return sentenceText;

    let processed = sentenceText.trim().toLowerCase();

    // Standardize gesture text representations for grammar mapping
    processed = processed.replace(/\bthumbs up\b/g, "good");
    processed = processed.replace(/\bthumbs down\b/g, "bad");
    processed = processed.replace(/\bl sign\b/g, "l");
    processed = processed.replace(/\bpointing\b/g, "pointing");
    processed = processed.replace(/\bvictory\b/g, "peace");
    processed = processed.replace(/\bnamaste\b/g, "hello");

    // Grammar corrections dictionary
    const mappings = [
      { pattern: /\b(hello stop)\b/gi, replacement: "hello" },
      { pattern: /\b(namaste stop)\b/gi, replacement: "hello" },
      { pattern: /\b(hello thanks water)\b/gi, replacement: "hello, thank you. I need water." },
      { pattern: /\b(hello need help)\b/gi, replacement: "hello, I need help." },
      { pattern: /\b(water emergency)\b/gi, replacement: "I need water immediately! It is an emergency." },
      { pattern: /\b(no feel good)\b/gi, replacement: "I do not feel well." },
      { pattern: /\b(bad feel)\b/gi, replacement: "I feel sick." },
      { pattern: /\b(ok thank you)\b/gi, replacement: "okay, thank you." },
      { pattern: /\b(me need help)\b/gi, replacement: "I need help." },
      { pattern: /\b(you need help)\b/gi, replacement: "Do you need help?" },
      { pattern: /\b(me eat water)\b/gi, replacement: "I want to drink water." },
      { pattern: /\b(me want water)\b/gi, replacement: "I would like some water." },
      { pattern: /\b(good day)\b/gi, replacement: "have a good day." },
      { pattern: /\b(call me emergency)\b/gi, replacement: "please call me, it is an emergency!" }
    ];

    // Apply direct mappings
    let matched = false;
    for (const map of mappings) {
      if (map.pattern.test(processed)) {
        processed = processed.replace(map.pattern, map.replacement);
        matched = true;
      }
    }

    if (!matched) {
      // General heuristics to clean up basic pidgin sign grammar
      processed = processed.replace(/\bme\b/g, "I");
      processed = processed.replace(/\bi need\b/g, "I need");
      processed = processed.charAt(0).toUpperCase() + processed.slice(1);
      if (!processed.endsWith(".") && !processed.endsWith("?") && !processed.endsWith("!")) {
        processed += ".";
      }
      return processed;
    }

    processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    return processed;
  }
}

export const Speech = new SpeechService();
export default Speech;

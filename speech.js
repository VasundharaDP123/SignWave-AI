/**
 * SignWave - Speech & Translation Module
 * 
 * Handles Text-to-Speech (TTS) with regional accents, Speech-to-Text (STT) 
 * voice controls, and multi-language API translation (using MyMemory API).
 */

class SpeechService {
    constructor() {
        this.synth = window.speechSynthesis;
        this.recognition = null;
        this.isListening = false;
        this.selectedVoice = null;
        
        this.initSynthesis();
        this.initRecognition();
    }

    // --- Text-to-Speech (TTS) ---

    initSynthesis() {
        if (!this.synth) {
            console.warn("Speech Synthesis is not supported in this browser.");
            return;
        }

        const loadVoices = () => {
            const voices = this.synth.getVoices();
            this.selectedVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Natural")) 
                || voices.find(v => v.lang.startsWith("en-")) 
                || voices[0];
        };

        loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }
    }

    speak(text, langCode = 'en-US', onStart, onEnd, onError) {
        if (!this.synth) return;
        
        this.synth.cancel();
        if (!text || text.trim() === "") return;

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Match voice with the target language code
        const voices = this.synth.getVoices();
        let voice = voices.find(v => v.lang.toLowerCase().startsWith(langCode.toLowerCase()));
        
        if (!voice) {
            const baseLang = langCode.split("-")[0];
            voice = voices.find(v => v.lang.toLowerCase().startsWith(baseLang.toLowerCase()));
        }
        
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
            utterance.lang = this.selectedVoice.lang;
        }

        utterance.rate = 0.95; // Clear speed
        utterance.pitch = 1.0;

        if (onStart) utterance.onstart = onStart;
        if (onEnd) utterance.onend = onEnd;
        if (onError) utterance.onerror = onError;

        this.synth.speak(utterance);
    }

    stopSpeaking() {
        if (this.synth) {
            this.synth.cancel();
        }
    }

    // --- Live Translation Module ---

    async translate(text, targetLang) {
        if (!text || text.trim() === "" || targetLang === "en") {
            return text;
        }

        // Public MyMemory Translation API pair: English to Target Language
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
            console.warn("MyMemory API translation offline/failed, falling back to local dictionary:", e);
            return this.localTranslateFallback(text, targetLang);
        }
    }

    // Local offline translations for key vocabulary items
    localTranslateFallback(text, targetLang) {
        const dictionary = {
            es: { // Spanish
                "hello": "hola", "stop": "alto", "fist": "puño", "i love you": "te amo",
                "peace": "paz", "l sign": "letra l", "pointing": "señalar", "ok": "correcto",
                "thumbs up": "bien", "thumbs down": "mal", "rock on": "rockear", "call me": "llámame",
                "yes": "sí", "no": "no", "good": "bueno", "bad": "malo", "water": "agua", "food": "comida"
            },
            fr: { // French
                "hello": "bonjour", "stop": "arrêter", "fist": "poing", "i love you": "je t'aime",
                "peace": "paix", "l sign": "signe l", "pointing": "pointer", "ok": "d'accord",
                "thumbs up": "super", "thumbs down": "mauvais", "rock on": "en avant la musique", "call me": "appelle-moi",
                "yes": "oui", "no": "non", "good": "bon", "bad": "mauvais", "water": "eau", "food": "nourriture"
            },
            de: { // German
                "hello": "hallo", "stop": "halt", "fist": "faust", "i love you": "ich liebe dich",
                "peace": "frieden", "l sign": "l-zeichen", "pointing": "zeigen", "ok": "in ordnung",
                "thumbs up": "gut", "thumbs down": "schlecht", "rock on": "rocken", "call me": "ruf mich an",
                "yes": "ja", "no": "nein", "good": "gut", "bad": "schlecht", "water": "wasser", "food": "essen"
            },
            ja: { // Japanese
                "hello": "こんにちは", "stop": "止まれ", "fist": "拳", "i love you": "愛しています",
                "peace": "ピース", "l sign": "lのサイン", "pointing": "指さし", "ok": "了解",
                "thumbs up": "いいね", "thumbs down": "だめ", "rock on": "ロックオン", "call me": "電話して",
                "yes": "はい", "no": "いいえ", "good": "良い", "bad": "悪い", "water": "水", "food": "食べ物"
            }
        };

        const words = text.toLowerCase().split(" ");
        const translatedWords = words.map(word => {
            const baseWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,""); // Strip punctuation
            if (dictionary[targetLang] && dictionary[targetLang][baseWord]) {
                return dictionary[targetLang][baseWord];
            }
            return word; // Keep original if not matched
        });
        return translatedWords.join(" ");
    }

    // --- Speech-to-Text (STT) & Voice Commands ---

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition is not supported in this browser.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
    }

    startListening(onResult, onCommand, onStateChange) {
        if (!this.recognition) return;
        if (this.isListening) return;

        this.isListening = true;
        if (onStateChange) onStateChange(true);

        this.recognition.onresult = (event) => {
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

        this.recognition.onerror = (event) => {
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

    stopListening(onStateChange) {
        this.isListening = false;
        if (this.recognition) {
            this.recognition.stop();
        }
        if (onStateChange) onStateChange(false);
    }

    parseCommand(phrase) {
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
}

window.Speech = new SpeechService();

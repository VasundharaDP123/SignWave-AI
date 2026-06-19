/**
 * SignWave - Gesture Recognition Engine
 * 
 * Maps 21 hand landmarks from MediaPipe to finger states, checks
 * against custom user-defined gestures first, then falls back to default signs.
 * Supports ASL (American Sign Language) and ISL (Indian Sign Language) presets.
 */

// Preset Vocabulary Lists
const ASL_DICTIONARY = [
    { name: "Hello / Stop", emoji: "👋", description: "All fingers extended straight" },
    { name: "Fist / 'A'", emoji: "✊", description: "All fingers folded in a fist" },
    { name: "I Love You", emoji: "🤟", description: "Thumb, Index, Pinky extended" },
    { name: "Peace / 'V'", emoji: "✌️", description: "Index & Middle extended" },
    { name: "L Sign", emoji: "👉", description: "Thumb and Index form an L" },
    { name: "Pointing / '1'", emoji: "☝️", description: "Only Index finger extended" },
    { name: "OK", emoji: "👌", description: "Thumb & Index tips touching" },
    { name: "Thumbs Up", emoji: "👍", description: "Thumb up, others folded" },
    { name: "Thumbs Down", emoji: "👎", description: "Thumb down, others folded" },
    { name: "Rock On", emoji: "🤘", description: "Index & Pinky extended" },
    { name: "Call Me", emoji: "🤙", description: "Thumb & Pinky extended" }
];

const ISL_DICTIONARY = [
    { name: "Namaste / Stop", emoji: "👋", description: "Flat open palm greeting or halt" },
    { name: "Fist / Strength", emoji: "✊", description: "All fingers folded in a fist" },
    { name: "I Love You", emoji: "🤟", description: "Thumb, Index, Pinky extended" },
    { name: "Victory / 'V'", emoji: "✌️", description: "Index & Middle extended" },
    { name: "Direction", emoji: "👉", description: "Thumb and Index form an L" },
    { name: "Water (ISL)", emoji: "💧", description: "Index pointing to mouth/chin" },
    { name: "OK (ISL)", emoji: "👌", description: "Thumb & Index tips touching" },
    { name: "Good / Yes", emoji: "👍", description: "Thumb up, others folded" },
    { name: "Bad / No", emoji: "👎", description: "Thumb down, others folded" },
    { name: "Horns / Rock", emoji: "🤘", description: "Index & Pinky extended" },
    { name: "Call Me", emoji: "🤙", description: "Thumb & Pinky extended" }
];

// Helper to calculate Euclidean distance in 3D
function getDistance(pt1, pt2) {
    if (!pt1 || !pt2) return 0;
    return Math.sqrt(
        Math.pow(pt1.x - pt2.x, 2) +
        Math.pow(pt1.y - pt2.y, 2) +
        Math.pow(pt1.z - pt2.z, 2)
    );
}

// Predict gesture based on landmarks, custom gestures database, and active language preset
function predictGesture(landmarks, customGestures = [], presetName = "asl") {
    if (!landmarks || landmarks.length < 21) {
        return { name: "No Hand Detected", emoji: "👋", description: "Bring your hand into the camera view." };
    }

    const wrist = landmarks[0];
    
    // Define joint coordinates
    const thumbTip = landmarks[4];
    const thumbMCP = landmarks[2];
    
    const indexTip = landmarks[8];
    const indexPIP = landmarks[6];
    const indexMCP = landmarks[5];
    
    const middleTip = landmarks[12];
    const middlePIP = landmarks[10];
    const middleMCP = landmarks[9];
    
    const ringTip = landmarks[16];
    const ringPIP = landmarks[14];
    
    const pinkyTip = landmarks[20];
    const pinkyPIP = landmarks[18];

    // Calculate palm scale size (reference distance to normalize all other distances)
    // Calculate palm scale size based on knuckle width (highly stable and invariant to wrist bending)
    const pinkyMCP = landmarks[17];
    const knuckleWidth = getDistance(indexMCP, pinkyMCP);
    const palmSize = knuckleWidth * 1.15;
    if (palmSize === 0) return { name: "Analyzing...", emoji: "🤔", description: "Hold hand steady." };

    // Determine finger extensions relative to knuckle (MCP) distance (highly stable and wrist-bending invariant)
    const isIndexExtended = getDistance(indexTip, indexMCP) > (palmSize * 0.45);
    const isMiddleExtended = getDistance(middleTip, middleMCP) > (palmSize * 0.45);
    const isRingExtended = getDistance(ringTip, landmarks[13]) > (palmSize * 0.45);
    const isPinkyExtended = getDistance(pinkyTip, landmarks[17]) > (palmSize * 0.40);

    // Thumb is extended if it is pushed away from the side of the palm (index MCP)
    const thumbDistanceToIndexMCP = getDistance(thumbTip, indexMCP);
    const isThumbExtended = thumbDistanceToIndexMCP > (palmSize * 0.55);

    // Active finger configuration
    const states = {
        thumb: isThumbExtended,
        index: isIndexExtended,
        middle: isMiddleExtended,
        ring: isRingExtended,
        pinky: isPinkyExtended
    };

    // --- 1. EVALUATE CUSTOM USER GESTURES FIRST ---
    if (customGestures && customGestures.length > 0) {
        for (const custom of customGestures) {
            if (custom.states &&
                custom.states.thumb === states.thumb &&
                custom.states.index === states.index &&
                custom.states.middle === states.middle &&
                custom.states.ring === states.ring &&
                custom.states.pinky === states.pinky) {
                
                return {
                    name: custom.name,
                    emoji: custom.emoji || "🏷️",
                    description: custom.description || "Custom recorded gesture.",
                    states,
                    isCustom: true
                };
            }
        }
    }

    // --- 2. DEFAULT SYSTEM GESTURES (AFFECTED BY PRESET) ---
    const thumbIndexTipDist = getDistance(thumbTip, indexTip);

    // OK Sign
    if (thumbIndexTipDist < (palmSize * 0.25) && isMiddleExtended && isRingExtended && isPinkyExtended) {
        return {
            name: presetName === "isl" ? "OK (ISL)" : "OK",
            emoji: "👌",
            description: presetName === "isl" ? "Thumb & Index tips touching" : "Agreement, approval, or 'Perfect'.",
            states
        };
    }

    // Hello / Stop / Namaste
    if (isThumbExtended && isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
        return {
            name: presetName === "isl" ? "Namaste / Stop" : "Hello / Stop",
            emoji: "👋",
            description: presetName === "isl" ? "Flat open palm greeting or halt" : "All fingers extended straight",
            states
        };
    }

    // Fist / Letter 'A'
    if (!isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return {
            name: presetName === "isl" ? "Fist / Strength" : "Fist / 'A'",
            emoji: "✊",
            description: "All fingers folded in a fist",
            states
        };
    }

    // I Love You (ILY)
    if (isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
        return {
            name: "I Love You",
            emoji: "🤟",
            description: "Thumb, Index, Pinky extended",
            states
        };
    }

    // Peace Sign / Victory
    if (!isThumbExtended && isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return {
            name: presetName === "isl" ? "Victory / 'V'" : "Peace / 'V'",
            emoji: "✌️",
            description: "Index & Middle extended",
            states
        };
    }

    // L Sign / Direction
    if (isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return {
            name: presetName === "isl" ? "Direction" : "L Sign",
            emoji: "👉",
            description: "Thumb and Index form an L",
            states
        };
    }

    // Thumbs Up
    if (isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        const isUpright = thumbTip.y < wrist.y;
        if (isUpright) {
            return {
                name: presetName === "isl" ? "Good / Yes" : "Thumbs Up",
                emoji: "👍",
                description: "Thumb up, others folded",
                states
            };
        } else {
            return {
                name: presetName === "isl" ? "Bad / No" : "Thumbs Down",
                emoji: "👎",
                description: "Thumb down, others folded",
                states
            };
        }
    }

    // Pointing / Water (ISL)
    if (!isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return {
            name: presetName === "isl" ? "Water (ISL)" : "Pointing / '1'",
            emoji: presetName === "isl" ? "💧" : "☝️",
            description: presetName === "isl" ? "Index pointing to mouth/chin" : "Only Index finger extended",
            states
        };
    }

    // W Sign / '3'
    if (!isThumbExtended && isIndexExtended && isMiddleExtended && isRingExtended && !isPinkyExtended) {
        return {
            name: presetName === "isl" ? "OK (ISL)" : "Letter 'W' / '3'",
            emoji: "👌",
            description: "Index, Middle, Ring extended",
            states
        };
    }

    // Rock On / Horns
    if (!isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
        return {
            name: presetName === "isl" ? "Horns / Rock" : "Rock On",
            emoji: "🤘",
            description: "Index & Pinky extended",
            states
        };
    }

    // Call Me
    if (isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
        return {
            name: "Call Me",
            emoji: "🤙",
            description: "Thumb & Pinky extended",
            states
        };
    }

    // Default scanning response
    let countExtended = 0;
    if (isThumbExtended) countExtended++;
    if (isIndexExtended) countExtended++;
    if (isMiddleExtended) countExtended++;
    if (isRingExtended) countExtended++;
    if (isPinkyExtended) countExtended++;

    return {
        name: `Scanning (${countExtended} fingers)`,
        emoji: "✋",
        description: "Form a standard sign or record a custom gesture.",
        states
    };
}

// Expose definitions for browser global scope
if (typeof window !== 'undefined') {
    window.predictGesture = predictGesture;
    window.getDistance = getDistance;
    window.ASL_DICTIONARY = ASL_DICTIONARY;
    window.ISL_DICTIONARY = ISL_DICTIONARY;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { predictGesture, getDistance, ASL_DICTIONARY, ISL_DICTIONARY };
}

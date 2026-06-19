/**
 * SignWave - Gesture Recognition Engine
 * 
 * Maps 21 hand landmarks from MediaPipe to finger states, checks
 * against custom user-defined gestures first, then falls back to default signs.
 */

// Helper to calculate Euclidean distance in 3D
function getDistance(pt1, pt2) {
    if (!pt1 || !pt2) return 0;
    return Math.sqrt(
        Math.pow(pt1.x - pt2.x, 2) +
        Math.pow(pt1.y - pt2.y, 2) +
        Math.pow(pt1.z - pt2.z, 2)
    );
}

// Predict gesture based on landmarks and optional custom gestures database
function predictGesture(landmarks, customGestures = []) {
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
    const palmSize = getDistance(wrist, middleMCP);
    if (palmSize === 0) return { name: "Analyzing...", emoji: "🤔", description: "Hold hand steady." };

    // Determine finger extensions relative to wrist/MCP distance
    const isIndexExtended = getDistance(indexTip, wrist) > getDistance(indexPIP, wrist);
    const isMiddleExtended = getDistance(middleTip, wrist) > getDistance(middlePIP, wrist);
    const isRingExtended = getDistance(ringTip, wrist) > getDistance(ringPIP, wrist);
    const isPinkyExtended = getDistance(pinkyTip, wrist) > getDistance(pinkyPIP, wrist);

    // Thumb is extended if it is pushed away from the side of the palm (index MCP)
    const thumbDistanceToIndexMCP = getDistance(thumbTip, indexMCP);
    const isThumbExtended = thumbDistanceToIndexMCP > (palmSize * 0.65);

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

    // --- 2. DEFAULT SYSTEM GESTURES ---
    const thumbIndexTipDist = getDistance(thumbTip, indexTip);

    // OK Sign: Thumb and Index tips touch, Middle, Ring, Pinky extended
    if (thumbIndexTipDist < (palmSize * 0.25) && isMiddleExtended && isRingExtended && isPinkyExtended) {
        return {
            name: "OK",
            emoji: "👌",
            description: "Agreement, approval, or 'Perfect'.",
            states
        };
    }

    // Hello / Open Palm: All fingers extended
    if (isThumbExtended && isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
        return {
            name: "Hello / Stop",
            emoji: "👋",
            description: "Friendly greeting or asking to halt.",
            states
        };
    }

    // Fist / Letter 'A': All fingers folded
    if (!isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return {
            name: "Fist / 'A'",
            emoji: "✊",
            description: "Letter A or representation of solidarity/strength.",
            states
        };
    }

    // I Love You (ILY): Thumb, Index, Pinky extended; Middle, Ring folded
    if (isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
        return {
            name: "I Love You",
            emoji: "🤟",
            description: "Universal sign for affection.",
            states
        };
    }

    // Peace Sign / 'V' / '2': Index and Middle extended; Ring, Pinky, Thumb folded
    if (!isThumbExtended && isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return {
            name: "Peace / 'V'",
            emoji: "✌️",
            description: "Victory, Peace, or number 2.",
            states
        };
    }

    // L Sign: Thumb and Index extended; Middle, Ring, Pinky folded
    if (isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return {
            name: "L Sign",
            emoji: "👉",
            description: "Letter L, direction indicator, or 'Left'.",
            states
        };
    }

    // Thumbs Up / Thumbs Down: Thumb extended; other fingers folded
    if (isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        const isUpright = thumbTip.y < wrist.y;
        if (isUpright) {
            return {
                name: "Thumbs Up",
                emoji: "👍",
                description: "Positive response, 'Yes', or 'Good'.",
                states
            };
        } else {
            return {
                name: "Thumbs Down",
                emoji: "👎",
                description: "Negative response, 'No', or 'Bad'.",
                states
            };
        }
    }

    // Pointing / 1 / 'Up': Only Index extended; others folded
    if (!isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        return {
            name: "Pointing / '1'",
            emoji: "☝️",
            description: "Number 1, pointing up, or selection.",
            states
        };
    }

    // W Sign / '3': Index, Middle, Ring extended; Thumb, Pinky folded
    if (!isThumbExtended && isIndexExtended && isMiddleExtended && isRingExtended && !isPinkyExtended) {
        return {
            name: "Letter 'W' / '3'",
            emoji: "👌",
            description: "Letter W, or number 3.",
            states
        };
    }

    // Rock On / Horns: Index and Pinky extended; Middle, Ring, Thumb folded
    if (!isThumbExtended && isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
        return {
            name: "Rock On",
            emoji: "🤘",
            description: "Rock sign, horns, or positive energy.",
            states
        };
    }

    // Call Me: Thumb and Pinky extended; Index, Middle, Ring folded
    if (isThumbExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
        return {
            name: "Call Me",
            emoji: "🤙",
            description: "Phone signal or 'Call me'.",
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { predictGesture, getDistance };
}

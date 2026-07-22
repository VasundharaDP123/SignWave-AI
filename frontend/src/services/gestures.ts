export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export interface GestureDefinition {
  name: string;
  emoji: string;
  description: string;
  states?: FingerStates;
  isCustom?: boolean;
  isPresetPreview?: boolean;
}

export const ASL_DICTIONARY: GestureDefinition[] = [
  { name: "Hello / Stop", emoji: "👋", description: "All fingers extended straight (or waved)", states: { thumb: true, index: true, middle: true, ring: true, pinky: true } },
  { name: "Yes", emoji: "✊", description: "Nodding closed fist up and down", states: { thumb: false, index: false, middle: false, ring: false, pinky: false } },
  { name: "Please", emoji: "🙏", description: "Prayer hands pressed together", states: { thumb: true, index: true, middle: true, ring: true, pinky: true } },
  { name: "Fist / 'A'", emoji: "✊", description: "All fingers folded in a fist", states: { thumb: false, index: false, middle: false, ring: false, pinky: false } },
  { name: "I Love You", emoji: "🤟", description: "Thumb, Index, Pinky extended", states: { thumb: true, index: true, middle: false, ring: false, pinky: true } },
  { name: "Peace / 'V'", emoji: "✌️", description: "Index & Middle extended", states: { thumb: false, index: true, middle: true, ring: false, pinky: false } },
  { name: "L Sign", emoji: "👉", description: "Thumb and Index form an L", states: { thumb: true, index: true, middle: false, ring: false, pinky: false } },
  { name: "Pointing / '1'", emoji: "☝️", description: "Only Index finger extended", states: { thumb: false, index: true, middle: false, ring: false, pinky: false } },
  { name: "OK", emoji: "👌", description: "Thumb & Index tips touching", states: { thumb: false, index: false, middle: true, ring: true, pinky: true } },
  { name: "Thumbs Up", emoji: "👍", description: "Thumb up, others folded", states: { thumb: true, index: false, middle: false, ring: false, pinky: false } },
  { name: "Thumbs Down", emoji: "👎", description: "Thumb down, others folded", states: { thumb: true, index: false, middle: false, ring: false, pinky: false } },
  { name: "Rock On", emoji: "🤘", description: "Index & Pinky extended", states: { thumb: false, index: true, middle: false, ring: false, pinky: true } },
  { name: "Call Me", emoji: "🤙", description: "Thumb & Pinky extended", states: { thumb: true, index: false, middle: false, ring: false, pinky: true } },
  { name: "Letter 'W' / '3'", emoji: "👌", description: "Index, Middle, Ring extended", states: { thumb: false, index: true, middle: true, ring: true, pinky: false } },
  { name: "House / Roof", emoji: "🏠", description: "Index tips touching, wrists apart (two hands)", states: { thumb: true, index: true, middle: true, ring: true, pinky: true } },
  { name: "Book / Read", emoji: "📖", description: "Palms placed side-by-side like an open book", states: { thumb: true, index: true, middle: true, ring: true, pinky: true } }
];

export const ISL_DICTIONARY: GestureDefinition[] = [
  { name: "Namaste / Stop", emoji: "👋", description: "Flat open palm greeting or halt", states: { thumb: true, index: true, middle: true, ring: true, pinky: true } },
  { name: "Yes", emoji: "✊", description: "Nodding closed fist up and down", states: { thumb: false, index: false, middle: false, ring: false, pinky: false } },
  { name: "Please", emoji: "🙏", description: "Prayer hands pressed together", states: { thumb: true, index: true, middle: true, ring: true, pinky: true } },
  { name: "Fist / Strength", emoji: "✊", description: "All fingers folded in a fist", states: { thumb: false, index: false, middle: false, ring: false, pinky: false } },
  { name: "I Love You", emoji: "🤟", description: "Thumb, Index, Pinky extended", states: { thumb: true, index: true, middle: false, ring: false, pinky: true } },
  { name: "Victory / 'V'", emoji: "✌️", description: "Index & Middle extended", states: { thumb: false, index: true, middle: true, ring: false, pinky: false } },
  { name: "Direction", emoji: "👉", description: "Thumb and Index form an L", states: { thumb: true, index: true, middle: false, ring: false, pinky: false } },
  { name: "Water (ISL)", emoji: "💧", description: "Index pointing to mouth/chin", states: { thumb: false, index: true, middle: false, ring: false, pinky: false } },
  { name: "OK (ISL)", emoji: "👌", description: "Thumb & Index tips touching", states: { thumb: false, index: false, middle: true, ring: true, pinky: true } },
  { name: "Good / Yes", emoji: "👍", description: "Thumb up, others folded", states: { thumb: true, index: false, middle: false, ring: false, pinky: false } },
  { name: "Bad / No", emoji: "👎", description: "Thumb down, others folded", states: { thumb: true, index: false, middle: false, ring: false, pinky: false } },
  { name: "Horns / Rock", emoji: "🤘", description: "Index & Pinky extended", states: { thumb: false, index: true, middle: false, ring: false, pinky: true } },
  { name: "Call Me", emoji: "🤙", description: "Thumb & Pinky extended", states: { thumb: true, index: false, middle: false, ring: false, pinky: true } },
  { name: "House / Roof", emoji: "🏠", description: "Index tips touching, wrists apart (two hands)", states: { thumb: true, index: true, middle: true, ring: true, pinky: true } },
  { name: "Book / Read", emoji: "📖", description: "Palms placed side-by-side like an open book", states: { thumb: true, index: true, middle: true, ring: true, pinky: true } }
];

export function getDistance(pt1: Landmark | undefined, pt2: Landmark | undefined): number {
  if (!pt1 || !pt2) return 0;
  return Math.sqrt(
    Math.pow(pt1.x - pt2.x, 2) +
    Math.pow(pt1.y - pt2.y, 2) +
    Math.pow(pt1.z - pt2.z, 2)
  );
}

export function predictGesture(
  landmarks: Landmark[],
  customGestures: GestureDefinition[] = [],
  presetName = "asl"
): GestureDefinition {
  if (!landmarks || landmarks.length < 21) {
    return { name: "No Hand Detected", emoji: "👋", description: "Bring your hand into the camera view." };
  }

  const wrist = landmarks[0];
  
  // Define joint coordinates
  const thumbTip = landmarks[4];
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

  // Determine finger extensions relative to wrist/MCP distance (extremely robust, self-normalizing)
  // Check both wrist-relative extension and finger MCP-relative length
  const isIndexExtended = getDistance(indexTip, wrist) > getDistance(indexPIP, wrist) && getDistance(indexTip, indexMCP) > (palmSize * 0.60);
  const isMiddleExtended = getDistance(middleTip, wrist) > getDistance(middlePIP, wrist) && getDistance(middleTip, middleMCP) > (palmSize * 0.60);
  const isRingExtended = getDistance(ringTip, wrist) > getDistance(ringPIP, wrist) && getDistance(ringTip, landmarks[13]) > (palmSize * 0.60);
  const isPinkyExtended = getDistance(pinkyTip, wrist) > getDistance(pinkyPIP, wrist) && getDistance(pinkyTip, landmarks[17]) > (palmSize * 0.45);

  // Thumb is extended if it is pushed away from the side of the palm (index MCP)
  // and is straight (tip further from its MCP joint at landmark 2)
  const thumbDistanceToIndexMCP = getDistance(thumbTip, indexMCP);
  const isThumbExtended = thumbDistanceToIndexMCP > (palmSize * 0.50) && getDistance(thumbTip, landmarks[2]) > (palmSize * 0.35);

  // Active finger configuration
  const states: FingerStates = {
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
  if (thumbIndexTipDist < (palmSize * 0.38) && isMiddleExtended && isRingExtended && isPinkyExtended) {
    return {
      name: presetName === "isl" ? "OK (ISL)" : "OK",
      emoji: "👌",
      description: presetName === "isl" ? "Thumb & Index tips touching" : "Agreement, approval, or 'Perfect'.",
      states
    };
  }

  // Hello / Stop / Namaste (Thumb check relaxed to allow natural open hand/stop shape)
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
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

  // Peace Sign / Victory (Thumb relaxed)
  if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
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

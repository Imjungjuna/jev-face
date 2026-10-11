/*
 * Each pose is a sparse map of ARKit blendshape name -> weight at full
 * strength. facecap.glb ships all 52 ARKit shapes, so names are used
 * verbatim; main.js resolves them against morphTargetDictionary.
 */

export const EMOTION_ORDER = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'fear',
  'disgust',
  'contempt',
];

/* Sampled off a reel frame, so these sit slightly darker than the original CSS
 * after video compression. */
export const EMOTION_COLORS = {
  neutral: '#9096a4',
  happy: '#e8b029',
  sad: '#4573c0',
  angry: '#ca3c30',
  surprised: '#ec7c23',
  fear: '#6e4dbd',
  disgust: '#758231',
  contempt: '#288278',
};

export const INTENSITY_LABELS = ['none', 'slight', 'moderate', 'strong', 'overwhelming'];

export const POSES = {
  neutral: {},

  happy: {
    mouthSmile_L: 0.85,
    mouthSmile_R: 0.85,
    mouthDimple_L: 0.4,
    mouthDimple_R: 0.4,
    cheekSquint_L: 0.6,
    cheekSquint_R: 0.6,
    eyeSquint_L: 0.45,
    eyeSquint_R: 0.45,
    browInnerUp: 0.15,
    jawOpen: 0.22,
  },

  sad: {
    mouthFrown_L: 0.7,
    mouthFrown_R: 0.7,
    mouthShrugLower: 0.4,
    mouthLowerDown_L: 0.15,
    mouthLowerDown_R: 0.15,
    browInnerUp: 0.85,
    browDown_L: 0.15,
    browDown_R: 0.15,
    eyeLookDown_L: 0.35,
    eyeLookDown_R: 0.35,
    eyeBlink_L: 0.25,
    eyeBlink_R: 0.25,
  },

  angry: {
    browDown_L: 0.9,
    browDown_R: 0.9,
    eyeSquint_L: 0.55,
    eyeSquint_R: 0.55,
    noseSneer_L: 0.5,
    noseSneer_R: 0.5,
    mouthPress_L: 0.6,
    mouthPress_R: 0.6,
    mouthFrown_L: 0.3,
    mouthFrown_R: 0.3,
    jawForward: 0.3,
  },

  surprised: {
    browInnerUp: 0.9,
    browOuterUp_L: 0.9,
    browOuterUp_R: 0.9,
    eyeWide_L: 0.85,
    eyeWide_R: 0.85,
    jawOpen: 0.6,
    mouthFunnel: 0.25,
  },

  fear: {
    browInnerUp: 1.0,
    browOuterUp_L: 0.5,
    browOuterUp_R: 0.5,
    eyeWide_L: 0.75,
    eyeWide_R: 0.75,
    jawOpen: 0.35,
    mouthStretch_L: 0.6,
    mouthStretch_R: 0.6,
    mouthFrown_L: 0.25,
    mouthFrown_R: 0.25,
  },

  disgust: {
    noseSneer_L: 0.95,
    noseSneer_R: 0.95,
    mouthUpperUp_L: 0.7,
    mouthUpperUp_R: 0.7,
    mouthShrugUpper: 0.5,
    browDown_L: 0.55,
    browDown_R: 0.55,
    eyeSquint_L: 0.6,
    eyeSquint_R: 0.6,
    cheekSquint_L: 0.4,
    cheekSquint_R: 0.4,
  },

  /* One-sided lip raise is the marker that separates contempt from disgust. */
  contempt: {
    mouthSmile_L: 0.75,
    mouthDimple_L: 0.5,
    mouthUpperUp_L: 0.3,
    eyeSquint_L: 0.35,
    browDown_R: 0.3,
    noseSneer_L: 0.2,
  },
};

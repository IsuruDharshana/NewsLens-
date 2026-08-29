/**
 * NewsLens color palette — designed for a clean, trustworthy news app.
 */

const tintColorLight = '#1a73e8';  // Google blue — trustworthy
const tintColorDark = '#8ab4f8';   // Lighter blue for dark mode

export default {
  light: {
    text: '#1a1a2e',
    background: '#f8f9fa',
    tint: tintColorLight,
    tabIconDefault: '#adb5bd',
    tabIconSelected: tintColorLight,
    card: '#ffffff',
    cardBorder: '#e9ecef',
    breaking: '#dc3545',
    breakingBackground: '#fff5f5',
    confidence: '#198754',
    categoryBg: '#e8f0fe',
    categoryText: '#1a73e8',
    biasNeutral: '#198754',
    biasProGov: '#0d6efd',
    biasCritical: '#fd7e14',
    biasSensational: '#dc3545',
    subtitle: '#6c757d',
  },
  dark: {
    text: '#e9ecef',
    background: '#0d1117',
    tint: tintColorDark,
    tabIconDefault: '#6c757d',
    tabIconSelected: tintColorDark,
    card: '#161b22',
    cardBorder: '#30363d',
    breaking: '#ff6b6b',
    breakingBackground: '#2d1b1b',
    confidence: '#4ade80',
    categoryBg: '#1c2a3f',
    categoryText: '#8ab4f8',
    biasNeutral: '#4ade80',
    biasProGov: '#60a5fa',
    biasCritical: '#fdba74',
    biasSensational: '#f87171',
    subtitle: '#8b949e',
  },
};

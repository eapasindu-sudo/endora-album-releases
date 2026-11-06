// Ready-made wedding titles and quotes. Fonts use system fonts so they also render in exports:
// Sinhala → Iskoola Pota (Windows) / Sinhala Sangam MN (macOS); Tamil → Latha / Tamil Sangam MN.

export const FONTS = {
  serif: "'Cormorant Garamond', 'Times New Roman', Georgia, serif",
  sans: "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  script: "'Great Vibes', 'Brush Script MT', 'Snell Roundhand', cursive",
  sinhala: "'Noto Serif Sinhala', 'Noto Sans Sinhala', 'Iskoola Pota', 'Sinhala Sangam MN', 'Sinhala MN', serif",
  tamil: "'Noto Serif Tamil', 'Latha', 'Tamil Sangam MN', 'Tamil MN', serif"
};

export const TEXT_PACKS = [
  { group: 'Sinhala titles', items: [
    { t: 'අපේ ආදර කතාව', note: 'Our love story', font: 'sinhala' },
    { t: 'සදාකාලික බැඳීම', note: 'Forever bond', font: 'sinhala' },
    { t: 'මංගල දිනය', note: 'Wedding day', font: 'sinhala' },
    { t: 'පෝරුව', note: 'The Poruwa', font: 'sinhala' },
    { t: 'දෙහදක එක් ගමනක්', note: 'Two hearts, one journey', font: 'sinhala' },
    { t: 'ආශිර්වාද', note: 'Blessings', font: 'sinhala' },
    { t: 'නිවෙස් පැමිණීම', note: 'Homecoming', font: 'sinhala' }
  ] },
  { group: 'Tamil titles', items: [
    { t: 'சுப விவாகம்', note: 'Auspicious wedding', font: 'tamil' },
    { t: 'எங்கள் காதல் கதை', note: 'Our love story', font: 'tamil' },
    { t: 'திருமண நாள்', note: 'Wedding day', font: 'tamil' }
  ] },
  { group: 'English titles', items: [
    { t: 'Two hearts, one story', font: 'serif' },
    { t: 'The Poruwa', font: 'serif' },
    { t: 'Getting ready', font: 'serif' },
    { t: 'Family', font: 'serif' },
    { t: 'The reception', font: 'serif' },
    { t: 'Homecoming', font: 'serif' },
    { t: 'Forever begins today', font: 'script' },
    { t: 'Just married', font: 'script' }
  ] },
  { group: 'Quotes', items: [
    { t: 'Whatever our souls are made of, his and mine are the same.', note: 'Emily Brontë', font: 'serif' },
    { t: 'Love is composed of a single soul inhabiting two bodies.', note: 'Aristotle', font: 'serif' },
    { t: 'I have found the one whom my soul loves.', note: 'Song of Solomon 3:4', font: 'serif' }
  ] }
];

export const SECTION_NAMES = ['Getting ready', 'Poruwa ceremony', 'Family', 'Couple shoot', 'Reception', 'Homecoming', 'Pre-shoot', 'Engagement'];
export const SECTION_TITLES_SI = {
  'Getting ready': 'මංගල උදෑසන', 'Poruwa ceremony': 'පෝරුව', 'Family': 'පවුලේ ආදරය',
  'Couple shoot': 'අපේ ආදර කතාව', 'Reception': 'සැමරුම', 'Homecoming': 'නිවෙස් පැමිණීම',
  'Pre-shoot': 'පෙර මංගල', 'Engagement': 'විවාහ ගිවිස ගැනීම'
};

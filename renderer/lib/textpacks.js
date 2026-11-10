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
  { group: 'Magazine titles', items: [
    { t: 'The Wedding of', font: 'script' },
    { t: 'WEDDING BLISS', font: 'serif' },
    { t: 'Our Wedding', font: 'script' },
    { t: 'WEDDING DAY', font: 'serif', bold: true },
    { t: 'Wedding Memories', font: 'script' },
    { t: 'LIFE IN PICTURES', font: 'serif' },
    { t: 'OUR LOVE STORY', font: 'sans', bold: true },
    { t: 'We are engaged!', font: 'script' },
    { t: 'IT IS A LOVE STORY', font: 'sans', bold: true },
    { t: 'NEW COUPLE', font: 'sans', bold: true },
    { t: 'WEDDING COLLECTIONS', font: 'sans', bold: true },
    { t: 'PHOTO JOURNAL', font: 'sans', bold: true },
    { t: 'SPECIAL EDITION', font: 'sans', bold: true },
    { t: 'COUPLE', font: 'serif' },
    { t: 'Mr & Mrs', font: 'script' },
    { t: 'Forever & Always', font: 'script' },
    { t: 'LOVE FOR EVER', font: 'serif', bold: true },
    { t: 'Loving Promise', font: 'script' },
    { t: "It's a wonderful life", font: 'script' },
    { t: 'The beginning of forever', font: 'script' },
    { t: 'HAPPY LIFE MARRIAGE', font: 'sans' },
    { t: 'WEDDING CELEBRATION MOMENTS', font: 'sans' },
    { t: 'THE MOST BEAUTIFUL LIFE', font: 'sans', bold: true },
    { t: 'MARRIAGE CEREMONY', font: 'serif' },
    { t: 'ENGAGEMENT', font: 'serif' },
    { t: 'THANK YOU', font: 'sans', bold: true },
    { t: 'UNBREAKABLE · BEAUTIFUL · JOURNEY', font: 'serif' },
    { t: 'LOVE IN EVERY DETAIL', font: 'sans' }
  ] },
  { group: 'Love lines', items: [
    { t: 'A perfectly told love story, framed in love.', font: 'serif' },
    { t: 'Sealed with love, framed with joy.', font: 'serif', italic: true },
    { t: 'Our love story, captured in moments of joy and bliss.', font: 'serif' },
    { t: 'A new chapter lived in love and joy.', font: 'serif', italic: true },
    { t: 'Not perfect. Just perfect for each other.', font: 'sans' },
    { t: 'Every love story is beautiful, but ours is my favourite.', font: 'serif', italic: true },
    { t: 'Feel the love, it is as big and deep as an ocean.', font: 'serif' },
    { t: 'Together is a wonderful place to be.', font: 'script' },
    { t: 'Two hearts, one love.', font: 'script' },
    { t: 'Where love begins and never ends.', font: 'serif', italic: true },
    { t: 'You are my today and all of my tomorrows.', font: 'serif', italic: true },
    { t: 'Moments we will never forget.', font: 'sans' },
    { t: 'Grow old along with me! The best is yet to be.', note: 'Robert Browning', font: 'serif', italic: true }
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

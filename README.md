# Endora Album

Wedding album design software (Mac + Windows). Client ට album එක private flipbook link එකකින් යවන්න පුළුවන්. ඒ link එක photographer ගේම **free Cloudflare account** එකේ auto හැදෙනවා. Domain එකක් හෝ hosting එකක් ගන්න ඕනේ නැහැ.

```
endora-album/
├── main/                 Electron (files, thumbnails, export, Cloudflare auto setup, updates)
├── renderer/             App screens
├── cloudflare/           Flipbook site එක (Worker) + database schema. App එකම මේක upload කරනවා.
├── tests/                Layout engine tests  →  npm test
└── .github/workflows/    Mac + Windows installers GitHub එකේ build කරලා update යවනවා
```

---

## 1. Photographer කෙනෙක් කරන්න ඕනේ දේ (එක පාරයි)

1. **Endora Album install කරන්න.** Windows නම් `.exe`, Mac නම් `.dmg`.
   - Windows එකේ "Windows protected your PC" කියලා ආවොත් **More info → Run anyway** ඔබන්න.
   - Mac එකේ app එක **right-click → Open** කරන්න.
2. App එකේ **Settings → Connect Cloudflare** ඔබන්න. (පළවෙනි වතාවට **Send to client** එබුවොත් මේ window එකම open වෙනවා.)
3. Steps 3ක් තියෙනවා. Button එකක් ඔබාගෙන යන්න:
   1. **Open Cloudflare**: free account එකක් හදන්න. කලින් account එකක් තියෙනවා නම් මේක skip කරන්න.
   2. **Open R2**: "Purchase R2 plan" ඔබන්න. Cloudflare card එකක් ඉල්ලනවා, ඒත් මාසෙකට 10GB වෙනකන් free නිසා සල්ලි කපන්නේ නැහැ.
   3. **Create token**: ඕනේ permissions දැනටමත් tick කරලා තියෙන page එකක් open වෙනවා. පහළට scroll කරලා **Continue to summary → Create Token** ඔබලා token එක copy කරගන්න. ඒක app එකට paste කරලා **Connect** ඔබන්න.
4. ඉවරයි. Database එක, photo storage එක, සහ flipbook site එක (`https://endora-album.<නම>.workers.dev`) app එක auto හදනවා.

**දෙවෙනි PC එකක:** ඒ steps ම, ඒ Cloudflare account එකෙන්ම කරන්න. කලින් හදපු database එකටම සහ link address එකටම connect වෙනවා. Token එක PC එකේ encrypted විදිහට තියාගන්නවා.

### Client ට යවන හැටි
**Send to client → Upload & create link** ඔබන්න. Link එකක් සහ 4-digit PIN එකක් හැදෙනවා. ඒක WhatsApp, Email හෝ QR code එකෙන් යවන්න පුළුවන්.

Client ට මේ පිළිවෙළට පේනවා: **PIN → video → පිටු පෙරළෙන flipbook එක → photo එකක් උඩ comment / swap request → Approve**. Comments app එකට එනවා.

### Cloudflare cost එක (photographer ගේ account එකේ)
- Workers සහ D1 (database): free
- R2: 10GB free. ඊට පස්සේ 1GB එකකට මාසෙකට $0.015 (රු. 4.50 විතර).
- Client ලා download කරන traffic එකට සල්ලි නැහැ.
- 30 spreads + 300MB film එකක් තියෙන album එකක් ≈ 330MB. ඒ කියන්නේ album 30ක් විතර free.

---

## 2. Installers හදලා updates යවන හැටි (ඔයා, Endora)

Installers GitHub එකේ cloud computers වල හැදෙනවා. ඔයාට PC එකක්වත් Mac එකක්වත් ඕනේ නැහැ, browser එක ඇති.

Code එකයි installers එකයි දෙකම තියෙන්නේ **`eapasindu-sudo/endora-album-releases`** (Public) repo එකේ. Secret එකක් දාන්න ඕනේ නැහැ, GitHub එකේ built-in token එකෙන් release එක හැදෙනවා.

### Installer එක හදන්න / update එකක් යවන්න
1. අලුත් version එකක් නම් GitHub එකේම `package.json` open කරලා ✏️ ඔබන්න. `"version": "1.0.0"` එක `"1.0.1"` වගේ වැඩි කරලා **Commit** කරන්න.
2. **Actions → Release → Run workflow → Run workflow** ඔබන්න.
3. විනාඩි 15–20කින් **Releases** එකේ මේ installers පේනවා:
   - `Endora-Album-Setup-x.x.x.exe` (Windows)
   - `Endora-Album-x.x.x-arm64.dmg` (Mac M1/M2/M3)
   - `Endora-Album-x.x.x-x64.dmg` (Intel Mac)

Install කරලා තියෙන apps වලට ඒ version එක update එකක් විදිහට යනවා:
- **Windows:** auto update වෙනවා.
- **Mac:** Apple Developer ID එක නැති නිසා **Download** button එකක් පේනවා. ID එක ගත්තොත් `package.json` එකේ `"macSigned": true` කරන්න.
- App update එකේ flipbook site එකට වෙනසක් ආවොත්, ඒක photographer ගේ Cloudflare එකට තනියම upload වෙනවා.

**Customersලාට download link එක:** `https://github.com/eapasindu-sudo/endora-album-releases/releases/latest`

> Note: මේ repo එක Public නිසා app එකේ code එකත් ඕනෑම කෙනෙක්ට පේනවා.

### ඔයාගේ PC එකේ test කරන්න
```bash
npm install
npm start          # app එක run කරන්න
npm test           # layout tests
npm run dist:win   # Windows installer එක dist/ folder එකට (Windows PC එකක)
```

---

## App එකේ තියෙන දේවල්
- **Albums**: album list එක, status එකත් එක්ක (Designing → Client review → Approved → Printing)
- **New album**: album size 12×36, 12×30, 10×30, 8×24 හෝ **Custom** (inch/cm/mm), bleed, DPI, presets
- **Import**: photos ඕනෑම ගාණක් දාන්න පුළුවන්, limit එකක් නැහැ (JPG/PNG/WebP/TIFF). Blur, duplicate, exposure, faces check කරලා, photo ගත්ත වෙලාව අනුව "parts of the day" වලට බෙදනවා.
- **Auto Build**: styles 4ක්, Spreads/Pages + Suggest, Smart/Range, Use every photo, template reuse, Sinhala/English titles
- **AI layouts**: spread එකේ photos වල හැඩය (portrait/landscape) බලලා crop නොවෙන විදිහට layouts auto හැදෙනවා. ගාණක් නැහැ, "Show new ideas" ඔබන හැම පාරම අලුත් ඒවා එනවා. Spread එකකට photos 40ක් වෙනකන් දාන්න පුළුවන්.
- **My templates**: Designer එකේ photo frame එකක corners අදිනකොට size එක වෙනස් වෙනවා, මැද ✥ grip එක අදිනකොට frame එක move වෙනවා. Frames අනිත් frames, margins සහ centre fold එකට snap වෙනවා. **Save this spread as my template** එබුවාම template එක save වෙනවා. ඒක හැම album එකකම සහ Auto Build එකේදීත් පාවිච්චි කරන්න පුළුවන්.
- **Album | Designer**: spreads ඔක්කොම එක පේළියට, Text packs (Sinhala/Tamil/English), backgrounds, drag & drop, crop/zoom, undo/redo
- **Print check / Export**: guides, print proof, mockup, DPI warnings, JPG/TIFF 300 DPI with bleed
- **Send to client**: Cloudflare link එක + PIN, video, cover, comments, approve, WhatsApp/Email/QR
- **Settings**: studio name, Cloudflare connect/disconnect, check for updates, dark/light theme

## දැනට නැති දේවල්
- RAW/HEIC files කෙලින්ම කියවන්නේ නැහැ. Lightroom එකෙන් JPG/TIFF කරලා import කරන්න.
- Eyes-closed detection නැහැ.
- Export එක sRGB. Lab එකේ ICC profile එකට හරියටම ගන්න ඕනේ නම් Photoshop එකේ soft-proof කරන්න.

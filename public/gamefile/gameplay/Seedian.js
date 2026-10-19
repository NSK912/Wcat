// =========================================================================
// ภาษาซีเดียน (Seedian Vector SVG Script System)
// Genshin Teyvat-Style Handwriteable Geometric Runes (เขียนด้วยมือได้จริง 100%)
// =========================================================================

(function(global) {
  // 1. Handcrafted Handwriteable Vector SVG Runes for A through Z (26 Seedian Runes)
  // Simple 1-3 stroke geometric runes that humans can easily draw on paper!
  // Zero Latin resemblance & zero stars!
  const SEEDIAN_SVG_PATHS = {
    // A: Triangle with horizontal crossbar
    "A": `<path d="M16 2.5 L28 29.5 H4 Z M2 17.5 H30" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // B: Vertical line with right-facing diamond
    "B": `<path d="M8 2.5 V29.5 M8 6.5 L24 16 L8 25.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // C: Sharp left bracket with center bar
    "C": `<path d="M26 2.5 L6 16 L26 29.5 M6 16 H28" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // D: Inverted triangle with center vertical axis
    "D": `<path d="M4 2.5 H28 L16 29.5 Z M16 2.5 V29.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // E: Square arch with inner vertical pillar
    "E": `<path d="M6 2.5 V29.5 H26 V2.5 M16 12 V29.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // F: Vertical pillar with dual diagonal slashes
    "F": `<path d="M10 2.5 V29.5 M10 8.5 L24 16 M10 18.5 L24 25.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // G: Diamond with right horizontal tail
    "G": `<path d="M16 2.5 L28 16 L16 29.5 L4 16 Z M16 16 H30" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // H: X-Cross with top and bottom cap bars
    "H": `<path d="M6 2.5 H26 M6 29.5 H26 M6 4.5 L26 27.5 M26 4.5 L6 27.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // I: Vertical line with top-right diagonal slash
    "I": `<path d="M16 2.5 V29.5 M16 10 L28 2.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // J: Hooked angle with floating dot
    "J": `<path d="M6 2.5 H22 V23.5 L14 29.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="26" cy="14" r="2.5" fill="currentColor"/>`,
    // K: Upward arrowhead with center vertical line
    "K": `<path d="M4 16 L16 2.5 L28 16 M16 2.5 V29.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // L: Square corner bracket with vertex diagonal slash
    "L": `<path d="M8 2.5 V29.5 H28 M2 29.5 L14 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // M: Wide chevron with dual side vertical legs
    "M": `<path d="M6 2.5 V29.5 L16 16 L26 29.5 V2.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // N: Vertical pillar with right-pointing chevron
    "N": `<path d="M8 2.5 V29.5 M8 16 L24 6.5 M8 16 L24 25.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // O: Pure clean hexagon
    "O": `<polygon points="16,2.5 27,8.5 27,23.5 16,29.5 5,23.5 5,8.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // P: Vertical pillar with left-pointing top triangle
    "P": `<path d="M22 2.5 V29.5 M22 4.5 L6 14.5 H22" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // Q: Diamond with descending vertical tail
    "Q": `<path d="M16 2.5 L26 14 L16 23.5 L6 14 Z M16 23.5 V29.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // R: Vertical pillar with right chevron & horizontal crossbar
    "R": `<path d="M8 2.5 V29.5 M8 4.5 L24 14 L8 23.5 M2 14 H28" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // S: Zigzag lightning angle bolt
    "S": `<path d="M26 2.5 L8 11.5 L24 20.5 L6 29.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // T: Top horizontal bar with twin vertical legs
    "T": `<path d="M4 2.5 H28 M10 2.5 V29.5 M22 2.5 V29.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // U: Basin arch with top horizontal closure bar
    "U": `<path d="M6 2.5 H26 M6 2.5 V21.5 L16 29.5 L26 21.5 V2.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // V: V-chevron with top horizontal closure bar
    "V": `<path d="M2 2.5 H30 M6 2.5 L16 29.5 L26 2.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // W: Inverted triangle with top antenna
    "W": `<path d="M4 12 H28 L16 29.5 Z M16 2.5 V12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // X: Plus cross with center square frame
    "X": `<path d="M16 2.5 V29.5 M2 16 H30" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="10" width="12" height="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // Y: Vertical pillar with top diamond loop
    "Y": `<path d="M16 15.5 V29.5 M16 2.5 L26 9.5 L16 16.5 L6 9.5 Z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    // Z: Square box frame with diagonal slash
    "Z": `<rect x="4" y="2.5" width="24" height="27" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="4" y1="29.5" x2="28" y2="2.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
  };

  // Comprehensive Thai-to-English Mapping & Phonetic Romanization for auto-translating Thai text
  const THAI_TO_EN_MAP = {
    "ดาวเคราะห์แห่งเ": "SEED",
    "ล็ดพันธุ์": "PLANET",
    "ดาวเคราะห์แห่งเมล็ดพันธุ์": "SEEDPLANET",
    "ดาวเคราะห์": "PLANET",
    "เมล็ดพันธุ์": "SEEDS",
    "ภาษาซีเดียน": "SEEDIAN SCRIPT",
    "ซีเดียน": "SEEDIAN",
    "ภาษา": "LANGUAGE",
    "ตั้งค่า": "SETTINGS",
    "เปิด": "ON",
    "ปิด": "OFF",
    "แสดงตัวนับ": "SHOW COUNTER",
    "ความไวเมาส์": "MOUSE SENSITIVITY",
    "สเกลความละเอียดเรนเดอร์": "RENDER SCALE",
    "จำกัดเฟรมเรต": "FPS LIMIT",
    "ระดับเสียงรวม": "MASTER VOLUME",
    "คุณภาพเงา": "SHADOW QUALITY",
    "ลดรอยหยัก": "ANTI ALIASING",
    "ลดรอยหยักขอบภาพ": "ANTI ALIASING",
    "ปิดหน้าต่าง": "CLOSE",
    "ทดลองพิมพ์ข้อความ": "TRY TYPING",
    "เกม": "GAME",
    "เริ่ม": "START",
    "เล่นต่อ": "RESUME",
    "ออกจากเกม": "QUIT GAME",
    "กระเป๋า": "INVENTORY",
    "คราฟต์": "CRAFTING",
    "ทำอาหาร": "COOKING",
    "บันทึก": "SAVE",
    "ตั้งค่าปุ่มควบคุม": "KEY BINDINGS",
    "คืนค่าเริ่มต้น": "RESTORE DEFAULTS"
  };

  function convertThaiToPhoneticEnglish(text) {
    if (!text || typeof text !== "string") return "";
    let str = text.trim();
    for (const [th, en] of Object.entries(THAI_TO_EN_MAP)) {
      if (str.includes(th)) {
        str = str.replace(new RegExp(th, "g"), en);
      }
    }
    const thConsonantMap = {
      "ก": "K", "ข": "KH", "ฃ": "KH", "ค": "KH", "ฅ": "KH", "ฆ": "KH", "ง": "NG",
      "จ": "CH", "ฉ": "CH", "ช": "CH", "ซ": "S", "ฌ": "CH", "ญ": "Y",
      "ฎ": "D", "ฏ": "T", "ฐ": "TH", "ฑ": "TH", "ฒ": "TH", "ณ": "N",
      "ด": "D", "ต": "T", "ถ": "TH", "ท": "TH", "ธ": "TH", "น": "N",
      "บ": "B", "ป": "P", "ผ": "PH", "ฝ": "F", "พ": "PH", "ฟ": "F", "ภ": "PH",
      "ม": "M", "ย": "Y", "ร": "R", "ล": "L", "ว": "W",
      "ศ": "S", "ษ": "S", "ส": "S", "ห": "H", "ฬ": "L", "อ": "O", "ฮ": "H"
    };
    const thVowelMap = {
      "ะ": "A", "า": "A", "ำ": "AM", "ิ": "I", "ี": "I", "ึ": "U", "ื": "U",
      "ุ": "U", "ู": "U", "เ": "E", "แ": "AE", "โ": "O", "ใ": "AI", "ไ": "AI",
      "ฤ": "RU", "ฦ": "LU", "็": "A", "ั": "A", "์": "", "ํ": "N", "ฺ": ""
    };
    let out = "";
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (thConsonantMap[ch]) out += thConsonantMap[ch];
      else if (thVowelMap[ch] !== undefined) out += thVowelMap[ch];
      else out += ch;
    }
    return out;
  }

  // Helper to generate a single inline SVG string for an English letter
  function getSingleLetterSVG(char, size = "1em", color = "currentColor") {
    const uppercaseChar = String(char || "").toUpperCase();
    const pathData = SEEDIAN_SVG_PATHS[uppercaseChar];
    if (!pathData) {
      if (char === " ") return `<span style="display:inline-block; width:0.4em;"></span>`;
      return String(char);
    }
    return `<svg class="seedian-svg-glyph" viewBox="0 0 32 32" style="display:inline-block; width:${size}; height:${size}; vertical-align:middle; color:${color}; overflow:hidden;" aria-label="${uppercaseChar}">${pathData}</svg>`;
  }

  // Convert plain text string (English or Thai) to a sequence of Seedian SVG Glyphs
  function convertPlainTextToSeedian(text) {
    if (!text || typeof text !== "string") return "";
    let inputStr = convertThaiToPhoneticEnglish(text);

    let result = "";
    for (let i = 0; i < inputStr.length; i++) {
      const ch = inputStr[i];
      if (/[a-zA-Z]/.test(ch)) {
        result += getSingleLetterSVG(ch);
      } else if (ch === " ") {
        result += `<span style="display:inline-block; width:0.4em;"></span>`;
      } else {
        result += ch;
      }
    }
    return result;
  }

  // Convert any string to Seedian SVG Glyphs while safely preserving HTML tags
  function toSeedian(text) {
    if (!text || typeof text !== "string") return "";

    if (text.includes("<") && text.includes(">")) {
      const parts = text.split(/(<[^>]+>)/g);
      let htmlResult = "";
      for (let part of parts) {
        if (part.startsWith("<") && part.endsWith(">")) {
          htmlResult += part;
        } else if (part) {
          htmlResult += convertPlainTextToSeedian(part);
        }
      }
      return htmlResult;
    }

    return convertPlainTextToSeedian(text);
  }

  // Special Title Formatter for Game Title with Red Accent on 'A' or 'S'
  function getSeedianTitleHTML(text) {
    if (!text || typeof text !== "string") return "";
    let englishText = text;
    if (THAI_TO_EN_MAP[text]) {
      englishText = THAI_TO_EN_MAP[text];
    } else if (text.includes("ดาวเคราะห์") || text.includes("SEED")) {
      englishText = "SEED";
    } else if (text.includes("พันธุ์") || text.includes("ล็ด") || text.includes("PLANET")) {
      englishText = "PLANET";
    } else {
      englishText = convertThaiToPhoneticEnglish(text);
    }

    let html = "";
    for (let i = 0; i < englishText.length; i++) {
      const ch = englishText[i];
      if (ch.toUpperCase() === "E") {
        html += getSingleLetterSVG(ch, "1em", "#ff3b47");
      } else {
        html += getSingleLetterSVG(ch, "1em", "#ffffff");
      }
    }
    return html;
  }

  // Vector Title SVG Subtitle Renderer (SEEDPLANET Subtitle)
  function getThaiTitleLogoSVG() {
    return `<svg class="main-screen-thai-svg" viewBox="0 0 320 28" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMid meet" aria-label="SEEDPLANET">
      <defs>
        <linearGradient id="seedianRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff7b85" />
          <stop offset="50%" stop-color="#ff3b47" />
          <stop offset="100%" stop-color="#cc2531" />
        </linearGradient>
        <linearGradient id="seedianGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff5db" />
          <stop offset="50%" stop-color="#dfb76c" />
          <stop offset="100%" stop-color="#a87d30" />
        </linearGradient>
        <filter id="seedianGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.95" />
        </filter>
      </defs>
      <text x="320" y="21" text-anchor="end" filter="url(#seedianGlow)" font-family="'Google Sans', sans-serif" font-size="16" font-weight="700" letter-spacing="0.14em">
        <tspan fill="#ffffff">SEED</tspan><tspan fill="url(#seedianGoldGrad)">PLANET</tspan>
      </text>
    </svg>`;
  }

  // Complete Lexicon Chart Modal Component (Genshin Impact Teyvat Chart Style)
  function createSeedianModalDOM() {
    let existing = document.getElementById("seedianLexiconModal");
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement("div");
    overlay.id = "seedianLexiconModal";
    overlay.className = "seedian-modal-overlay";

    const alphabetList = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

    const renderAlphabetCards = () => {
      return alphabetList.map(letter => {
        const svgIcon = getSingleLetterSVG(letter, "30px", "#dfb76c");
        return `
          <div class="seedian-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); border: 1px solid rgba(223,183,108,0.25); padding: 12px 8px; gap: 8px; --cut: 6px; clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut))); transition: transform 0.2s, border-color 0.2s;">
            <div style="width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 6px rgba(223,183,108,0.4));">
              ${svgIcon}
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #ffffff; font-family: 'Google Sans', sans-serif; letter-spacing: 0.05em;">
              ${letter}
            </div>
          </div>
        `;
      }).join("");
    };

    overlay.innerHTML = `
      <div class="seedian-modal-box" style="position: relative; max-width: 680px; width: 92vw;">
        <!-- Scrollable Body -->
        <div class="seedian-modal-body" style="padding-top: 20px;">
          <!-- Live Interactive Translator -->
          <div style="background: rgba(223,183,108,0.05); border: 1px solid rgba(223,183,108,0.25); --cut: 10px; clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut))); padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 700; color: #dfb76c; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; font-family: 'Google Sans', sans-serif; letter-spacing: 0.08em; text-shadow: 0 0 6px rgba(223,183,108,0.3);">
              <span>✦</span> ${toSeedian("TRY TYPING")} (พิมพ์ข้อความ A-Z)
            </div>
            <div style="display: flex; gap: 10px; flex-direction: column;">
              <input
                id="seedianLiveInput"
                type="text"
                placeholder="พิมพ์ข้อความภาษาอังกฤษ เช่น SEEDPLANET / HELLO..."
                value="SEEDPLANET"
                style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; color: #ffffff; font-size: 14px; font-family: 'Google Sans', sans-serif; outline: none; --cut: 6px; clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));"
              />
              <div style="background: rgba(0,0,0,0.7); border: 1px solid #dfb76c; padding: 12px 14px; min-height: 48px; display: flex; align-items: center; gap: 10px; --cut: 6px; clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));">
                <div id="seedianLiveOutput" style="font-size: 24px; color: #dfb76c; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; word-break: break-all; filter: drop-shadow(0 0 8px rgba(223,183,108,0.5));">
                  ${toSeedian("SEEDPLANET")}
                </div>
              </div>
            </div>
          </div>

          <!-- Section: Genshin Teyvat-Style Alphabet Chart (A - Z) -->
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #dfb76c; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; font-family: 'Google Sans', sans-serif; letter-spacing: 0.08em; text-shadow: 0 0 6px rgba(223,183,108,0.3);">
              <span>✦</span> ตารางเทียบอักษรซีเดียน Vector Script (A - Z)
            </div>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
              ${renderAlphabetCards()}
            </div>
          </div>
        </div>

        <!-- Footer with Game-Style Cut-Corner Close Button -->
        <div class="seedian-modal-footer" style="margin-top: 16px;">
          <button id="bottomCloseSeedianBtn" class="seedian-footer-btn" style="letter-spacing: 0.12em; font-family: 'Google Sans', sans-serif;">
            CLOSE
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    const bottomCloseBtn = overlay.querySelector("#bottomCloseSeedianBtn");
    if (bottomCloseBtn) {
      bottomCloseBtn.addEventListener("click", closeSeedianModal);
    }

    const input = overlay.querySelector("#seedianLiveInput");
    const output = overlay.querySelector("#seedianLiveOutput");
    if (input && output) {
      input.addEventListener("input", () => {
        output.innerHTML = toSeedian(input.value) || `<span style="color: rgba(255,255,255,0.4); font-size:14px;">(พิมพ์ข้อความ A-Z เพื่อแปล)</span>`;
      });
    }

    return overlay;
  }

  function openSeedianModal() {
    const modal = createSeedianModalDOM();
    if (modal) {
      modal.classList.add("active");
    }
  }

  function closeSeedianModal() {
    const modal = document.getElementById("seedianLexiconModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  // Dynamic UI Bumper & Auto-Fit Scaling System (Only scales down when strictly exceeding screen)
  function updateStartControlsPosition() {
    const titleEl = document.querySelector(".game-start-overlay .main-screen-title");
    const controls = document.getElementById("startMenuControls");
    if (titleEl && controls) {
      const rect = titleEl.getBoundingClientRect();
      if (rect.height > 0 && rect.bottom > 0) {
        controls.style.top = Math.round(rect.bottom + 8) + "px";
      }
    }

    const loadTitleEl = document.querySelector(".aaa-loading-overlay .main-screen-title");
    const loadContent = document.querySelector(".aaa-loading-content");
    if (loadTitleEl && loadContent) {
      const rect = loadTitleEl.getBoundingClientRect();
      if (rect.height > 0 && rect.bottom > 0) {
        loadContent.style.top = Math.round(rect.bottom + 8) + "px";
      }
    }
  }

  function autoFitMainScreenTitle() {
    const wrappers = document.querySelectorAll(".main-screen-title-wrapper");
    wrappers.forEach(wrapper => {
      const parent = wrapper.parentElement;
      if (!parent) return;
      
      wrapper.style.transform = "none";
      const title = wrapper.querySelector(".main-screen-title") || wrapper;
      const screenMax = window.innerWidth * 0.94;
      const parentMax = (parent.clientWidth > 0 ? parent.clientWidth * 0.98 : screenMax);
      const availableWidth = Math.min(screenMax, parentMax);
      const titleWidth = title.scrollWidth;
      
      if (titleWidth > availableWidth && availableWidth > 0) {
        const scale = Math.max(0.2, (availableWidth / titleWidth) * 0.98);
        wrapper.style.transform = `scale(${scale.toFixed(4)})`;
        wrapper.style.transformOrigin = "center center";
      } else {
        wrapper.style.transform = "none";
      }
    });

    updateStartControlsPosition();
  }

  if (typeof window !== "undefined") {
    window.autoFitMainScreenTitle = autoFitMainScreenTitle;
    window.updateStartControlsPosition = updateStartControlsPosition;
    window.addEventListener("resize", autoFitMainScreenTitle, { passive: true });
    window.addEventListener("orientationchange", autoFitMainScreenTitle, { passive: true });
    window.addEventListener("DOMContentLoaded", () => {
      [50, 150, 300, 600, 1200].forEach(delay => setTimeout(autoFitMainScreenTitle, delay));
    });
    let fitAttempts = 0;
    const fitInterval = setInterval(() => {
      autoFitMainScreenTitle();
      fitAttempts++;
      if (fitAttempts > 15) clearInterval(fitInterval);
    }, 300);
  }

  // Handle ESC key to close modal
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSeedianModal();
      }
    });
  }

  // Export module
  global.Seedian = {
    SVG_PATHS: SEEDIAN_SVG_PATHS,
    getSingleLetterSVG: getSingleLetterSVG,
    toSeedian: toSeedian,
    toSeedianSVG: toSeedian,
    getSeedianTitleHTML: getSeedianTitleHTML,
    transliterate: toSeedian,
    getThaiTitleLogoSVG: getThaiTitleLogoSVG,
    openModal: openSeedianModal,
    closeModal: closeSeedianModal,
    autoFitTitle: autoFitMainScreenTitle
  };

  global.getThaiTitleLogoSVG = getThaiTitleLogoSVG;
  global.getSingleLetterSVG = getSingleLetterSVG;
  global.toSeedian = toSeedian;
  global.toSeedianSVG = toSeedian;
  global.getSeedianTitleHTML = getSeedianTitleHTML;
  global.openSeedianModal = openSeedianModal;
  global.closeSeedianModal = closeSeedianModal;
  global.autoFitMainScreenTitle = autoFitMainScreenTitle;
})(typeof window !== "undefined" ? window : this);

// === SEEDPLANET UI LAYOUT & SYSTEM ===
document.body.insertAdjacentHTML("afterbegin", `<div
      id="fadeToBlack"
      style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000;
        z-index: 100000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 1.5s ease-in-out;
      "
    ></div>

    <!-- Damage Flash Overlay -->
    <div id="damageFlash" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle, rgba(255,0,0,0) 40%, rgba(255,0,0,0.4) 100%); border: 3px solid rgba(255,0,0,0.5); z-index: 15000; pointer-events: none;"></div>

    <!-- Floating NPC HP Overlay -->
    <div id="npcHpOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10005;"></div>

    <!-- หน้าเข้าเกม (Title Screen) -->
    <div class="game-start-overlay" id="gameStartOverlay">
      <div class="logo-container">
        <div class="main-screen-title-wrapper">
          ${(typeof getThaiTitleLogoSVG === 'function') ? getThaiTitleLogoSVG() : '<div class="main-screen-thai-title"><span style="color:#ffffff;">SEED</span><span class="thai-title-gold">PLANET</span></div>'}
          <h1 class="main-screen-title" style="color: #ffffff;"><span>${(typeof getSeedianTitleHTML === 'function') ? getSeedianTitleHTML('SEED') : (typeof toSeedian === 'function') ? toSeedian('SEED') : 'SEED'}</span><img src="assets/Flower Spiral Fibonacci.png" class="main-screen-title-icon" alt="Planet" referrerpolicy="no-referrer" /><span style="color: #ffffff;">${(typeof getSeedianTitleHTML === 'function') ? getSeedianTitleHTML('PLANET') : (typeof toSeedian === 'function') ? toSeedian('PLANET') : 'PLANET'}</span></h1>
        </div>
      </div>
      <div class="start-menu-controls" id="startMenuControls">
        <div
          id="startMenuButtonsContainer"
          style="
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
            gap: 16px;
            z-index: 2;
            transition: opacity 0.5s ease-in-out;
            width: 100%;
          "
        >
          <button class="start-btn game-ui" id="gameStartBtn" data-i18n="start_game">
            เริ่มเล่น
          </button>
          <button
            class="start-btn game-ui"
            id="gameSettingsBtn"
            data-i18n="settings"
            style="
              font-size: 16px;
              padding: 14px 40px;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.25);
              color: rgba(255, 255, 255, 0.85);
              box-shadow: none;
            "
          >
            ตั้งค่า
          </button>
          <button
            class="start-btn game-ui"
            id="gameDevBtn"
            data-i18n="dev_mode"
            style="
              display: none;
              font-size: 16px;
              padding: 14px 40px;
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.25);
              color: rgba(255, 255, 255, 0.85);
              box-shadow: none;
            "
          >
            โหมดผู้พัฒนา
          </button>
        </div>
        <div id="startScreenSocialBar" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 0; transition: opacity 0.4s ease; flex-wrap: wrap;">
          <!-- YouTube Icon Link -->
          <a
            href="https://www.youtube.com/@Nat_suki452"
            target="_blank"
            rel="noopener noreferrer"
            style="width: 36px; height: 36px; background-color: rgba(220, 38, 38, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ef4444; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); flex-shrink: 0;"
            title="YouTube"
            onmouseover="this.style.backgroundColor='rgba(220, 38, 38, 0.2)'"
            onmouseout="this.style.backgroundColor='rgba(220, 38, 38, 0.1)'"
          >
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>

          <!-- GitHub Icon Link -->
          <a
            href="https://github.com/NSK912/NSKSW/tree/NSK912-patch-1"
            target="_blank"
            rel="noopener noreferrer"
            style="width: 36px; height: 36px; background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #cbd5e1; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); flex-shrink: 0;"
            title="GitHub"
            onmouseover="this.style.backgroundColor='rgba(255, 255, 255, 0.1)'; this.style.color='#ffffff';"
            onmouseout="this.style.backgroundColor='rgba(255, 255, 255, 0.05)'; this.style.color='#cbd5e1';"
          >
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>

          <!-- Donate Icon + Text Link -->
          <a
            href="https://www.patreon.com/c/natsuki69/membership"
            target="_blank"
            rel="noopener noreferrer"
            style="height: 36px; padding: 0 12px; display: flex; align-items: center; gap: 6px; background-color: rgba(255, 66, 77, 0.1); border: 1px solid rgba(255, 66, 77, 0.3); color: #FF424D; border-radius: 8px; font-weight: 500; font-size: 12px; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); flex-shrink: 0; text-decoration: none;"
            title="Donate"
            onmouseover="this.style.backgroundColor='rgba(255, 66, 77, 0.2)'"
            onmouseout="this.style.backgroundColor='rgba(255, 66, 77, 0.1)'"
          >
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
              <path d="M15.386 0c-4.767 0-8.64 3.873-8.64 8.64 0 4.755 3.873 8.633 8.64 8.633 4.755 0 8.633-3.878 8.633-8.633C24.019 3.873 20.141 0 15.386 0zM2.404 24H0V0h2.404v24z" />
            </svg>
            <span>Donate</span>
          </a>

          <!-- Version Info -->
          <div style="color: #64748b; font-size: 12px; font-weight: 500; font-family: 'Google Sans', sans-serif; margin-left: 8px;">
            <span style="font-weight: 700; margin-right: 4px;">NSK App</span>
            ver 2.0.10
          </div>
        </div>
      </div>
  </div>

    <!-- หน้าต่างเลือกเซฟ (Save Slots Selection) -->
    <div
      class="inventory-overlay"
      id="saveSelectOverlay"
      style="z-index: 10005"
    >
      <div
        class="inventory-panel game-ui lg"
        style="
          max-width: 540px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border: 1px solid rgba(223, 183, 108, 0.4);
          box-shadow: 0 0 35px rgba(223, 183, 108, 0.25);
          position: relative;
        "
      >
        <div
          class="save-select-header"
          style="
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            margin: 0 0 8px 0;
            padding: 0 0 14px 0;
            border-bottom: 1px solid rgba(223, 183, 108, 0.25);
          "
        >
          <h2
            data-i18n="select_save_slot"
            style="
              color: #dfb76c;
              font-size: 18px;
              font-weight: bold;
              margin: 0;
              text-shadow: 0 0 10px rgba(223, 183, 108, 0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              font-family: 'Google Sans', sans-serif;
              letter-spacing: 0.5px;
            "
          >
            📂 เลือกข้อมูลเซฟ
          </h2>
        </div>

        <!-- รายการเซฟไฟล์ -->
        <div
          id="saveSlotsList"
          style="
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: 50vh;
            overflow-y: auto;
            padding-right: 14px;
          "
        >
          <!-- ช่องเซฟจะถูกสร้างด้วย JS ที่นี่ -->
        </div>

        <!-- Custom Sci-Fi DOM Virtual Scrollbar for Save Slots -->
        <div id="saveSelectCustomScrollbar" class="custom-scrollbar-track game-ui clickable" style="top: 72px; bottom: 68px; right: 8px; width: 8px;">
          <div id="saveSelectCustomScrollbarThumb" class="custom-scrollbar-thumb game-ui clickable"></div>
        </div>

        <div
          style="
            display: flex;
            gap: 12px;
            margin-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 12px;
            position: relative;
          "
        >
          <button
            id="btnSaveSelectBack"
            data-i18n="back"
           class="game-ui" style="flex: 1;
              background: rgba(239, 68, 68, 0.1);
              border: 1px solid rgba(239, 68, 68, 0.4);
              color: #fca5a5;
              padding: 10px;
              font-size: 11px;
              font-family: 'Google Sans', sans-serif;
              cursor: pointer;
              transition: all 0.2s;
              font-weight: bold;">
            ย้อนกลับ
          </button>
          <div
            id="saveLoadingIndicator"
            
           class="game-ui" style="display: none;
              flex: 1;
              align-items: center;
              justify-content: center;
              gap: 12px;
              background: rgba(223, 183, 108, 0.05);
              border: 1px solid rgba(223, 183, 108, 0.2);
              color: #dfb76c;
              padding: 10px;
              font-size: 11px;
              font-family: 'Google Sans', sans-serif;
              font-weight: bold;">
            <div class="loading-squares">
              <div class="loading-square"></div>
              <div class="loading-square"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- WebGPU Canvas (Primary/Background) -->
    <canvas id="mapCanvas" style="position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1;"></canvas>
    <!-- WebGL Canvas (Fallback/Foreground - Transparent) -->
    <canvas id="glCanvas" style="position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2; pointer-events: none; background: transparent;"></canvas>
    <!-- 3D Bone Labels Floating Overlay -->
    <div id="devBoneLabelsOverlay" style="position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999; overflow: hidden; display: none;"></div>


    <!-- Compass HUD -->
    <div id="compassContainer" class="game-ui visible" style="position: fixed; top: 10px; left: 50%; transform: translateX(-50%); width: 560px; max-width: 90vw; height: 56px; z-index: 10000; pointer-events: none; display: flex; align-items: center; justify-content: center; user-select: none; background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; border: none; box-shadow: none; clip-path: none;">
      <canvas id="compassCanvas" width="1120" height="112" style="width: 560px; height: 56px; display: block; background: transparent;"></canvas>
    </div>

    <!-- เมนูซ้ายบน -->
    <div class="top-left-menu game-ui">
      <!-- ปุ่มเปิดกระเป๋า -->
      <button
        class="inventory-btn game-ui"
        id="inventoryToggle"
        title="เปิดกระเป๋า (Inventory)"
      >
        <span id="inventoryToggleNormalContent" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="display: block"
          >
            <path
              d="M4 20V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
            />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            <rect x="9" y="10" width="6" height="5" rx="1" />
          </svg>
          <span class="inventory-badge game-ui" id="inventoryBadge">0</span>
        </span>
        <span id="inventoryToggleDemolishContent" style="display: none; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="display: block"
          >
            <path d="m15 12-8.5 8.5a2.1 2.1 0 1 1-3-3L12 9" />
            <path d="M17.64 15 22 10.64a2.41 2.41 0 0 0 0-3.41L16.77 2.3a2.41 2.41 0 0 0-3.41 0L9 6.64" />
            <path d="m20 8-5 5" />
          </svg>
        </span>
      </button>

      <!-- FPS Counter -->
      <div class="fps-counter game-ui" id="fpsCounter">
        FPS: <span class="fps-value" id="fpsDisplay">0</span>
        <span class="fps-lock"> | 120</span>
      </div>

      <!-- ปุ่มเต็มจอ -->
      <button id="fullscreenBtn" class="fullscreen-btn" style="display: none;">📺 เต็มจอ</button>
    </div>

    <!-- ปุ่มเต็มจอส่วนเกมเพย์ มุมขวาบน (Gameplay Fullscreen Button Top-Right) -->
    <button
      id="gameplayFullscreenBtn"
      class="game-ui"
      title="เต็มจอ / ย่อจอ (Toggle Fullscreen)"
      style="
        position: fixed;
        top: calc(10px + var(--ui-margin, 0px));
        right: calc(10px + var(--ui-margin, 0px));
        width: 36px;
        height: 36px;
        z-index: 10001;
        background: rgba(10, 10, 15, 0.85);
        color: #dfb76c;
        border: 1px solid rgba(223, 183, 108, 0.4);
        border-radius: 0;
        --cut: 6px;
        clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));
        padding: 0;
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        transition: background 0.2s, border-color 0.2s, transform 0.15s;
      "
      onmouseover="this.style.background='rgba(223, 183, 108, 0.25)'; this.style.borderColor='rgba(223, 183, 108, 0.8)';"
      onmouseout="this.style.background='rgba(10, 10, 15, 0.85)'; this.style.borderColor='rgba(223, 183, 108, 0.4)';"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path>
      </svg>
    </button>

    <!-- Virtual Joystick - ปุ่มเดียวลากได้ -->
    <div class="joystick-container game-ui" id="joystickContainer">
      <div class="joystick-base" id="joystickBase">
        <span class="joystick-dir up">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </span>
        <span class="joystick-dir down">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
        <span class="joystick-dir left">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </span>
        <span class="joystick-dir right">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        <div class="joystick-thumb" id="joystickThumb"></div>
      </div>
    </div>


    <!-- Modal ยืนยันทำลายไอเทม (Contained inside Inventory / Chest Panel) -->
    <div class="confirm-overlay" id="trashConfirmOverlay" onwheel="event.preventDefault(); event.stopPropagation();" ontouchmove="event.preventDefault(); event.stopPropagation();" style="display: none; position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0, 0, 0, 0.78) !important; z-index: 1000 !important; border-radius: inherit !important; align-items: center !important; justify-content: center !important; backdrop-filter: blur(4px) !important; pointer-events: auto !important;">
      <div class="game-ui" style="background: #0a0a0f; border: 1px solid rgba(255, 60, 60, 0.4); padding: 24px; text-align: center; min-width: 280px; max-width: 320px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,60,60,0.08); position: relative;">
        <!-- decorative corner accents -->
        <div style="position: absolute; top: -1px; left: -1px; width: 8px; height: 8px; border-top: 2px solid #ff5555; border-left: 2px solid #ff5555;"></div>
        <div style="position: absolute; bottom: -1px; right: -1px; width: 8px; height: 8px; border-bottom: 2px solid #ff5555; border-right: 2px solid #ff5555;"></div>
        
        <h3 style="color: #ff5555; margin: 0; font-family: 'Google Sans', sans-serif; font-size: 14px; letter-spacing: 1px; display: flex; flex-direction: column; gap: 4px;">
          <span>ทำลายไอเทม?</span>
          <span style="font-size: 11px; opacity: 0.7;">DESTROY ITEM?</span>
        </h3>
        
        <div class="game-ui" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
           <span id="trashConfirmIcon" style="font-size: 28px; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5)); display: inline-flex; align-items: center; justify-content: center; min-width: 56px; min-height: 56px;">📦</span>
           <span id="trashConfirmText" style="color: rgba(255, 255, 255, 0.7); font-size: 11px; font-family: 'Google Sans', sans-serif; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 500;">Item Name x1</span>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 10px;">
          <button id="trashCancelBtn" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'" class="game-ui" style="flex: 1; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 10px 0; cursor: pointer; font-family: 'Google Sans', sans-serif; font-size: 12px; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; transition: all 0.2s;">
            <span>ยกเลิก</span>
            <span style="font-size: 9px; opacity: 0.6;">CANCEL</span>
          </button>
          
          <button id="trashConfirmBtn" onmouseover="this.style.background='rgba(255,60,60,0.18)'" onmouseout="this.style.background='rgba(255,60,60,0.1)'" class="game-ui" style="flex: 1; background: rgba(255, 60, 60, 0.1); color: #ff5555; border: 1px solid rgba(255,60,60,0.5); padding: 10px 0; cursor: pointer; font-family: 'Google Sans', sans-serif; font-size: 12px; position: relative; overflow: hidden; user-select: none; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; transition: all 0.2s;">
            <div id="trashConfirmProgress" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(255, 60, 60, 0.35); pointer-events: none;"></div>
            <span style="position: relative; z-index: 1;">กดค้าง (ลบ)</span>
            <span style="position: relative; z-index: 1; font-size: 9px; opacity: 0.8;">HOLD TO DELETE</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal ยืนยันรีโหลดเกมเมื่อเปิด/ปิด Anti-Aliasing -->
    <div class="confirm-overlay" id="antialiasConfirmOverlay" onwheel="event.preventDefault(); event.stopPropagation();" ontouchmove="event.preventDefault(); event.stopPropagation();" style="display: none; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(0, 0, 0, 0.85) !important; z-index: 2147483647 !important; align-items: center !important; justify-content: center !important; backdrop-filter: blur(4px) !important; pointer-events: auto !important;">
      <div class="game-ui" style="background: #0a0a0f; border: 1px solid rgba(223, 183, 108, 0.3); padding: 24px; text-align: center; min-width: 300px; max-width: 340px; display: flex; flex-direction: column; gap: 16px; box-shadow: inset 0 0 20px rgba(223, 183, 108, 0.05); position: relative;">
        <!-- decorative corner accents -->
        <div style="position: absolute; top: -1px; left: -1px; width: 8px; height: 8px; border-top: 2px solid #dfb76c; border-left: 2px solid #dfb76c;"></div>
        <div style="position: absolute; bottom: -1px; right: -1px; width: 8px; height: 8px; border-bottom: 2px solid #dfb76c; border-right: 2px solid #dfb76c;"></div>
        
        <h3 style="color: #dfb76c; margin: 0; font-family: 'Google Sans', sans-serif; font-size: 14px; letter-spacing: 1px; display: flex; flex-direction: column; gap: 4px; text-align: center;">
          <span>ลดรอยหยัก เปิด-ปิด</span>
          <span style="font-size: 11px; opacity: 0.7;">ANTI-ALIASING ON/OFF</span>
        </h3>
        
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 10px;">
          <button id="antialiasCancelBtn" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'" class="game-ui" style="flex: 1; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 0; cursor: pointer; font-family: 'Google Sans', sans-serif; font-size: 12px; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; transition: all 0.2s;">
            <span>ยกเลิก</span>
            <span style="font-size: 9px; opacity: 0.6;">CANCEL</span>
          </button>
          
          <button id="antialiasConfirmBtn" onmouseover="this.style.background='rgba(223, 183, 108, 0.25)'" onmouseout="this.style.background='rgba(223, 183, 108, 0.15)'" class="game-ui" style="flex: 1; background: rgba(223, 183, 108, 0.15); color: #dfb76c; border: 1px solid rgba(223, 183, 108, 0.5); padding: 10px 0; cursor: pointer; font-family: 'Google Sans', sans-serif; font-size: 12px; position: relative; overflow: hidden; user-select: none; display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; transition: all 0.2s; text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
            <span style="position: relative; z-index: 1;">ตกลง (รีโหลด)</span>
            <span style="position: relative; z-index: 1; font-size: 9px; opacity: 0.8;">RELOAD</span>
          </button>
        </div>
      </div>
    </div>
    <!-- หน้าต่างกระเป๋า -->
    <div class="inventory-overlay" id="inventoryOverlay">
      <div class="inventory-panel game-ui">
        <div class="inventory-header">
          <div class="inventory-tabs">
            <h2 id="tabCrafting">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: block"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span data-i18n="tab_crafting">CRAFTING</span>
            </h2>
            <h2 id="tabInventory" class="active">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: block"
              >
                <path
                  d="M4 20V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
                />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                <rect x="9" y="10" width="6" height="5" rx="1" />
              </svg>
              <span data-i18n="tab_inventory">INVENTORY</span>
            </h2>
            <h2 id="tabItemsList">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: block"
              >
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
              <span data-i18n="tab_items_list">ITEMS LIST</span>
            </h2>
            <h2 id="tabSettings">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="display: block"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
              <span data-i18n="tab_settings">SETTINGS</span>
            </h2>
            <h2 id="tabCooking" style="display: none;">
              <span data-i18n="tab_cooking">COOKING</span>
            </h2>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
            <button
              class="close-btn game-ui"
              id="quitGameBtn"
              style="
                display: none !important;
                color: #ff5555;
                border-color: rgba(255, 60, 60, 0.4);
                position: relative;
                overflow: hidden;
              "
              title="กดค้างเพื่อออกเกม (Hold to Quit)"
            >
              <div
                id="quitGameProgress"
                style="
                  position: absolute;
                  bottom: 0;
                  left: 0;
                  height: 100%;
                  width: 0%;
                  background: rgba(255, 60, 60, 0.3);
                  pointer-events: none;
                "
              ></div>
              <svg
                style="position: relative; z-index: 1"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
            <button class="close-btn game-ui" id="inventoryClose">✕</button>
          </div>
        </div>



        <div id="inventoryMainLayout" style="display: flex; gap: 20px; align-items: flex-start; justify-content: center; width: auto; margin: 16px auto; box-sizing: border-box;">
          <div class="inventory-grid" id="inventoryGrid" style="margin: 0;">
            <!-- สร้างช่องกระเป๋าผ่าน JavaScript -->
          </div>

          <!-- Vertical Divider line for Inventory Tab -->
          <div id="inventoryVerticalDivider" style="width: 1px; background: rgba(255, 255, 255, 0.1); margin: 0 4px; height: 312px; display: block;"></div>

          <!-- ช่องแอคชั่นข้างหน้าต่างกระเป๋า (Inventory Action Slots) -->
          <div id="inventoryActionSlotsWrapper" style="display: flex; flex-direction: column; gap: 8px; align-items: center; width: 72px; flex-shrink: 0; margin-top: 0; border: none; padding: 0;">
            <div style="color: #dfb76c; font-family: 'Google Sans', sans-serif; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; writing-mode: vertical-rl; text-orientation: mixed; margin-bottom: 8px; opacity: 0.7; display: flex; align-items: center; gap: 4px;">
              ⚡ ACTIONS
            </div>
            <div class="inventory-action-slots keyboard-mode" id="inventoryActionSlots">
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
              <div class="action-slot game-ui"></div>
            </div>
          </div>
        </div>

        <!-- 3 ปุ่มด้านล่างกระเป๋า -->
        <div id="inventoryBottomButtons" class="game-ui" style="display: none; gap: 10px; align-items: center; justify-content: center; width: 100%; max-width: 480px; margin: 12px auto 0 auto; box-sizing: border-box;">
          <button id="btnInventoryActionUI" class="game-ui clickable" style="
            flex: 1;
            height: 38px;
            background: rgba(223, 183, 108, 0.12);
            border: 1px solid rgba(223, 183, 108, 0.45);
            color: #dfb76c;
            border-radius: 0 !important;
            --cut: 8px;
            clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            transition: all 0.2s;
            font-family: 'Google Sans', sans-serif;
          ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(223, 183, 108, 0.25)"></polygon>
            </svg>
            <span data-i18n="bottom_btn_action">แอคชั่น UI</span>
          </button>
          <button id="btnInventorySplit" class="game-ui clickable" style="
            flex: 1;
            height: 38px;
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.45);
            color: #38bdf8;
            border-radius: 0 !important;
            --cut: 8px;
            clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            transition: all 0.2s;
            font-family: 'Google Sans', sans-serif;
          ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
              <!-- Back sci-fi square -->
              <rect x="8" y="3" width="13" height="13" rx="1.5" fill="rgba(56, 189, 248, 0.22)" stroke="#38bdf8" stroke-dasharray="2.5 2.5"></rect>
              <!-- Front sci-fi square overlapping -->
              <rect x="3" y="8" width="13" height="13" rx="1.5" fill="rgba(15, 23, 42, 0.85)" stroke="#38bdf8"></rect>
              <!-- Dividing / split indicator line inside -->
              <line x1="6.5" y1="14.5" x2="12.5" y2="14.5" stroke="#38bdf8" stroke-width="1.8"></line>
            </svg>
            <span data-i18n="bottom_btn_split">แบ่งจำนวนไอเทม</span>
          </button>
          <button id="btnInventoryDestroy" class="game-ui clickable" style="
            flex: 1;
            height: 38px;
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.45);
            color: #ef4444;
            border-radius: 0 !important;
            --cut: 8px;
            clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)));
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            transition: all 0.2s;
            font-family: 'Google Sans', sans-serif;
          ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            <span data-i18n="bottom_btn_destroy">ทำลายไอเทม</span>
          </button>
        </div>
        <div
          id="craftingList"
          style="
            display: none;
            flex-direction: column;
            gap: 12px;
            margin-top: 15px;
            color: #fff;
          "
        >
          <!-- สร้างรายการคราฟผ่าน JavaScript -->
        </div>

        <div
          id="cookingList"
          style="
            display: none;
            flex-direction: column;
            gap: 12px;
            margin-top: 15px;
            color: #fff;
          "
        >
          <!-- สร้างรายการทำอาหารผ่าน JavaScript -->
        </div>
        <div
          id="inventorySettings"
          style="
            display: none;
            padding: 12px 4px;
            color: #fff;
            flex-direction: column;
            gap: 18px;
          "
        >
          <!-- ภาษา (Language) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
                font-family: 'Google Sans', sans-serif;
              "
            >
              <span data-i18n="language_label">ภาษา (Language)</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; height: 32px;">
              <button
                id="langThBtn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.6); font-size: 11px; cursor: pointer; font-family: 'Google Sans', sans-serif; transition: all 0.2s;"
              >
                ภาษาไทย
              </button>
              <button
                id="langEnBtn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(223, 183, 108, 0.15); border: 1px solid #dfb76c; color: #dfb76c; font-size: 11px; cursor: pointer; font-family: 'Google Sans', sans-serif; transition: all 0.2s; text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);"
              >
                English
              </button>
              <button
                id="langSdBtn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.6); font-size: 11px; cursor: pointer; font-family: 'Google Sans', sans-serif; transition: all 0.2s;"
              >
                Seedian
              </button>
            </div>
          </div>

          <!-- เสียงเอฟเฟกต์รวม (SFX Volume) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
                font-family: 'Google Sans', sans-serif;
              "
            >
              <span style="display: inline-flex; align-items: center; gap: 8px">
                <span data-i18n="sfx_volume">ระดับเสียงรวม</span>
                <button
                  id="sfxMuteToggle"
                  style="
                    background: none;
                    border: none;
                    padding: 4px;
                    color: #dfb76c;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    transition: all 0.2s;
                    outline: none;
                    border-radius: 4px;
                  "
                  title="Mute/Unmute"
                  onmouseover="this.style.background = 'rgba(223,183,108,0.1)'"
                  onmouseout="this.style.background = 'none'"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    style="display: block"
                  >
                    <polygon
                      points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    ></polygon>
                    <path
                      d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
                    ></path>
                  </svg>
                </button>
              </span>
              <span id="sfxVolumeVal" style="color: #dfb76c; font-weight: bold"
                >50%</span
              >
            </div>
            <input
              type="range"
              id="sfxVolumeSlider"
              min="1"
              max="100"
              value="50"
              style="width: 100%; cursor: pointer; accent-color: #dfb76c"
            />
          </div>

          <!-- สเกล เรนเดอร์ จอเกม (Render Scale) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-family: 'Google Sans', sans-serif;
              "
            >
              <span data-i18n="render_scale">สเกลความละเอียดเรนเดอร์</span>
              <span
                id="renderScaleVal"
                style="color: #dfb76c; font-weight: bold"
                >100%</span
              >
            </div>
            <input
              type="range"
              id="renderScaleSlider"
              min="10"
              max="100"
              step="10"
              value="100"
              style="width: 100%; cursor: pointer; accent-color: #dfb76c"
            />
          </div>

          <!-- FPS Limit -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-family: 'Google Sans', sans-serif;
              "
            >
              <span data-i18n="fps_limit">จำกัดเฟรมเรต</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="fps30Btn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.6); font-size: 11px; cursor: pointer; font-family: 'Google Sans', sans-serif; transition: all 0.2s;"
              >
                30 FPS
              </button>
              <button
                id="fps60Btn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.6); font-size: 11px; cursor: pointer; font-family: 'Google Sans', sans-serif; transition: all 0.2s;"
              >
                60 FPS
              </button>
              <button
                id="fps120Btn"
                class="game-ui"
                style="flex: 1; padding: 6px 0; background: rgba(223, 183, 108, 0.15); border: 1px solid #dfb76c; color: #dfb76c; font-size: 11px; cursor: pointer; font-family: 'Google Sans', sans-serif; transition: all 0.2s; text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);"
              >
                120 FPS
              </button>
            </div>
          </div>
          <!-- ความเร็วเมาส์ / อนาล็อกขวา (Mouse / Right Stick Sensitivity) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-family: 'Google Sans', sans-serif;
              "
            >
              <span id="mouseSensitivityLabel" data-i18n="mouse_sensitivity">ความไวเมาส์</span>
              <span
                id="mouseSensitivityVal"
                style="color: #dfb76c; font-weight: bold"
                >1.00x</span
              >
            </div>
            <input
              type="range"
              id="mouseSensitivitySlider"
              min="10"
              max="300"
              step="5"
              value="100"
              style="width: 100%; cursor: pointer; accent-color: #dfb76c"
            />
          </div>

          <!-- การตั้งค่าโหมดแสดงผล (Screen Mode) -->
          <div id="screenModeSettingContainer" style="display: none !important; flex-direction: column; gap: 6px">
            <span data-i18n="screen_mode" style="font-size: 13px; font-family: 'Google Sans', sans-serif;"
              >โหมดแสดงผล</span
            >
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="setModeWindowed"
                data-i18n="mode_windowed"
               class="game-ui" style="flex: 1;
                  background: rgba(223, 183, 108, 0.15);
                  border: 1px solid #dfb76c;
                  color: #dfb76c;
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'Google Sans', sans-serif;
                  cursor: pointer;
                  transition: all 0.2s;
                  text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
                โหมดหน้าต่าง
              </button>
              <button
                id="setModeFullscreen"
                data-i18n="mode_fullscreen"
               class="game-ui" style="flex: 1;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: rgba(255, 255, 255, 0.6);
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'Google Sans', sans-serif;
                  cursor: pointer;
                  transition: all 0.2s;">
                เต็มจอ
              </button>
            </div>
          </div>

          <!-- การตั้งค่าแสดงผล FPS (FPS UI Toggle) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <span data-i18n="fps_display_toggle" style="font-size: 13px; font-family: 'Google Sans', sans-serif;"
              >แสดงตัวนับ FPS</span
            >
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="fpsToggleOn"
                data-i18n="on"
               class="game-ui" style="flex: 1;
                  background: rgba(223, 183, 108, 0.15);
                  border: 1px solid #dfb76c;
                  color: #dfb76c;
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'Google Sans', sans-serif;
                  cursor: pointer;
                  transition: all 0.2s;
                  text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
                เปิด
              </button>
              <button
                id="fpsToggleOff"
                data-i18n="off"
               class="game-ui" style="flex: 1;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: rgba(255, 255, 255, 0.6);
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'Google Sans', sans-serif;
                  cursor: pointer;
                  transition: all 0.2s;">
                ปิด
              </button>
            </div>
          </div>

          <!-- การตั้งค่า Shadow Map (Shadow Map Quality) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div style="display: flex; justify-content: space-between">
              <span data-i18n="shadow_quality" style="font-size: 13px; font-family: 'Google Sans', sans-serif;"
                >คุณภาพเงา</span
              >
              <span id="shadowMapQualityVal" style="font-size: 13px; font-family: 'Google Sans', sans-serif; color: #dfb76c;">Medium</span>
            </div>
            <input
              type="range"
              id="shadowMapQualitySlider"
              style="width: 100%; cursor: pointer; accent-color: #dfb76c"
              min="1"
              max="4"
              value="2"
              step="1"
            />
          </div>

          <!-- การตั้งค่า Anti-Aliasing (Hidden) -->
          <div style="display: none !important;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-family: 'Google Sans', sans-serif;"
                >Anti-Aliasing</span>
              <span style="font-size: 10px; color: rgba(255, 255, 255, 0.4); font-family: 'Google Sans', sans-serif;">(ต้องการรีโหลด)</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="antialiasToggleOn"
                class="game-ui" style="flex: 1;
                  background: rgba(223, 183, 108, 0.15);
                  border: 1px solid #dfb76c;
                  color: #dfb76c;
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'Google Sans', sans-serif;
                  cursor: pointer;
                  transition: all 0.2s;
                  text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
                เปิด
              </button>
              <button
                id="antialiasToggleOff"
                class="game-ui" style="flex: 1;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: rgba(255, 255, 255, 0.6);
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'Google Sans', sans-serif;
                  cursor: pointer;
                  transition: all 0.2s;">
                ปิด
              </button>
            </div>
          </div>

          <!-- การตั้งค่า FXAA (Fast Approximate Anti-Aliasing) -->
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span data-i18n="fxaa_label" style="font-size: 13px; font-family: 'Google Sans', sans-serif;"
                >FXAA (Anti-Aliasing)</span>
              <span data-i18n="fxaa_sub" style="font-size: 10px; color: rgba(223, 183, 108, 0.8); font-family: 'Google Sans', sans-serif;">(ลดรอยหยักภาพ)</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 32px;">
              <button
                id="fxaaToggleOn"
                data-i18n="on"
                class="game-ui" style="flex: 1;
                  background: rgba(223, 183, 108, 0.15);
                  border: 1px solid #dfb76c;
                  color: #dfb76c;
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'Google Sans', sans-serif;
                  cursor: pointer;
                  transition: all 0.2s;
                  text-shadow: 0 0 6px rgba(223, 183, 108, 0.4);">
                เปิด
              </button>
              <button
                id="fxaaToggleOff"
                data-i18n="off"
                class="game-ui" style="flex: 1;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: rgba(255, 255, 255, 0.6);
                  padding: 6px 0;
                  font-size: 11px;
                  font-family: 'Google Sans', sans-serif;
                  cursor: pointer;
                  transition: all 0.2s;">
                ปิด
              </button>
            </div>
          </div>


          <!-- ตั้งค่าปุ่มควบคุม (Key / Gamepad Bindings) -->
          <div
            style="
              display: flex;
              flex-direction: column;
              gap: 8px;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              padding-top: 12px;
            "
          >
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span
                id="keyBindingsHeaderLabel"
                data-i18n="key_bindings"
                style="
                  font-size: 13px;
                  font-family: 'Google Sans', sans-serif;
                  color: #dfb76c;
                  font-weight: bold;
                "
              >ตั้งค่าปุ่มควบคุม</span>
              <div style="display: flex; gap: 4px;">
                <button
                  id="btnBindingModeKb"
                  class="game-ui"
                  style="background: rgba(223, 183, 108, 0.18); border: 1px solid #dfb76c; color: #dfb76c; padding: 2px 8px; font-size: 10px; font-family: 'Google Sans', sans-serif; cursor: pointer; border-radius: 0px; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px;"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; flex-shrink: 0;">
                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                    <line x1="6" y1="8" x2="6.01" y2="8"></line>
                    <line x1="10" y1="8" x2="10.01" y2="8"></line>
                    <line x1="14" y1="8" x2="14.01" y2="8"></line>
                    <line x1="18" y1="8" x2="18.01" y2="8"></line>
                    <line x1="6" y1="12" x2="6.01" y2="12"></line>
                    <line x1="10" y1="12" x2="10.01" y2="12"></line>
                    <line x1="14" y1="12" x2="14.01" y2="12"></line>
                    <line x1="18" y1="12" x2="18.01" y2="12"></line>
                    <line x1="7" y1="16" x2="17" y2="16"></line>
                  </svg>
                  <span>คีย์บอร์ด</span>
                </button>
                <button
                  id="btnBindingModeGp"
                  class="game-ui"
                  style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.6); padding: 2px 8px; font-size: 10px; font-family: 'Google Sans', sans-serif; cursor: pointer; border-radius: 0px; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px;"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; flex-shrink: 0;">
                    <line x1="6" y1="12" x2="10" y2="12"></line>
                    <line x1="8" y1="10" x2="8" y2="14"></line>
                    <line x1="15" y1="13" x2="15.01" y2="13"></line>
                    <line x1="18" y1="11" x2="18.01" y2="11"></line>
                    <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                  </svg>
                  <span>จอยสติ๊ก</span>
                </button>
              </div>
            </div>
            <div
              style="display: grid; grid-template-columns: 1fr; gap: 6px"
              id="keyBindingsContainer"
            >
              <!-- ถูกสร้างด้วย JS -->
            </div>
          </div>

          <!-- คืนค่า การตั้งค่า (Restore Defaults) -->
          <div
            style="
              display: flex;
              flex-direction: column;
              gap: 6px;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              padding-top: 12px;
              margin-top: 4px;
            "
          >
            <button
              id="btnRestoreDefaults"
              data-i18n="restore_defaults"
              onmouseover="this.style.background = 'rgba(239, 68, 68, 0.25)'"
              onmouseout="this.style.background = 'rgba(239, 68, 68, 0.1)'"
             class="game-ui" style="width: 100%;
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid rgba(239, 68, 68, 0.4);
                color: #fca5a5;
                padding: 10px 0;
                font-size: 11px;
                font-family: 'Google Sans', sans-serif;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: bold;">
              คืนค่าเริ่มต้น
            </button>
            <button
              id="btnExitToMenu"
              data-i18n="main_menu"
              onmouseover="this.style.background = 'rgba(223, 183, 108, 0.25)'"
              onmouseout="this.style.background = 'rgba(223, 183, 108, 0.1)'"
             class="game-ui" style="width: 100%;
                background: rgba(223, 183, 108, 0.1);
                border: 1px solid rgba(223, 183, 108, 0.4);
                color: #dfb76c;
                padding: 10px 0;
                font-size: 11px;
                font-family: 'Google Sans', sans-serif;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: bold;">
              กลับไปหน้าเริ่มเกม
            </button>
          </div>
        </div>

        <!-- Custom Sci-Fi DOM Virtual Scrollbar -->
        <div id="panelCustomScrollbar" class="custom-scrollbar-track game-ui clickable">
          <div id="panelCustomScrollbarThumb" class="custom-scrollbar-thumb game-ui clickable"></div>
        </div>
      </div>
    </div>

    <!-- หน้าต่างกล่องไม้ (Wooden Chest Overlay) -->
    <div class="inventory-overlay" id="chestOverlay">
      <div class="inventory-panel game-ui">
        <!-- Left Column: Chest Storage -->
        <div style="display: flex; flex-direction: column; width: 392px; flex-shrink: 0;">
          <!-- Chest Header -->
          <div class="inventory-header">
            <div class="inventory-tabs">
              <h2 class="active">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                  <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                <span data-i18n="chest_storage">CHEST STORAGE</span>
              </h2>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 100%;">
              <button id="chestTakeAllBtn" data-i18n="chest_take_all" class="game-ui" style="height: 32px; padding: 0 12px; font-size: 11px; font-weight: bold; background: rgba(0, 0, 0, 0.85); border: 1px solid rgba(223, 183, 108, 0.35); color: #dfb76c; cursor: pointer; transition: all 0.2s; display: flex; align-items: center;">
                Take All
              </button>
            </div>
          </div>

          <!-- Chest Grid -->
          <div class="inventory-grid" id="chestGrid">
            <!-- สร้างช่องเก็บของในกล่อง 20 ช่องผ่าน JavaScript -->
          </div>
        </div>

        <!-- Right Column: Player Inventory -->
        <div style="display: flex; flex-direction: column; width: 392px; flex-shrink: 0; border-left: 1px solid rgba(255, 255, 255, 0.06); padding-left: 28px; position: relative;">
          <!-- Player Inventory Header in Chest UI -->
          <div class="inventory-header">
            <div class="inventory-tabs">
              <h2 class="active">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                  <path d="M4 20V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                  <rect x="9" y="10" width="6" height="5" rx="1"/>
                </svg>
                <span data-i18n="your_inventory">YOUR INVENTORY</span>
              </h2>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 100%;">
              <button class="close-btn game-ui" id="chestClose">✕</button>
            </div>
          </div>

          <!-- Player Inventory Grid in Chest UI -->
          <div class="inventory-grid" id="chestPlayerInventoryGrid">
            <!-- สร้างช่องเก็บของกระเป๋าเดินทางในหน้านี้ผ่าน JavaScript -->
          </div>
        </div>
      </div>
    </div>

    <!-- หน้าต่างวาร์ป (Warp UI Overlay - ใช้โครงสร้าง UI ชุดเดียวกับกระเป๋าและกล่อง) -->
    <div class="inventory-overlay" id="warpOverlay">
      <div class="inventory-panel game-ui" style="width: 448px; max-width: 95vw;">
        <div style="display: flex; flex-direction: column; width: 100%; flex-shrink: 0;">
          <!-- Warp UI Header -->
          <div class="inventory-header">
            <div class="inventory-tabs">
              <h2 class="active">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                </svg>
                <span data-i18n="warp_ui_title">Obsidian Flux</span>
              </h2>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; height: 100%;">
              <button class="close-btn game-ui" id="warpClose">✕</button>
            </div>
          </div>

          <!-- Warp Pad Grid (แสดง Obsidian Pad ตามลำดับที่มีการวาง) -->
          <div class="inventory-grid" id="warpGrid">
            <!-- สร้างช่องเลือกแท่นวาร์ป Obsidian Pad 20 ช่องผ่าน JavaScript -->
          </div>
        </div>
      </div>
    </div>

    <div
      id="interactPrompt"
      
     class="game-ui" style="position: fixed; left: 0; top: 0; will-change: transform;
        background: rgba(10, 10, 15, 0.85);
        color: #dfb76c;
        padding: 6px 14px;
        font-family: 'Google Sans', sans-serif;
        font-weight: bold;
        font-size: 11px;
        letter-spacing: 1px;
        text-transform: uppercase;
        border: 1px solid rgba(223, 183, 108, 0.35);
        backdrop-filter: blur(8px);
        display: none;
        pointer-events: none;
        z-index: 100;
        transform: translate(-50%, -100%);
        
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);">
      [E]
    </div>

    <button
      id="npcKillPrompt"
      style="
        position: fixed; left: 0; top: 0; will-change: transform;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 12px;
        border-radius: 8px;
        font-weight: bold;
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: none;
        cursor: pointer;
        z-index: 101;
        transform: translate(-50%, -100%);
        font-family: 'Google Sans', sans-serif;
        pointer-events: auto;
        transition:
          background 0.2s,
          transform 0.1s;
      "
      onmouseover="
        this.style.background = 'rgba(220, 50, 50, 0.9)';
        this.style.borderColor = 'rgba(255,100,100,0.5)';
        this.style.color = 'white';
      "
      onmouseout="
        this.style.background = 'rgba(0,0,0,0.8)';
        this.style.borderColor = 'rgba(255,255,255,0.2)';
        this.style.color = 'white';
      "
    >
      <span style="display: inline-flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
          <path d="M9 10h.01M15 10h.01" />
          <path d="M12 2a8 8 0 0 0-8 8v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3a8 8 0 0 0-8-8z" />
          <path d="M10 17v3M14 17v3" />
        </svg>
        <span data-i18n="kill_npc">กำจัด NPC</span>
      </span>
    </button>

    <button id="toggleControlsBtn"
      style="
        position: fixed;
        top: 0;
        right: 0;
        z-index: 20;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5); display: none;
      "
    >
      ⚙️ ซ่อนเมนู
    </button>

    <div id="bowCrosshair" style="display: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; border: 1.5px solid white; pointer-events: none; z-index: 1000; box-shadow: 0 0 2px rgba(0,0,0,0.5);"></div>
    <div id="targetCircle" style="display: none; position: absolute; left: 0; top: 0; will-change: transform; width: 22px; height: 22px; border: 1.5px solid white; border-radius: 50%; pointer-events: none; z-index: 999; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.6);"></div>

    <div class="controls" id="mainControls" style="top: 45px; display: none;">
      <div class="control-group">
        <button class="btn-toggle" id="distanceToggle">ระยะทาง: ปิด</button>
      </div>
      <div class="control-group">
        <div id="distanceInfo" style="display: none; color: #fff; font-family: 'Google Sans', sans-serif; font-size: 12px; margin-top: 5px;"></div>
      </div>
      <div class="control-group">
        <label>📐 ขนาดดาว (Grid)</label>
        <input
          type="range"
          id="sizeInput"
          min="25"
          max="3200"
          step="25"
          value="400"
        />
        <div class="value-display" id="sizeDisplay">400 x 400</div>
        <div class="warning">⚠️ ขนาดใหญ่ (500+) อาจช้า</div>
      </div>

      <div class="control-group">
        <label>🌍 รัศมีดาว (Planet Radius)</label>
        <div style="display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap;">
          <button class="btn-radius-preset" data-radius="8" style="flex: 1; padding: 4px 2px; font-size: 11px; background: rgba(0,0,0,0.6); border: 1px solid rgba(223,183,108,0.3); color: #dfb76c; cursor: pointer; transition: all 0.2s;">8 (มาตรฐาน)</button>
          <button class="btn-radius-preset" data-radius="32" style="flex: 1; padding: 4px 2px; font-size: 11px; background: rgba(0,0,0,0.6); border: 1px solid rgba(223,183,108,0.3); color: #dfb76c; cursor: pointer; transition: all 0.2s;">32</button>
          <button class="btn-radius-preset" data-radius="64" style="flex: 1; padding: 4px 2px; font-size: 11px; background: rgba(0,0,0,0.6); border: 1px solid rgba(223,183,108,0.3); color: #dfb76c; cursor: pointer; transition: all 0.2s;">64</button>
          <button class="btn-radius-preset" data-radius="96" style="flex: 1; padding: 4px 2px; font-size: 11px; background: rgba(0,0,0,0.6); border: 1px solid rgba(223,183,108,0.3); color: #dfb76c; cursor: pointer; transition: all 0.2s;">96</button>
          <button class="btn-radius-preset" data-radius="128" style="flex: 1; padding: 4px 2px; font-size: 11px; background: rgba(0,0,0,0.6); border: 1px solid rgba(223,183,108,0.3); color: #dfb76c; cursor: pointer; transition: all 0.2s;">128</button>
          <button class="btn-radius-preset" data-radius="160" style="flex: 1; padding: 4px 2px; font-size: 11px; background: rgba(0,0,0,0.6); border: 1px solid rgba(223,183,108,0.3); color: #dfb76c; cursor: pointer; transition: all 0.2s;">160</button>
        </div>
        <input
          type="range"
          id="radiusInput"
          min="8.0"
          max="160.0"
          step="1.0"
          value="32.0"
        />
        <div class="value-display" id="radiusDisplay">32.00</div>
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="waterToggle">
            🌊 น้ำ เปิด
          </button>
        </div>
        <label>📏 ระดับน้ำ <span id="waterLevelLabel">0.00</span></label>
        <input type="range" id="waterLevel" min="-50" max="50" value="0" />
        <label>💧 ความใส <span id="waterOpacityLabel">0.40</span></label>
        <input type="range" id="waterOpacity" min="5" max="80" value="40" />
        <label>🌊 ความแรงคลื่น <span id="waveStrengthLabel">0.020</span></label>
        <input type="range" id="waveStrength" min="1" max="100" value="2" />
        <label>🎨 สีน้ำ</label>
        <input
          type="color"
          id="waterColor"
          value="#0066aa"
          style="
            width: 100%;
            padding: 2px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            cursor: pointer;
          "
        />
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="atmosphereToggle">
            ✨ บรรยากาศ เปิด
          </button>
        </div>
        <label>📏 ความเข้ม <span id="atmosphereAlphaLabel">0.60</span></label>
        <input type="range" id="atmosphereAlpha" min="1" max="100" value="60" />
        <label
          >🚀 ระยะห่างบรรยากาศ
          <span id="atmosphereScaleLabel">2.50</span></label
        >
        <input
          type="range"
          id="atmosphereScale"
          min="101"
          max="250"
          value="250"
        />
        <label>🎨 สีชั้นบรรยากาศ</label>
        <input
          type="color"
          id="atmosphereColor"
          value="#4d94ff"
          style="
            width: 100%;
            padding: 2px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            cursor: pointer;
          "
        />
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="skyToggle">
            🌌 ท้องฟ้าอวกาศ เปิด
          </button>
        </div>
        <label
          >✨ ความหนาแน่นก๊าซเนบิวลา
          <span id="skyGasIntensityLabel">0.75</span></label
        >
        <input type="range" id="skyGasIntensity" min="1" max="150" value="75" />
      </div>

      <div class="control-group">
        <div class="control-row">
          <button class="btn-toggle active" id="cloudsToggle">
            ☁️ เมฆกลุ่มก๊าซ เปิด
          </button>
        </div>
        <label>📏 ความเข้มเมฆ <span id="cloudsAlphaLabel">0.55</span></label>
        <input type="range" id="cloudsAlpha" min="1" max="100" value="55" />
        <label
          >🚀 ระยะห่างเมฆจากผิวดาว
          <span id="cloudsHeightLabel">12.00</span></label
        >
        <input type="range" id="cloudsHeight" min="50" max="3000" value="1200" />
        <label
          >☁️ ความหนาของชั้นเมฆ
          <span id="cloudsThicknessLabel">0.93</span></label
        >
        <input
          type="range"
          id="cloudsThickness"
          min="10"
          max="250"
          value="93"
        />
        <label>💨 ความเร็วเมฆ <span id="cloudsSpeedLabel">0.20</span></label>
        <input type="range" id="cloudsSpeed" min="1" max="500" value="20" />
        <label>☁️ รูปร่างเมฆ <span id="cloudsShapeLabel">1.00</span></label>
        <input type="range" id="cloudsShape" min="10" max="300" value="100" />
        <label>🎨 สีของเมฆแก๊ส</label>
        <input
          type="color"
          id="cloudsColor"
          value="#ffffff"
          style="
            width: 100%;
            padding: 2px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            cursor: pointer;
          "
        />
      </div>

      <div class="control-group">
        <label>👤 มุมมองกล้องสปริงอาร์ม (Camera Mode)</label>
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px; margin-bottom: 8px;">
          <button class="btn-random" id="btnCameraModeTPS" style="background-image: linear-gradient(135deg, #2e7d32, #4caf50); margin: 0; padding: 4px; font-size: 11px; text-align: left;">🎥 TPS (มุมมองข้างไหล่)</button>
          <button class="btn-random" id="btnCameraModeThirdPerson" style="background-image: linear-gradient(135deg, #2e7d32, #4caf50); margin: 0; padding: 4px; font-size: 11px; text-align: left;">🎥 มุมมองที่ 3 (ตรงกลาง)</button>
          <button class="btn-random" id="btnCameraModeFPS" style="background-image: linear-gradient(135deg, #2e7d32, #4caf50); margin: 0; padding: 4px; font-size: 11px; text-align: left;">🎥 FPS (บุคคลที่ 1)</button>
        </div>
        <button
          class="btn-toggle active"
          id="cameraCollisionToggle"
          style="margin-bottom: 8px"
        >
          🛡️ ระบบกันกล้องชนวัตถุ: เปิด
        </button>
        <button
          class="btn-toggle active"
          id="zoomLimitToggle"
          style="margin-bottom: 8px"
        >
          🔍 จำกัดระยะซูมออก: เปิด
        </button>
        <button
          class="btn-toggle"
          id="ragdollToggle"
          style="margin-bottom: 8px"
        >
          🦴 โหมด Ragdoll: ปิด
        </button>
        <button class="btn-toggle" id="npcSummonBtn" style="margin-bottom: 8px">
          🦕 เรียก NPC มาหา
        </button>

        <label>🏃 ความเร็วเดิน <span id="charSpeedLabel">0.005</span></label>
        <input
          type="range"
          id="charSpeed"
          min="5"
          max="150"
          value="5"
          style="margin-bottom: 8px"
        />

        <label>📏 ขนาดตัวละคร <span id="charScaleLabel">0.10</span></label>
        <input type="range" id="charScale" min="5" max="70" value="10" />

        <p
          style="
            color: #aaa;
            font-size: 11px;
            margin-top: 8px;
            line-height: 1.3;
            text-align: center;
          "
        >
          เดิน: WASD / จอยสติ๊กลาก<br />Alt: ล็อกเมาส์ & หมุนกล้องเสรี<br />ดำน้ำ:
          Z (กดค้าง) / ขึ้นเหนือน้ำ: Shift หรือ Space (กดค้าง)
        </p>
      </div>

      <div class="control-group">
        <label>🍃 อนิเมชั่นต้นไม้ (Wind Sway)</label>
        <label>💨 ความแรงลม <span id="leafSwayLabel">1.0</span></label>
        <input type="range" id="leafSway" min="1" max="500" value="100" />
      </div>

      <div class="control-group">
        <label>🐠 อนิเมชั่นพืชใต้น้ำ (Water Sway)</label>
        <label>🌊 ความแรงกระแสน้ำ <span id="waterSwayLabel">1.0</span></label>
        <input type="range" id="waterSway" min="1" max="500" value="100" />
      </div>

      <div class="control-group">
        <label>👁️ ระยะการมองเห็น (Render Distance)</label>
        <button
          class="btn-toggle active"
          id="renderDistToggle"
          style="margin-bottom: 8px"
        >
          🛡️ จำกัดระยะเรนเดอร์: เปิด
        </button>
        <label>🌍 1. ระยะเรนเดอร์พื้น (Terrain Distance) <span id="terrainRenderDistLabel">15.00</span></label>
        <input type="range" id="terrainRenderDist" min="5" max="300" value="150" />

        <label style="margin-top: 8px; display: block;">🌲 2. ระยะเรนเดอร์วัตถุทุกชนิด (Objects Distance - ต้นไม้, หญ้า, หิน, NPC ฯลฯ) <span id="objectRenderDistLabel">5.00</span></label>
        <input type="range" id="objectRenderDist" min="5" max="200" value="50" />
      </div>

      <div class="control-group">
        <label>⚡ จำกัดอัตราเฟรมอนิเมชั่น (Animation FPS)</label>
        <label
          >👤 ตัวละคร (Character) <span id="charFpsLabel">30 FPS</span></label
        >
        <input type="range" id="charFps" min="1" max="120" value="30" />

        <label
          >🌊 น้ำ (Water Waves) <span id="waterFpsLabel">30 FPS</span></label
        >
        <input type="range" id="waterFps" min="1" max="120" value="30" />

        <label
          >🍃 ใบไม้ (Wind Sway) <span id="leafFpsLabel">30 FPS</span></label
        >
        <input type="range" id="leafFps" min="1" max="120" value="30" />

        <label
          >☁️ เมฆ (Clouds & Sky) <span id="cloudFpsLabel">30 FPS</span></label
        >
        <input type="range" id="cloudFps" min="1" max="120" value="30" />
      </div>

      <div class="control-group">
        <label
          >👣 เสียงเดินตัวละคร (Player Footsteps)
          <span id="playerFootstepVolumeVal">0%</span></label
        >
        <input
          type="range"
          id="playerFootstepVolumeSlider"
          min="1"
          max="100"
          value="0"
        />

        <label
          >🏊 เสียงว่ายน้ำตัวละคร (Player Swim)
          <span id="playerSwimVolumeVal">9%</span></label
        >
        <input
          type="range"
          id="playerSwimVolumeSlider"
          min="1"
          max="100"
          value="9"
        />

        <label
          >✨ เสียงเก็บของ (Collect Item)
          <span id="collectSfxVolumeVal">20%</span></label
        >
        <input
          type="range"
          id="collectSfxVolumeSlider"
          min="1"
          max="100"
          value="20"
        />

        <label
          >🔈 ระดับเสียง NPC (NPC Volume)
          <span id="npcSfxVolumeVal">50%</span></label
        >
        <input
          type="range"
          id="npcSfxVolumeSlider"
          min="1"
          max="100"
          value="50"
        />
      </div>

      <div class="control-group">
        <button class="btn-random" id="randomBtn">🎲 สุ่มภูมิประเทศใหม่</button>
        <button class="btn-random" id="randomCubesBtn" style="margin-top: 6px">
          📦 สุ่มวัตถุ (50 ชิ้น)
        </button>
        <button
          class="btn-random"
          id="randomNatureBtn"
          style="
            margin-top: 6px;
            background-image: linear-gradient(135deg, #1b5e20, #4caf50);
          "
        >
          🌲 สุ่มวัตถุธรรมชาติ (ต้นไม้, หิน & พืชใต้น้ำ)
        </button>
        <button
          class="btn-toggle active"
          id="devGrassToggle"
          style="
            margin-top: 6px;
            background-image: linear-gradient(135deg, #2e7d32, #43a047);
          "
        >
          🌿 หญ้า: เปิด
        </button>
        <label style="margin-top: 6px;">🌿 ความหนาแน่นหญ้า <span id="devGrassDensityLabel">100%</span></label>
        <input type="range" id="devGrassDensity" min="10" max="250" step="10" value="100" />
      </div>

      <div class="control-group">
        <label>🛠️ เครื่องมือพัฒนา (Dev Tools)</label>
        <button class="btn-toggle" id="devInputModeToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #6a1b9a, #8e24aa);">
          🎮 โหมดอินพุต: อัตโนมัติ (Auto)
        </button>
        <button class="btn-toggle" id="screenModeVisibilityToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #0277bd, #039be5);">
          🖥️ โหมดแสดงผล (Screen Mode): แสดง
        </button>
        <button class="btn-toggle" id="hitboxToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #d32f2f, #f44336);">
          🟥 แสดงโครงสร้างการชน (Show Hitboxes) ปิด
        </button>
        <button class="btn-toggle active" id="frustumCullingToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #2e7d32, #4caf50);">
          👁️ Frustum Culling (คัดออกวัตถุนอกจอ) เปิด
        </button>
        <button class="btn-toggle active" id="caveWaterToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #00acc1, #00838f);">
          💧 น้ำในถ้ำ (Cave Water) เปิด
        </button>
        <label style="margin-top: 10px;">📏 ระยะคำนวณการชน <span id="colliderDistLabel">20.00</span></label>
        <input type="range" id="colliderDist" min="5" max="100" value="20" />
        <label style="margin-top: 10px;">🔲 ระยะขอบ UI (UI Margin) <span id="uiMarginLabel">0</span>px</label>
        <input type="range" id="uiMarginDist" min="0" max="100" value="10" />
        <label style="margin-top: 10px;">📏 ระยะทำการ (Action Reach) <span id="actionReachLabel">0.15</span></label>
        <input type="range" id="actionReachDist" min="0.1" max="10" step="0.05" value="0.15" />
        <button class="btn-toggle active" id="actionReachToggle" style="margin-top: 6px; background-image: linear-gradient(135deg, #0288d1, #03a9f4);">
          ⚪ แสดงวงระยะทำการ (Show Action Reach) เปิด
        </button>
        <label style="margin-top: 10px;">🎯 รูปแบบระยะทำการ (Action Reach Mode)</label>
        <select id="actionReachModeSelect" style="margin-top: 4px; padding: 6px; border-radius: 4px; background: #1a1a1a; color: white; border: 1px solid #444; width: 100%;">
          <option value="1">Line (แบบเส้น)</option>
          <option value="2">Circle (แบบวง)</option>
          <option value="3" selected>Capsule (แบบแคปซูล)</option>
        </select>
        <label style="margin-top: 10px;">🪵 ความสูงพื้นไม้ (Wood Floor Height) <span id="woodFloorHeightLabel">0.05</span></label>
        <input type="range" id="woodFloorHeightSlider" min="0.0" max="5.0" step="0.05" value="0.05" />
        <label style="margin-top: 10px;">������ ขนาดกองไฟ (Campfire Size) <span id="campfireSizeLabel">0.25</span></label>
        <input type="range" id="campfireSizeSlider" min="0.1" max="5.0" step="0.05" value="0.25" />
        <label style="margin-top: 10px;">🕳️ ขนาดหลุมสร้างอุโมงค์ (Voxel Hole Multiplier) <span id="voxelHoleRadiusLabel">2.0</span>x</label>
        <input type="range" id="voxelHoleRadiusSlider" min="0.2" max="5.0" step="0.1" value="2.0" />
        <label style="margin-top: 10px;">🔍 ระยะซูมกล้อง (Camera Zoom) <span id="devCameraZoomLabel">3.5</span></label>
        <input type="range" id="devCameraZoomSlider" min="3.5" max="15.0" step="0.1" value="3.5" />
      </div>

      <div class="control-group">
        <label>🎯 <b>ตั้งค่าธนู (Bow Settings)</b></label>
        <label style="margin-top: 5px;">⏱️ เวลายกแขนค้าง (วินาที) <span id="bowHoldArmLabel">3.3</span></label>
        <input type="range" id="bowHoldArmSlider" min="0.5" max="10.0" step="0.1" value="3.3" />
        
        <label style="margin-top: 5px;">⚡ ดีเลย์ Spam Click (วินาที) <span id="bowSpamClickDelayLabel">0.5</span></label>
        <input type="range" id="bowSpamClickDelaySlider" min="0.0" max="3.0" step="0.1" value="0.5" />
        
        <label style="margin-top: 5px;">🎯 ระยะเล็งล็อกเป้า (เมตร/หน่วย) <span id="bowLockDistanceLabel">3.0</span></label>
        <input type="range" id="bowLockDistanceSlider" min="2.0" max="20.0" step="0.5" value="3.0" />
      </div>

      <div class="control-group" id="devSpawnItemContainer">
        <label>🧪 เสกของเข้ากระเป๋า (Spawn Items)</label>
        <div id="devSpawnItemList" style="
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 6px;
          max-height: 200px;
          overflow-y: auto;
          padding-right: 4px;
        ">
        </div>
      </div>
      <div class="control-group" id="devDigTerrainContainer" style="margin-top: 8px;">
        <label>🛠️ ระบบขุด/ถมพื้นดาว (Terrain Mod)</label>
        <div style="display: flex; gap: 4px; margin-top: 6px;">
          <button class="btn-random" id="devDigTerrainBtn" style="background-image: linear-gradient(135deg, #e53935, #ef5350); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            ⛏️ ขุดหลุม
          </button>
          <button class="btn-random" id="devRaiseTerrainBtn" style="background-image: linear-gradient(135deg, #43a047, #66bb6a); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            ⛰️ ถมดิน
          </button>
        </div>
      </div>
      
      <div class="control-group" id="devRenderDistContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <label>👁️ ปรับระยะเรนเดอร์ 2 ระยะ (Render Distance)</label>
        <label style="margin-top: 4px; display: block;">🌍 1. ระยะเรนเดอร์พื้น <span id="devTerrainRenderDistLabel">15.00</span></label>
        <input type="range" id="devTerrainRenderDistSlider" min="5" max="300" value="150" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 6px; display: block;">🌲 2. ระยะเรนเดอร์วัตถุทุกชนิด <span id="devObjectRenderDistLabel">5.00</span></label>
        <input type="range" id="devObjectRenderDistSlider" min="5" max="200" value="50" style="width: 100%; margin-top: 2px;" />
      </div>

            <div class="control-group" id="devCharModelContainer" style="margin-top: 8px;">
        <label>👤 โมเดลตัวละคร (Character Model)</label>
        <div style="display: flex; gap: 4px; margin-top: 6px;">
          <button class="btn-random" id="devCharModelClassicBtn" style="background-image: linear-gradient(135deg, #0288d1, #29b6f6); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            🧑 Classic (Base)
          </button>
          <button class="btn-random" id="devCharModelChibiBtn" style="background-image: linear-gradient(135deg, #43a047, #66bb6a); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            ✨ Chibi White (GLB)
          </button>
        </div>

        <div id="devAnimContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px; display: none;">
        <label>🎬 อนิเมชั่น (Animation Override)</label>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
          <div id="devAnimList" style="display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; padding-right: 4px;">
            <button class="dev-anim-btn" data-anim="Auto" style="width:100%; text-align:left; padding: 4px 6px; font-size: 11px; border-radius: 4px; border: 1px solid #3ba5e9; background: #2384c3; color: white; cursor: pointer;">🤖 Auto (ตามการเดิน/วิ่ง)</button>
            <div id="devAnimListLoader" style="color: #ccc; font-size: 11px; padding: 4px;">กำลังโหลดข้อมูลอนิเมชั่น...</div>
          </div>
          
          <!-- Animation Controls -->
          <div id="devAnimControls" style="display: none; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span id="devAnimTimeLabel" style="font-size: 10px; color: #aaa;">0.00s / 0.00s</span>
              <button id="devAnimPlayBtn" class="btn-random" style="margin: 0; padding: 2px 8px; font-size: 10px; min-width: 50px;">⏸️ Pause</button>
            </div>
            
            <input type="range" id="devAnimScrubSlider" min="0" max="1000" value="0" style="width: 100%; accent-color: #3ba5e9;" title="Scrub Time">
            
            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
              <div style="display: flex; align-items: center; gap: 4px;">
                <label style="font-size: 9px; width: 30px; color: #4CAF50;">Start:</label>
                <input type="range" id="devAnimStartSlider" min="0" max="1000" value="0" style="flex: 1; accent-color: #4CAF50;">
                <input type="number" id="devAnimStartInput" step="0.01" value="0" style="width: 40px; background: rgba(0,0,0,0.5); border: 1px solid #555; color: white; font-size: 9px; padding: 2px;">
              </div>
              <div style="display: flex; align-items: center; gap: 4px;">
                <label style="font-size: 9px; width: 30px; color: #F44336;">End:</label>
                <input type="range" id="devAnimEndSlider" min="0" max="1000" value="1000" style="flex: 1; accent-color: #F44336;">
                <input type="number" id="devAnimEndInput" step="0.01" value="0" style="width: 40px; background: rgba(0,0,0,0.5); border: 1px solid #555; color: white; font-size: 9px; padding: 2px;">
              </div>
            </div>
          </div>

          <!-- Layered Animation Mixer (Upper / Lower Body) -->
          <div id="devAnimMixerContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="font-size: 11px; color: #ffca28; font-weight: bold;">🎭 โหมดผสมอนิเมชั่น (Upper/Lower Mix)</label>
              <button id="devAnimMixToggleBtn" class="btn-random" style="margin: 0; padding: 2px 8px; font-size: 10px; background: #333; border: 1px solid #555;">
                โหมดผสม: OFF
              </button>
            </div>
            <div id="devAnimMixControls" style="display: none; flex-direction: column; gap: 5px; margin-top: 6px; background: rgba(0,0,0,0.25); padding: 6px; border-radius: 4px;">
              <div>
                <label style="font-size: 10px; color: #4fc3f7;">🦵 ส่วนล่าง (Lower Body - ขา & การเดิน):</label>
                <select id="devAnimMixLowerSelect" style="width: 100%; background: #222; color: white; border: 1px solid #555; padding: 3px; font-size: 10px; border-radius: 3px; margin-top: 2px;">
                  <option value="Walking">Walking (เดิน)</option>
                  <option value="Running">Running (วิ่ง)</option>
                  <option value="01a090e9-3d6d-7643-a07b-75e0e18cdc29">Idle (ยืนพัก)</option>
                  <option value="Jump_with_Arms_Open">Jump (กระโดด)</option>
                  <option value="01a090f9-e47a-7144-abc9-bc9fcc7af00e">Riding (นั่งขี่เรือ)</option>
                  <option value="restpose">Rest Pose</option>
                </select>
              </div>
              <div>
                <label style="font-size: 10px; color: #ffb74d;">💪 ส่วนบน (Upper Body - ลำตัว แขน หัว):</label>
                <select id="devAnimMixUpperSelect" style="width: 100%; background: #222; color: white; border: 1px solid #555; padding: 3px; font-size: 10px; border-radius: 3px; margin-top: 2px;">
                  <option value="01a090f8-8c8f-75dc-8693-155f9574dac7">Tool Swing / Use Item (ฟัน/ขุด/ใช้ไอเทม)</option>
                  <option value="Walking">Walking (แกว่งแขนเดิน)</option>
                  <option value="Running">Running (แกว่งแขนวิ่ง)</option>
                  <option value="01a090e9-3d6d-7643-a07b-75e0e18cdc29">Idle (ยืนพัก)</option>
                  <option value="Jump_with_Arms_Open">Jump (กางแขนกระโดด)</option>
                  <option value="restpose">Rest Pose</option>
                </select>
              </div>
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 10px;">
                  <span style="color: #bbb;">น้ำหนักส่วนบน (Upper Blend Weight):</span>
                  <span id="devAnimMixWeightLabel" style="color: #ffca28; font-weight: bold;">100%</span>
                </div>
                <input type="range" id="devAnimMixWeightSlider" min="0" max="100" value="100" style="width: 100%; accent-color: #ffca28; margin-top: 2px;">
              </div>
            </div>
          </div>
        </div>
        </div>

        <!-- GLB Skeleton Bones & Mesh Parts Inspector -->
        <div id="devSkeletonContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px; display: none;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <label style="color: #ffca28; font-weight: bold; font-size: 11px; margin: 0;">🦴 โครงกระดูก & ชิ้นส่วนโมเดล GLB</label>
            <span id="devBonesCountBadge" style="font-size: 10px; background: rgba(255,202,40,0.2); color: #ffca28; padding: 1px 6px; border-radius: 10px; border: 1px solid rgba(255,202,40,0.4);">28 Bones</span>
          </div>

          <!-- Toggles Bar -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px;">
            <button id="devToggleBonesBtn" class="btn-random" style="margin: 0; padding: 4px; font-size: 10px; background: #333; border: 1px solid #555;">
              🦴 โครงกระดูก: OFF
            </button>
            <button id="devToggleBoneLabelsBtn" class="btn-random" style="margin: 0; padding: 4px; font-size: 10px; background: #333; border: 1px solid #555;">
              🏷️ ป้ายชื่อกระดูก: OFF
            </button>
            <button id="devToggleColorByPartsBtn" class="btn-random" style="margin: 0; padding: 4px; font-size: 10px; background: #333; border: 1px solid #555;">
              🎨 แยกสีชิ้นส่วน: OFF
            </button>
            <button id="devToggleWireframeBtn" class="btn-random" style="margin: 0; padding: 4px; font-size: 10px; background: #333; border: 1px solid #555;">
              🕸️ ตาข่าย Wireframe: OFF
            </button>
          </div>

          <!-- Model Parts Visibility & Isolation -->
          <div style="margin-top: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <span style="font-size: 10px; color: #ffca28; font-weight: bold;">🧩 เปิด/ปิดชิ้นส่วนโมเดล (Part Visibility):</span>
              <button id="devResetPartsVisibilityBtn" style="background: none; border: none; color: #4fc3f7; font-size: 9px; cursor: pointer; text-decoration: underline;">เปิดทั้งหมด</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px;">
              <label style="display: flex; align-items: center; gap: 4px; color: #ff8a65; cursor: pointer;">
                <input type="checkbox" id="devPartHead" checked style="accent-color: #ff6e40;"> 👤 ศีรษะ (Head)
              </label>
              <label style="display: flex; align-items: center; gap: 4px; color: #4fc3f7; cursor: pointer;">
                <input type="checkbox" id="devPartTorso" checked style="accent-color: #00b0ff;"> 👕 ลำตัว (Torso)
              </label>
              <label style="display: flex; align-items: center; gap: 4px; color: #69f0ae; cursor: pointer;">
                <input type="checkbox" id="devPartLeftArm" checked style="accent-color: #00e676;"> 💪 แขนซ้าย (L-Arm)
              </label>
              <label style="display: flex; align-items: center; gap: 4px; color: #ffd54f; cursor: pointer;">
                <input type="checkbox" id="devPartRightArm" checked style="accent-color: #ffab00;"> 🦾 แขนขวา (R-Arm)
              </label>
              <label style="display: flex; align-items: center; gap: 4px; color: #ea80fc; cursor: pointer;">
                <input type="checkbox" id="devPartLeftLeg" checked style="accent-color: #d500f9;"> 🦵 ขาซ้าย (L-Leg)
              </label>
              <label style="display: flex; align-items: center; gap: 4px; color: #ff80ab; cursor: pointer;">
                <input type="checkbox" id="devPartRightLeg" checked style="accent-color: #f50057;"> 🦿 ขาขวา (R-Leg)
              </label>
              <label style="display: flex; align-items: center; gap: 4px; color: #f48fb1; cursor: pointer; grid-column: span 2;">
                <input type="checkbox" id="devPartHair" checked style="accent-color: #e040fb;"> 💇‍♀️ ผมรวบ (Ponytail Hair)
              </label>
            </div>

            <!-- Hair Physics Controls -->
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.15);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 10px; color: #ea80fc; font-weight: bold;">💇‍♀️ ฟิสิกส์ผมรวบ (Hair Spring Physics):</span>
              </div>
              <div style="display: flex; gap: 4px; margin-bottom: 6px;">
                <button id="devToggleHairPhysicsBtn" style="flex: 1; padding: 4px; font-size: 10px; border-radius: 4px; background: linear-gradient(135deg, #aa00ff, #ea80fc); border: 1px solid #e040fb; color: #fff; cursor: pointer; font-weight: bold;">
                  ✨ ฟิสิกส์ผม: ON
                </button>
                <button id="devTestHairJiggleBtn" style="flex: 1; padding: 4px; font-size: 10px; border-radius: 4px; background: #333; border: 1px solid #777; color: #ffeb3b; cursor: pointer; font-weight: bold;">
                  💫 สะบัดผมทดสอบ
                </button>
              </div>
              <div style="font-size: 9px; color: #ccc; display: flex; flex-direction: column; gap: 4px;">
                <div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>ความเด้ง/สปริง (Stiffness):</span>
                    <span id="devHairStiffnessVal" style="color: #ea80fc;">85</span>
                  </div>
                  <input type="range" id="devHairStiffnessSlider" min="20" max="250" value="85" style="width: 100%; height: 4px; accent-color: #ea80fc;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>แรงหนืดสปริง (Damping):</span>
                    <span id="devHairDampingVal" style="color: #ea80fc;">9</span>
                  </div>
                  <input type="range" id="devHairDampingSlider" min="2" max="30" value="9" style="width: 100%; height: 4px; accent-color: #ea80fc;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>แรงเฉื่อยการเคลื่อนไหว (Inertia):</span>
                    <span id="devHairInertiaVal" style="color: #ea80fc;">1.0</span>
                  </div>
                  <input type="range" id="devHairInertiaSlider" min="0" max="25" value="10" style="width: 100%; height: 4px; accent-color: #ea80fc;">
                </div>
              </div>
            </div>

            <!-- Hand & Finger Pose Controls (กำมือ, แบมือ, แยกนิ้ว) -->
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.15);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 10px; color: #ffca28; font-weight: bold;">🖐️ ปรับมือนิ้ว (Hand & Finger Poses):</span>
                <span id="devHandPoseTargetBadge" style="font-size: 9px; background: rgba(255,202,40,0.2); color: #ffca28; padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(255,202,40,0.4);">สองข้าง (Both)</span>
              </div>

              <!-- Quick Presets -->
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 3px; margin-bottom: 6px;">
                <button id="devHandPresetRelaxed" class="btn-random" style="margin: 0; padding: 3px 2px; font-size: 9px; background: #2e7d32; border: 1px solid #4caf50;" title="มือธรรมชาติ">
                  🌿 ผ่อนคลาย
                </button>
                <button id="devHandPresetFist" class="btn-random" style="margin: 0; padding: 3px 2px; font-size: 9px; background: #c62828; border: 1px solid #ef5350;" title="กำมือแน่น">
                  ✊ กำมือ
                </button>
                <button id="devHandPresetOpen" class="btn-random" style="margin: 0; padding: 3px 2px; font-size: 9px; background: #0277bd; border: 1px solid #29b6f6;" title="แบมือตรง">
                  ✋ แบมือ
                </button>
                <button id="devHandPresetSpread" class="btn-random" style="margin: 0; padding: 3px 2px; font-size: 9px; background: #6a1b9a; border: 1px solid #ab47bc;" title="กางแยกนิ้วกว้าง">
                  🖐️ กางแยก
                </button>
              </div>

              <!-- Target Hand Selector Buttons -->
              <div style="display: flex; gap: 3px; margin-bottom: 6px;">
                <button id="devHandTargetBothBtn" style="flex: 1; padding: 2px 4px; font-size: 9px; border-radius: 3px; background: #ffb300; color: #000; font-weight: bold; border: 1px solid #ffca28; cursor: pointer;">
                  👐 สองข้าง
                </button>
                <button id="devHandTargetRightBtn" style="flex: 1; padding: 2px 4px; font-size: 9px; border-radius: 3px; background: #333; color: #ccc; border: 1px solid #555; cursor: pointer;">
                  🦾 มือขวา
                </button>
                <button id="devHandTargetLeftBtn" style="flex: 1; padding: 2px 4px; font-size: 9px; border-radius: 3px; background: #333; color: #ccc; border: 1px solid #555; cursor: pointer;">
                  💪 มือซ้าย
                </button>
              </div>

              <!-- Detailed Sliders -->
              <div style="font-size: 9px; color: #ccc; display: flex; flex-direction: column; gap: 5px;">
                <div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>✊ กำมือ ↔ ✋ แบมือ (Curl):</span>
                    <span id="devHandCurlVal" style="color: #ffca28; font-weight: bold;">0% (ผ่อนคลาย)</span>
                  </div>
                  <input type="range" id="devHandCurlSlider" min="-50" max="100" value="0" style="width: 100%; height: 4px; accent-color: #ffca28;">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>🤏 หุบนิ้ว ↔ 🖐️ แยกนิ้ว (Spread):</span>
                    <span id="devHandSpreadVal" style="color: #4fc3f7; font-weight: bold;">0% (ปกติ)</span>
                  </div>
                  <input type="range" id="devHandSpreadSlider" min="-100" max="100" value="0" style="width: 100%; height: 4px; accent-color: #4fc3f7;">
                </div>
              </div>
            </div>
          </div>

          <!-- Selected Bone Inspector Card -->
          <div id="devSelectedBoneCard" style="display: none; margin-top: 6px; background: rgba(33, 150, 243, 0.15); border: 1px solid rgba(33, 150, 243, 0.4); border-radius: 4px; padding: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span id="devSelectedBoneName" style="font-size: 11px; font-weight: bold; color: #4fc3f7;">🦴 Bone Name</span>
              <button id="devClearSelectedBoneBtn" style="background: none; border: none; color: #ccc; font-size: 10px; cursor: pointer;">✕ ปิด</button>
            </div>
            <div id="devSelectedBoneDetails" style="font-size: 9px; color: #ddd; font-family: 'Google Sans', sans-serif; margin-top: 4px; line-height: 1.4;"></div>
          </div>

          <!-- Bone Hierarchy Tree Accordion -->
          <details id="devBoneTreeDetails" style="margin-top: 6px; background: rgba(0,0,0,0.25); border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);">
            <summary style="font-size: 10px; color: #ffca28; padding: 5px 8px; cursor: pointer; user-select: none;">
              🌳 ผังลำดับกระดูกทั้งหมด (Bone Tree Hierarchy)
            </summary>
            <div id="devBoneTreeList" style="max-height: 220px; overflow-y: auto; padding: 4px; font-size: 10px; font-family: 'Google Sans', sans-serif;">
              <!-- Populated dynamically -->
            </div>
          </details>
        </div>
      </div>
      <div class="control-group" id="devGenerationContainer" style="margin-top: 8px;">
        <label>🌍 ระบบสร้างดาว (Generation)</label>
        <div style="display: flex; gap: 4px; margin-top: 6px;">
          <button class="btn-random" id="devToggleNpcBtn" style="background-image: linear-gradient(135deg, #0288d1, #29b6f6); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            🤖 NPCs: ON
          </button>
          <button class="btn-random" id="devToggleEnvBtn" style="background-image: linear-gradient(135deg, #43a047, #66bb6a); flex: 1; margin: 0; padding: 0 4px; font-size: 11px;">
            🌲 Env: ON
          </button>
        </div>
      </div>

      <div class="control-group" id="devNpcTeleportContainer" style="margin-top: 8px;">
        <label>👀 ย้ายกล้องไปหา NPC</label>
        <div id="devNpcList" style="
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 6px;
          max-height: 200px;
          overflow-y: auto;
          padding-right: 4px;
        ">
        </div>
      </div>

      <div class="control-group" id="devClouds3DContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <label>☁️ ปรับระยะห่าง Clouds3D จากดาว <span id="devCloud3DDistanceLabel">12.00</span></label>
        <input type="range" id="devCloud3DDistanceSlider" min="50" max="3000" value="1200" style="width: 100%; margin-top: 4px;" />

        <label style="margin-top: 8px; display: block;">🌀 ความเร็วอนิเมชั่น Clouds3D <span id="devCloud3DAnimSpeedLabel">0.10</span>x</label>
        <input type="range" id="devCloud3DAnimSpeedSlider" min="0" max="500" value="10" style="width: 100%; margin-top: 4px;" />

        <label style="margin-top: 8px; display: block;">🌍 ความเร็วการเคลื่อนที่รอบดาว <span id="devCloud3DOrbitSpeedLabel">0.10</span>x</label>
        <input type="range" id="devCloud3DOrbitSpeedSlider" min="0" max="500" value="10" style="width: 100%; margin-top: 4px;" />
      </div>

      <div class="control-group" id="devMechSeatingContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <label>🤖 ปรับระยะที่นั่งตัวละครในหุ่น <span id="devMechSeatHeightLabel">0.71</span></label>
        <input type="range" id="devMechSeatHeightSlider" min="50" max="150" value="71" style="width: 100%; margin-top: 4px;" />
      </div>

      <div class="control-group" id="devMechCameraContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <label>📷 ปรับระยะกล้องขับหุ่น <span id="devMechCameraDistLabel">0.50</span></label>
        <input type="range" id="devMechCameraDistSlider" min="0" max="1500" value="50" style="width: 100%; margin-top: 4px;" />
      </div>

      <div class="control-group" id="devBoatCameraContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <label>⛵ ปรับระยะกล้องขับเรือ <span id="devBoatCameraDistLabel">0.37</span></label>
        <input type="range" id="devBoatCameraDistSlider" min="0" max="1500" value="37" style="width: 100%; margin-top: 4px;" />
      </div>

      <div class="control-group" id="devWheelAxleContainer" style="margin-top: 8px; border-top: 1px dashed rgba(223, 183, 108, 0.3); padding-top: 8px;">
        <div style="font-weight: bold; color: #dfb76c; margin-bottom: 4px;">🛞 ปรับล้อไม้ (Wooden Wheel)</div>
        <label>ขนาดย่อขยายล้อ (Scale) <span id="devWheelScaleLabel">0.56</span>x</label>
        <input type="range" id="devWheelScaleSlider" min="10" max="300" value="56" style="width: 100%; margin-top: 2px; margin-bottom: 10px;" />

        <div style="font-weight: bold; color: #dfb76c; margin-bottom: 4px;">🔋 ปรับเครื่องยนต์ไฟฟ้า (Electric Engine)</div>
        <label>ขนาดเครื่องยนต์ (Scale) <span id="devElectricEngineScaleLabel">0.36</span>x</label>
        <input type="range" id="devElectricEngineScaleSlider" min="10" max="300" value="36" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">ตำแหน่งหน้า-หลัง Forward <span id="devElectricEngineFwdOffsetLabel">-0.11</span></label>
        <input type="range" id="devElectricEngineFwdOffsetSlider" min="0" max="200" value="39" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">ตำแหน่งสูง-ต่ำ Up <span id="devElectricEngineUpOffsetLabel">0.05</span></label>
        <input type="range" id="devElectricEngineUpOffsetSlider" min="0" max="200" value="55" style="width: 100%; margin-top: 2px; margin-bottom: 10px;" />

        <label style="margin-top: 4px; display: block;">หมุนก้ม-เงย Pitch (X) <span id="devElectricEnginePitchLabel">0.00</span></label>
        <input type="range" id="devElectricEnginePitchSlider" min="-314" max="314" value="0" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">หมุนซ้าย-ขวา Yaw (Y) <span id="devElectricEngineYawLabel">1.57</span></label>
        <input type="range" id="devElectricEngineYawSlider" min="-314" max="314" value="157" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">หมุนเอียง Roll (Z) <span id="devElectricEngineRollLabel">0.00</span></label>
        <input type="range" id="devElectricEngineRollSlider" min="-314" max="314" value="0" style="width: 100%; margin-top: 2px; margin-bottom: 10px;" />

        <div style="font-weight: bold; color: #dfb76c; margin-bottom: 4px;">🛞 ปรับคู่ล้อหน้า (Front Pair)</div>
        <label>ยาวเพาล้อหน้า <span id="devWheelFrontAxleLengthLabel">0.28</span></label>
        <input type="range" id="devWheelFrontAxleLengthSlider" min="5" max="100" value="28" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">ระยะล้อหน้า ซ้าย-ขวา <span id="devWheelFrontSideOffsetLabel">0.14</span></label>
        <input type="range" id="devWheelFrontSideOffsetSlider" min="0" max="60" value="14" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">ตำแหน่งล้อหน้า Forward <span id="devWheelFrontFwdOffsetLabel">0.16</span></label>
        <input type="range" id="devWheelFrontFwdOffsetSlider" min="0" max="80" value="16" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">สูง-ต่ำล้อหน้า Up <span id="devWheelFrontUpOffsetLabel">0.01</span></label>
        <input type="range" id="devWheelFrontUpOffsetSlider" min="0" max="100" value="51" style="width: 100%; margin-top: 2px;" />

        <div style="font-weight: bold; color: #dfb76c; margin-top: 10px; margin-bottom: 4px;">🛞 ปรับคู่ล้อหลัง (Rear Pair)</div>
        <label>ยาวเพาล้อหลัง <span id="devWheelRearAxleLengthLabel">0.28</span></label>
        <input type="range" id="devWheelRearAxleLengthSlider" min="5" max="100" value="28" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">ระยะล้อหลัง ซ้าย-ขวา <span id="devWheelRearSideOffsetLabel">0.14</span></label>
        <input type="range" id="devWheelRearSideOffsetSlider" min="0" max="60" value="14" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">ตำแหน่งล้อหลัง Forward <span id="devWheelRearFwdOffsetLabel">0.16</span></label>
        <input type="range" id="devWheelRearFwdOffsetSlider" min="0" max="80" value="16" style="width: 100%; margin-top: 2px;" />

        <label style="margin-top: 4px; display: block;">สูง-ต่ำล้อหลัง Up <span id="devWheelRearUpOffsetLabel">0.01</span></label>
        <input type="range" id="devWheelRearUpOffsetSlider" min="0" max="100" value="51" style="width: 100%; margin-top: 2px;" />
      </div>
    </div>

    <div class="action-slots" id="actionSlots" style="display: none;">
      <div class="action-slots-normal">
        <div class="action-slots-title game-ui" id="actionSlotsNormalTitle">Action Slots</div>
        <div class="action-slot game-ui"></div>
        <div class="action-slot game-ui"></div>
        <div class="action-slot game-ui"></div>
        <div class="action-slot game-ui"></div>
      </div>
      
      <div class="action-slots-touch" id="actionSlotsTouch">
        <div class="action-slots-title game-ui" id="actionSlotsTitle">Slots Touch</div>
        <div class="touch-btn game-ui" id="btnTouchQ">
          <div class="touch-btn-icon" id="btnTouchQIcon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </div>
          <span class="touch-btn-key">Q</span>
          <span class="touch-btn-label">หมุน/Rotate</span>
        </div>
        <div class="touch-btn game-ui" id="btnTouchE">
          <div class="touch-btn-icon" id="btnTouchEIcon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 11V3a2 2 0 1 1 4 0v8h1a2 2 0 0 1 2 2v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2a2 2 0 0 1 2-2h1V7a2 2 0 1 1 4 0v4h2z"/>
            </svg>
          </div>
          <span class="touch-btn-key">E</span>
          <span class="touch-btn-label">เก็บ/คุย</span>
        </div>
        <div class="touch-btn game-ui" id="btnTouchRightClick">
          <div class="touch-btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <span class="touch-btn-key">R-Click</span>
          <span class="touch-btn-label">ขุด-ถม/ขวา</span>
        </div>
        <div class="touch-btn game-ui" id="btnTouchLeftClick">
          <div class="touch-btn-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline>
              <line x1="13" y1="19" x2="19" y2="13"></line>
              <line x1="16" y1="20" x2="20" y2="16"></line>
              <line x1="19" y1="21" x2="21" y2="19"></line>
            </svg>
          </div>
          <span class="touch-btn-key">L-Click</span>
          <span class="touch-btn-label">ตี-ใช้/ซ้าย</span>
        </div>
      </div>

      <!-- Player HP Minimalist Vertical -->
      <div class="player-hp-vertical-container game-ui" id="playerHpVerticalContainer">
        <!-- Dynamically populated -->
      </div>
    </div>

    <!-- Mech Stand System UI (8 horizontal slots in 2 rows, bottom-center) -->
    <div class="mech-stand-container" id="mechStandUI">
      <div class="mech-stand-header">
        <div class="mech-stand-title">
          <span>⚙️</span>
          <span data-i18n="robot_stand_title">ROBOT STAND SYSTEM</span>
        </div>
      </div>
      <div class="mech-stand-grid" id="mechStandGrid">
        <!-- 8 Slots generated dynamically -->
      </div>
    </div>`);

if (typeof autoFitMainScreenTitle === "function") {
  autoFitMainScreenTitle();
  requestAnimationFrame(autoFitMainScreenTitle);
  setTimeout(autoFitMainScreenTitle, 50);
  setTimeout(autoFitMainScreenTitle, 200);
}

var canvas = document.getElementById("mapCanvas");
window.canvas = canvas;

window.isConfirmOverlayOpen = false;

window.addEventListener("keydown", (e) => {
  if (window.isConfirmOverlayOpen || window.isWaitingForKey) {
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  }
}, true);

window.addEventListener("keyup", (e) => {
  if (window.isConfirmOverlayOpen || window.isWaitingForKey) {
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  }
}, true);

// === SEEDPLANET MODULE: JS/UI.JS ===

      // ============================================
      // FPS Counter & Lock at 120
      // ============================================
      let frameCount = 0;
      let lastFpsUpdate = 0;
      let currentFps = 0;
      
      
      let lastFrameTime = 0;
      let fpsDisplay = document.getElementById("fpsDisplay");

      // ============================================
      // Virtual Joystick Controller
      // ============================================
      let joystickX = 0;
      let joystickY = 0;
      let joystickActive = false;

      const joystickBase = document.getElementById("joystickBase");
      const joystickThumb = document.getElementById("joystickThumb");

      function getJoystickPosition(clientX, clientY) {
        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = rect.width / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;

        const deadZone = 8;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < deadZone) {
          return { x: 0, y: 0, dx: 0, dy: 0 };
        }

        const maxDist = radius - 25;
        let clampedDx = dx;
        let clampedDy = dy;
        if (distance > maxDist) {
          clampedDx = (dx / distance) * maxDist;
          clampedDy = (dy / distance) * maxDist;
        }

        const normX = clampedDx / maxDist;
        const normY = -clampedDy / maxDist;

        return { x: normX, y: normY, dx: clampedDx, dy: clampedDy };
      }

      function updateJoystick(clientX, clientY) {
        const pos = getJoystickPosition(clientX, clientY);
        joystickX = pos.x;
        joystickY = pos.y;

        if (joystickThumb) {
          const rect = joystickBase.getBoundingClientRect();
          const radius = rect.width / 2;
          const maxDist = radius - 25;
          const thumbX = pos.dx;
          const thumbY = pos.dy;
          joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;
          joystickThumb.classList.toggle("active", pos.x !== 0 || pos.y !== 0);
        }
      }

      function resetJoystick() {
        joystickX = 0;
        joystickY = 0;
        joystickActive = false;
        if (joystickThumb) {
          joystickThumb.style.transform = "translate(-50%, -50%)";
          joystickThumb.classList.remove("active");
        }
      }

      // Touch events (Joystick + Camera Touch Drag Rotation)
      let joystickTouchId = null;
      let cameraTouchId = null;
      let cameraTouchPrevX = 0;
      let cameraTouchPrevY = 0;

      function isInteractiveTouchTarget(target) {
        if (typeof isUIOpen === "function" && isUIOpen()) return true;
        if (!target) return false;
        if (target.closest("#joystickContainer, #joystickBase, .start-btn, .game-ui-button, .action-slot, .inventory-slot, .inventory-panel, .confirm-overlay, .modal, button, input, select, textarea, a, #invToggleBtn, #settingsBtn, #cameraToggleBtn, #devInputModeToggle, .compass-container, .dictionary-overlay, .settings-overlay, .game-ui")) {
          return true;
        }
        if (typeof getInteractiveTarget === "function" && getInteractiveTarget(target)) {
          return true;
        }
        return false;
      }

      if (joystickBase) {
        joystickBase?.addEventListener(
          "touchstart",
          (e) => {
            if (window.isConfirmOverlayOpen) return;
            initAudio();
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
              const touch = e.changedTouches[i];
              if (joystickTouchId === null) {
                joystickTouchId = touch.identifier;
                joystickActive = true;
                updateJoystick(touch.clientX, touch.clientY);
                break;
              }
            }
          },
          { passive: false },
        );
      }

      window.addEventListener(
        "touchstart",
        (e) => {
          lastTouchTime = Date.now();
          showDpad();
          if (window.isConfirmOverlayOpen) return;

          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystickTouchId) continue;
            if (isInteractiveTouchTarget(touch.target)) continue;

            if (cameraTouchId === null) {
              cameraTouchId = touch.identifier;
              cameraTouchPrevX = touch.clientX;
              cameraTouchPrevY = touch.clientY;
              window.isCameraDragging = true;
            }
          }
        },
        { passive: true },
      );

      document.addEventListener(
        "touchmove",
        (e) => {
          lastTouchTime = Date.now();
          showDpad();

          if (window.isConfirmOverlayOpen) {
            if (joystickActive) resetJoystick();
            joystickTouchId = null;
            cameraTouchId = null;
            window.isCameraDragging = false;
            return;
          }

          // 1. Update Joystick
          if (joystickActive && joystickTouchId !== null) {
            for (let i = 0; i < e.changedTouches.length; i++) {
              const touch = e.changedTouches[i];
              if (touch.identifier === joystickTouchId) {
                updateJoystick(touch.clientX, touch.clientY);
                break;
              }
            }
          }

          // 2. Touch Drag Camera Rotation
          if (cameraTouchId !== null) {
            for (let i = 0; i < e.changedTouches.length; i++) {
              const touch = e.changedTouches[i];
              if (touch.identifier === cameraTouchId) {
                if (e.cancelable) e.preventDefault();
                const dx = touch.clientX - cameraTouchPrevX;
                const dy = touch.clientY - cameraTouchPrevY;
                cameraTouchPrevX = touch.clientX;
                cameraTouchPrevY = touch.clientY;

                const touchSens = 0.006 * (typeof mouseSensitivity === "number" ? mouseSensitivity : 1.0);

                if (window.cameraMode === "freecam" || (typeof cameraSpringArm !== "undefined" && cameraSpringArm && cameraSpringArm.mode === "freecam")) {
                  if (typeof window.freeCamYaw !== "number") window.freeCamYaw = 0.0;
                  if (typeof window.freeCamPitch !== "number") window.freeCamPitch = 0.0;
                  window.freeCamYaw -= dx * touchSens;
                  window.freeCamPitch += dy * touchSens;
                  window.freeCamPitch = Math.max(-1.52, Math.min(1.52, window.freeCamPitch));
                } else {
                  if (typeof isUIOpen === "function" && isUIOpen()) return;
                  const isAimingLockedBow = (typeof isUsingItem !== "undefined" && isUsingItem) && (typeof activeItem !== "undefined" && activeItem) && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON") && (typeof activeTargetNPC !== "undefined" && activeTargetNPC);
                  if (!isAimingLockedBow) {
                    rotationY -= dx * touchSens;
                    rotationX += dy * touchSens;
                    const maxPitch = (typeof cameraMode !== "undefined" && (cameraMode === "sun" || cameraMode === "overview" || cameraMode === "freecam")) ? 1.45 : 1.2;
                    const minPitch = (typeof cameraMode !== "undefined" && (cameraMode === "sun" || cameraMode === "overview" || cameraMode === "freecam")) ? -0.55 : -0.55;
                    rotationX = Math.max(minPitch, Math.min(maxPitch, rotationX));

                    window.rotationY = rotationY;
                    window.rotationX = rotationX;
                  }
                }
                break;
              }
            }
          }
        },
        { passive: false },
      );

      const handleTouchEndOrCancel = (e) => {
        lastTouchTime = Date.now();
        showDpad();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === joystickTouchId) {
            joystickTouchId = null;
            resetJoystick();
          }
          if (touch.identifier === cameraTouchId) {
            cameraTouchId = null;
            window.isCameraDragging = false;
          }
        }
      };

      document.addEventListener("touchend", handleTouchEndOrCancel, { passive: false });
      document.addEventListener("touchcancel", handleTouchEndOrCancel, { passive: false });

      // Mouse events
      let mouseDown = false;
      joystickBase?.addEventListener("mousedown", (e) => {
        if (window.isConfirmOverlayOpen) return;
        e.preventDefault();
        mouseDown = true;
        joystickActive = true;
        updateJoystick(e.clientX, e.clientY);
      });

      document.addEventListener("mousemove", (e) => {
        if (window.isConfirmOverlayOpen) { mouseDown = false; resetJoystick(); return; }
        if (!mouseDown) return;
        updateJoystick(e.clientX, e.clientY);
      });

      document.addEventListener("mouseup", () => {
        if (mouseDown) {
          mouseDown = false;
          resetJoystick();
        }
      });

      // Auto show/hide joystick based on input type (Touch vs Mouse/Keyboard)
      let lastTouchTime = 0;
      let isTouchInputMode = false;
      const joystickContainer = document.getElementById("joystickContainer");
      let devInputMode = "auto"; // "auto", "touch", "keyboard"
      window.devInputMode = devInputMode;

      function updateFullscreenBtnByInput(isTouch) {
        const gameplayFullscreenBtn = document.getElementById("gameplayFullscreenBtn");
        if (gameplayFullscreenBtn) {
          if (isTouch) {
            gameplayFullscreenBtn.style.setProperty("display", "none", "important");
          } else {
            gameplayFullscreenBtn.style.setProperty("display", "flex", "important");
          }
        }
      }

      function showDpad() {
        if (devInputMode === "keyboard") return;
        isTouchInputMode = true;
        if (joystickContainer && joystickContainer.style.display === "none") {
          joystickContainer.style.display = "block";
        }
        const actionSlotsEl = document.getElementById("actionSlots");
        if (actionSlotsEl) actionSlotsEl.classList.remove("keyboard-mode");
        const invActionSlotsEl = document.getElementById("inventoryActionSlots");
        if (invActionSlotsEl) invActionSlotsEl.classList.remove("keyboard-mode");
        document.body.classList.add("touch-mode");
        document.body.classList.remove("keyboard-mode");
        updateFullscreenBtnByInput(true);
      }

      function hideDpad() {
        if (devInputMode === "touch") return;
        isTouchInputMode = false;
        if (joystickContainer && joystickContainer.style.display !== "none") {
          joystickContainer.style.display = "none";
        }
        const actionSlotsEl = document.getElementById("actionSlots");
        if (actionSlotsEl) actionSlotsEl.classList.add("keyboard-mode");
        const invActionSlotsEl = document.getElementById("inventoryActionSlots");
        if (invActionSlotsEl) invActionSlotsEl.classList.add("keyboard-mode");
        document.body.classList.add("keyboard-mode");
        document.body.classList.remove("touch-mode");
        updateFullscreenBtnByInput(false);
      }

      // Initial state based on input/device type
      if (('ontouchstart' in window) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        showDpad();
      } else {
        hideDpad();
      }

      // Touch events anywhere on window should restore the dpad
      window.addEventListener(
        "touchstart",
        () => {
          lastTouchTime = Date.now();
          showDpad();
        },
        { passive: true },
      );

      window.addEventListener(
        "touchmove",
        () => {
          lastTouchTime = Date.now();
          showDpad();
        },
        { passive: true },
      );

      window.addEventListener(
        "touchend",
        () => {
          lastTouchTime = Date.now();
          showDpad();
        },
        { passive: true },
      );

      // Keyboard events anywhere on window should hide the dpad
      window.addEventListener(
        "keydown",
        () => {
          hideDpad();
        },
        { passive: true },
      );

      // Mouse events anywhere on window should hide the dpad (if not a synthetic touch event)
      window.addEventListener(
        "mousemove",
        () => {
          if (Date.now() - lastTouchTime > 1000) {
            hideDpad();
          }
        },
        { passive: true },
      );

      window.addEventListener(
        "mousedown",
        () => {
          if (Date.now() - lastTouchTime > 1000) {
            hideDpad();
          }
        },
        { passive: true },
      );


      // ============================================
      // ระบบเปิดกระเป๋าด้วยปุ่ม Tab (ป้องกันการกดค้าง)
      // ============================================
      let inventoryKeyPressed = false;

      // ป้องกันปุ่ม Tab นำทางโฟกัสเบราว์เซอร์ในหน้าเริ่มเกม และเปิด/ปิดหรือปิดเมื่อเปิดตั้งค่าอยู่
      window.addEventListener("keydown", (e) => {
        if (window.isWaitingForKey) return;
        if (e.key === "Tab" || e.code === "Tab") {
          const overlay = document.getElementById("inventoryOverlay");
          const isCurrentlyOpen = overlay && overlay.classList.contains("open");
          if (isCurrentlyOpen) {
            e.preventDefault();
            e.stopPropagation();
            toggleInventory();
          } else if (!gameStarted) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }, true);

      document.addEventListener("keydown", (e) => {
        if (window.isWaitingForKey) return;
        if (e.code === currentKeyBindings.inventory) {
          e.preventDefault();
          if (!gameStarted) return;
          if (!inventoryKeyPressed) {
            inventoryKeyPressed = true;
            const warpOverlayEl = document.getElementById("warpOverlay");
            if (warpOverlayEl && warpOverlayEl.classList.contains("open")) {
              if (typeof closeWarpUI === "function") closeWarpUI();
            } else if (currentOpenChest) {
              closeChest();
            } else {
              toggleInventory();
            }
          }
        }
      });

      document.addEventListener("keyup", (e) => {
        if (window.isWaitingForKey) return;
        if (e.code === currentKeyBindings.inventory) {
          inventoryKeyPressed = false;
        }
      });

      document.addEventListener("keydown", (e) => {
        if (window.isWaitingForKey) return;
        if (!gameStarted) return;
        
        let newSelection = -1;
        if (e.code === currentKeyBindings.action1) {
          newSelection = 0;
        } else if (e.code === currentKeyBindings.action2) {
          newSelection = 1;
        } else if (e.code === currentKeyBindings.action3) {
          newSelection = 2;
        } else if (e.code === currentKeyBindings.action4) {
          newSelection = 3;
        }
        
        if (newSelection !== -1) {
          if (selectedActionSlotIndex === newSelection) {
            selectedActionSlotIndex = -1; // Toggle off
          } else {
            selectedActionSlotIndex = newSelection;
          }
          if (typeof renderActionSlots === "function") renderActionSlots();
        }
      });

      // Event Listeners สำหรับกระเป๋า
      const invToggleEl = document.getElementById("inventoryToggle");
      if (invToggleEl) {
        let pressTimer = null;
        let isLongPress = false;
        let isPressed = false;
        let demolishWasActiveOnDown = false;
        let lastTouchTime = 0;

        const handleDown = (isTouchMode) => {
          if (typeof initAudio === "function") initAudio();
          isPressed = true;
          isLongPress = false;
          demolishWasActiveOnDown = (typeof isDemolishModeEnabled !== 'undefined' && isDemolishModeEnabled);

          if (isTouchMode) {
            if (demolishWasActiveOnDown) {
              // หากเปิดโหมดรื้อถอนอยู่ การแตะจะปิดโหมดรื้อถอนทันที (ส่ง CapsLock keydown)
              window.dispatchEvent(new KeyboardEvent("keydown", {
                key: "CapsLock",
                code: "CapsLock",
                keyCode: 20,
                which: 20,
                bubbles: true,
                cancelable: true
              }));
              return;
            }

            pressTimer = setTimeout(() => {
              isLongPress = true;
              // ส่งสัญญาณปุ่ม CapsLock เพื่อเปิดโหมดรื้อถอนเมื่อกดค้างครบ 300ms
              window.dispatchEvent(new KeyboardEvent("keydown", {
                key: "CapsLock",
                code: "CapsLock",
                keyCode: 20,
                which: 20,
                bubbles: true,
                cancelable: true
              }));
            }, 300); // 300ms threshold for long press
          }
        };

        const handleUp = (isTouchMode) => {
          if (!isPressed) return;
          isPressed = false;

          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }

          if (isTouchMode) {
            if (!isLongPress) {
              // หากเป็นการแตะสั้น และไม่ได้เปิดโหมดรื้อถอนมาก่อน ให้เปิด/ปิดกระเป๋าปกติ
              if (!demolishWasActiveOnDown) {
                if (typeof toggleInventory === "function") {
                  toggleInventory();
                }
              }
            }
          } else {
            // Normal desktop click immediate toggle
            if (typeof toggleInventory === "function") {
              toggleInventory();
            }
          }
          isLongPress = false;
        };

        invToggleEl?.addEventListener("touchstart", (e) => {
          e.preventDefault();
          lastTouchTime = Date.now();
          handleDown(true);
        }, { passive: false });

        invToggleEl?.addEventListener("touchend", (e) => {
          e.preventDefault();
          lastTouchTime = Date.now();
          handleUp(true);
        }, { passive: false });

        invToggleEl?.addEventListener("touchcancel", (e) => {
          e.preventDefault();
          lastTouchTime = Date.now();
          handleUp(true);
        }, { passive: false });

        invToggleEl?.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          // ป้องกันการทำงานซ้ำหากเพิ่งเกิด Touch Event ไปไม่นาน
          if (Date.now() - lastTouchTime < 1000) return;

          const isSimulatedTouchMode = (typeof devInputMode !== "undefined" && devInputMode === "touch");
          if (isSimulatedTouchMode) {
            handleDown(true);
          }
        });

        // ตรวจจับ mouseup บนหน้าต่างเบราว์เซอร์ เพื่อความปลอดภัยกรณีปล่อยเมาส์นอกปุ่ม
        const mouseUpWindow = (e) => {
          if (isPressed) {
            if (Date.now() - lastTouchTime < 1000) return;
            const isSimulatedTouchMode = (typeof devInputMode !== "undefined" && devInputMode === "touch");
            handleUp(isSimulatedTouchMode);
          }
        };
        window.addEventListener("mouseup", mouseUpWindow);

        // ดักจับเหตุการณ์คลิกแบบปกติ (สำหรับโหมดเมาส์/คีย์บอร์ดดั้งเดิม)
        invToggleEl?.addEventListener("click", (e) => {
          // หากมาจาก Touch Event หรืออยู่ในโหมดจำลองจอสัมผัส จะข้ามการทำงานส่วนนี้
          if (Date.now() - lastTouchTime < 1000) return;
          const isSimulatedTouchMode = (typeof devInputMode !== "undefined" && devInputMode === "touch");
          if (isSimulatedTouchMode) return;

          if (typeof toggleInventory === "function") {
            toggleInventory();
          }
        });

        // Dynamic monitoring of demolish mode state to update inventory button UI
        let lastDemolishState = false;
        function updateInventoryButtonState() {
          const active = (typeof isDemolishModeEnabled !== 'undefined' && isDemolishModeEnabled);
          if (active !== lastDemolishState) {
            lastDemolishState = active;
            const normalContent = document.getElementById("inventoryToggleNormalContent");
            const demolishContent = document.getElementById("inventoryToggleDemolishContent");
            
            if (active) {
              invToggleEl.classList.add("demolish-active");
              invToggleEl.title = "ปิดโหมดรื้อถอน (Demolish Mode Active - Click to Close)";
              if (normalContent) normalContent.style.display = "none";
              if (demolishContent) demolishContent.style.display = "flex";
            } else {
              invToggleEl.classList.remove("demolish-active");
              invToggleEl.title = "เปิดกระเป๋า (Inventory)";
              if (normalContent) normalContent.style.display = "flex";
              if (demolishContent) demolishContent.style.display = "none";
            }
          }
        }
        
        setInterval(updateInventoryButtonState, 300);
      }
      const invCloseEl = document.getElementById("inventoryClose");
      if (invCloseEl) {
        invCloseEl?.addEventListener("click", () => {
        if (typeof toggleInventory === "function") toggleInventory();
        else if (typeof window.toggleInventory === "function") window.toggleInventory();
      });
      }

      let distanceDisplayEnabled = false;
      const distanceToggle = document.getElementById("distanceToggle");
      if (distanceToggle) {
        distanceToggle?.addEventListener("click", () => {
          distanceDisplayEnabled = !distanceDisplayEnabled;
          distanceToggle.textContent = `ระยะทาง: ${distanceDisplayEnabled ? "เปิด" : "ปิด"}`;
          distanceToggle.classList.toggle("active", distanceDisplayEnabled);
          const distanceInfo = document.getElementById("distanceInfo");
          if (distanceInfo) {
            distanceInfo.style.display = distanceDisplayEnabled ? "block" : "none";
          }
        });
      }

      let quitHoldTimer = null;
      let quitHoldProgress = 0;
      let quitHoldInterval = null;
      const quitGameBtn = document.getElementById("quitGameBtn");
        if (typeof isAndroidProfile !== "undefined" && isAndroidProfile && quitGameBtn) {
          // Keep it hidden everywhere
          // quitGameBtn.style.display = "none";
        }
        if (quitGameBtn) {
          quitGameBtn.style.display = "none !important";
        }
      const quitGameProgress = document.getElementById("quitGameProgress");

      function startQuitHold(e) {
        if (e) e.preventDefault();
        quitHoldProgress = 0;
        quitGameProgress.style.transition = "none";
        quitGameProgress.style.width = "0%";

        clearInterval(quitHoldInterval);
        quitHoldInterval = setInterval(() => {
          quitHoldProgress += 5;
          quitGameProgress.style.width = quitHoldProgress + "%";
          if (quitHoldProgress >= 100) {
            clearInterval(quitHoldInterval);
            if (window.__TAURI__) {
              let closed = false;
              // 1. Try webviewWindow.getCurrentWebviewWindow().close() (Tauri v2 standard)
              try {
                if (window.__TAURI__.webviewWindow && window.__TAURI__.webviewWindow.getCurrentWebviewWindow) {
                  window.__TAURI__.webviewWindow.getCurrentWebviewWindow().close();
                  closed = true;
                }
              } catch (err) {
                console.error("Failed to close via getCurrentWebviewWindow", err);
              }

              // 2. Try window.getCurrentWindow().close() (Tauri v1 / v2 alternative)
              if (!closed) {
                try {
                  if (window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow) {
                    window.__TAURI__.window.getCurrentWindow().close();
                    closed = true;
                  }
                } catch (err) {
                  console.error("Failed to close via getCurrentWindow", err);
                }
              }

              // 3. Try direct IPC invoke of close command
              if (!closed) {
                try {
                  if (window.__TAURI__.core && window.__TAURI__.core.invoke) {
                    window.__TAURI__.core.invoke("plugin:window|close");
                    closed = true;
                  }
                } catch (err) {
                  console.error("Failed to invoke plugin:window|close", err);
                }
              }

              // 4. Try direct IPC invoke of process exit command
              if (!closed) {
                try {
                  if (window.__TAURI__.core && window.__TAURI__.core.invoke) {
                    window.__TAURI__.core.invoke("plugin:process|exit", { code: 0 });
                    closed = true;
                  }
                } catch (err) {
                  console.error("Failed to invoke plugin:process|exit", err);
                }
              }

              // Fallback if inside a normal browser window
              if (!closed) {
                window.close();
            }
          } else {
              window.close();
            }
          }
        }, 30);
      }

      function cancelQuitHold(e) {
        clearInterval(quitHoldInterval);
        quitHoldProgress = 0;
        quitGameProgress.style.transition = "width 0.2s";
        quitGameProgress.style.width = "0%";
      }

      if (quitGameBtn) {
        quitGameBtn?.addEventListener("mousedown", startQuitHold);
        quitGameBtn?.addEventListener("touchstart", startQuitHold, {
          passive: false,
        });
        quitGameBtn?.addEventListener("contextmenu", (e) => e.preventDefault());
        quitGameBtn?.addEventListener("mouseup", cancelQuitHold);
        quitGameBtn?.addEventListener("mouseleave", cancelQuitHold);
        quitGameBtn?.addEventListener("touchend", cancelQuitHold);
        quitGameBtn?.addEventListener("touchcancel", cancelQuitHold);
      }
      document
        .getElementById("inventoryOverlay")
        .addEventListener("click", (e) => {
          if (e.target === e.currentTarget) {
            toggleInventory();
          }
        });

      
      document.getElementById("tabCooking")?.addEventListener("click", () => {
        activeTab = "cooking";
        if (typeof window.setActiveTab === "function") window.setActiveTab("cooking");
        document.getElementById("tabInventory").classList.remove("active");
        document.getElementById("tabItemsList").classList.remove("active");
        document.getElementById("tabSettings").classList.remove("active");
        document.getElementById("tabCrafting").classList.remove("active");
        document.getElementById("tabCooking").classList.add("active");
        document.getElementById("inventoryGrid").style.display = "none";
        document.getElementById("inventorySettings").style.display = "none";
        document.getElementById("craftingList").style.display = "none";
        document.getElementById("cookingList").style.display = "flex";
        
        const bottomBtns = document.getElementById("inventoryBottomButtons");
        if (bottomBtns) bottomBtns.style.display = "none";

        const mainLayout = document.getElementById("inventoryMainLayout");
        if (mainLayout) mainLayout.style.display = "none";
        const divider = document.getElementById("inventoryVerticalDivider");
        if (divider) divider.style.display = "none";
        const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");
        if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
        if (typeof renderCooking === "function") renderCooking();
        else if (typeof window.renderCooking === "function") window.renderCooking();
      });

      function switchInventoryTab(tabName) {
        activeTab = tabName;
        if (typeof window.setActiveTab === "function") window.setActiveTab(tabName);

        const tabCrafting = document.getElementById("tabCrafting");
        const tabInventory = document.getElementById("tabInventory");
        const tabItemsList = document.getElementById("tabItemsList");
        const tabSettings = document.getElementById("tabSettings");
        const tabCooking = document.getElementById("tabCooking");

        if (tabCrafting) tabCrafting.classList.toggle("active", tabName === "crafting");
        if (tabInventory) tabInventory.classList.toggle("active", tabName === "inventory");
        if (tabItemsList) tabItemsList.classList.toggle("active", tabName === "itemsList");
        if (tabSettings) tabSettings.classList.toggle("active", tabName === "settings");
        if (tabCooking) {
          tabCooking.classList.toggle("active", tabName === "cooking");
          if (tabName !== "cooking") tabCooking.style.display = "none";
        }

        const inventoryGrid = document.getElementById("inventoryGrid");
        const inventorySettings = document.getElementById("inventorySettings");
        const craftingList = document.getElementById("craftingList");
        const cookingList = document.getElementById("cookingList");
        const bottomBtns = document.getElementById("inventoryBottomButtons");
        const mainLayout = document.getElementById("inventoryMainLayout");
        const divider = document.getElementById("inventoryVerticalDivider");
        const actionSlotsWrapper = document.getElementById("inventoryActionSlotsWrapper");

        if (tabName === "inventory") {
          if (inventoryGrid) inventoryGrid.style.display = "grid";
          if (inventorySettings) inventorySettings.style.display = "none";
          if (craftingList) craftingList.style.display = "none";
          if (cookingList) cookingList.style.display = "none";
          if (bottomBtns) bottomBtns.style.display = "flex";
          if (mainLayout) { mainLayout.style.display = "flex"; mainLayout.style.maxWidth = "none"; }
          if (divider) divider.style.display = "block";
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "flex";
          if (typeof renderInventory === "function") renderInventory();
          else if (typeof window.renderInventory === "function") window.renderInventory();
        } else if (tabName === "crafting") {
          if (inventoryGrid) inventoryGrid.style.display = "none";
          if (inventorySettings) inventorySettings.style.display = "none";
          if (craftingList) craftingList.style.display = "flex";
          if (cookingList) cookingList.style.display = "none";
          if (bottomBtns) bottomBtns.style.display = "none";
          if (mainLayout) mainLayout.style.display = "none";
          if (divider) divider.style.display = "none";
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
          if (typeof renderCrafting === "function") renderCrafting();
          else if (typeof window.renderCrafting === "function") window.renderCrafting();
        } else if (tabName === "settings") {
          if (inventoryGrid) inventoryGrid.style.display = "none";
          if (inventorySettings) inventorySettings.style.display = "flex";
          if (craftingList) craftingList.style.display = "none";
          if (cookingList) cookingList.style.display = "none";
          if (bottomBtns) bottomBtns.style.display = "none";
          if (mainLayout) mainLayout.style.display = "none";
          if (divider) divider.style.display = "none";
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
          syncInventorySettingsUI();
        } else if (tabName === "itemsList") {
          if (inventoryGrid) inventoryGrid.style.display = "grid";
          if (inventorySettings) inventorySettings.style.display = "none";
          if (craftingList) craftingList.style.display = "none";
          if (cookingList) cookingList.style.display = "none";
          if (bottomBtns) bottomBtns.style.display = "none";
          if (mainLayout) { mainLayout.style.display = "flex"; mainLayout.style.maxWidth = "none"; }
          if (divider) divider.style.display = "block";
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
          if (typeof renderInventory === "function") renderInventory();
          else if (typeof window.renderInventory === "function") window.renderInventory();
        } else if (tabName === "cooking") {
          if (inventoryGrid) inventoryGrid.style.display = "none";
          if (inventorySettings) inventorySettings.style.display = "none";
          if (craftingList) craftingList.style.display = "none";
          if (cookingList) cookingList.style.display = "flex";
          if (bottomBtns) bottomBtns.style.display = "none";
          if (mainLayout) mainLayout.style.display = "none";
          if (divider) divider.style.display = "none";
          if (actionSlotsWrapper) actionSlotsWrapper.style.display = "none";
          if (typeof renderCooking === "function") renderCooking();
          else if (typeof window.renderCooking === "function") window.renderCooking();
        }

        setTimeout(updateActionSlotsPosition, 0);
        if (typeof updateCustomScrollbar === "function") setTimeout(updateCustomScrollbar, 30);
      }
      window.switchInventoryTab = switchInventoryTab;

      document.getElementById("tabCooking")?.addEventListener("click", () => switchInventoryTab("cooking"));
      document.getElementById("tabInventory")?.addEventListener("click", () => switchInventoryTab("inventory"));
      document.getElementById("tabCrafting")?.addEventListener("click", () => switchInventoryTab("crafting"));
      document.getElementById("tabItemsList")?.addEventListener("click", () => switchInventoryTab("itemsList"));
      document.getElementById("tabSettings")?.addEventListener("click", () => switchInventoryTab("settings"));

      // Bumper buttons click listeners for menu tab switching (LB / RB)
      document.getElementById("btnGamepadTabLB")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.GamepadController && typeof window.GamepadController.cycleTabs === "function") {
          window.GamepadController.cycleTabs(-1);
        }
      });
      document.getElementById("btnGamepadTabRB")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.GamepadController && typeof window.GamepadController.cycleTabs === "function") {
          window.GamepadController.cycleTabs(1);
        }
      });

      // Keyboard Q and E to switch tabs when inventory overlay is open
      window.addEventListener("keydown", (e) => {
        const overlay = document.getElementById("inventoryOverlay");
        if (overlay && overlay.classList.contains("open")) {
          if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) return;
          if (e.code === "KeyQ" || e.code === "PageUp") {
            if (window.GamepadController && typeof window.GamepadController.cycleTabs === "function") {
              e.preventDefault();
              window.GamepadController.cycleTabs(-1);
            }
          } else if (e.code === "KeyE" || e.code === "PageDown") {
            if (window.GamepadController && typeof window.GamepadController.cycleTabs === "function") {
              e.preventDefault();
              window.GamepadController.cycleTabs(1);
            }
          }
        }
      });

      // Tauri Window Helper supporting both Tauri v1 and v2
      function getTauriWindow() {
        if (!window.__TAURI__) return null;
        if (window.__TAURI__.webviewWindow && window.__TAURI__.webviewWindow.getCurrentWebviewWindow) {
          return window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
        }
        if (window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow) {
          return window.__TAURI__.window.getCurrentWindow();
        }
        return null;
      }

      // Screen Mode selection
      function enterFullscreen() {
        const tWindow = getTauriWindow();
        if (tWindow && typeof tWindow.setFullscreen === "function") {
          tWindow.setFullscreen(true).then(() => {
            setTimeout(syncScreenModeUI, 100);
          }).catch((err) => console.error("Tauri setFullscreen true failed", err));
          return;
        }
        const docEl = document.documentElement;
        const requestFullScreen =
          docEl.requestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.webkitRequestFullScreen ||
          docEl.msRequestFullscreen;
        if (requestFullScreen) {
          try {
            const res = requestFullScreen.call(docEl);
            const lockLandscape = () => {
              if (screen.orientation && typeof screen.orientation.lock === "function") {
                screen.orientation.lock("landscape").catch((e) => console.log("Orientation lock failed", e));
              }
            };
            if (res && typeof res.then === "function") {
              res.then(() => {
                if (navigator.keyboard && navigator.keyboard.lock) {
                  navigator.keyboard
                    .lock(["Escape"])
                    .catch((e) => console.log("Keyboard lock failed", e));
                }
                lockLandscape();
              })
              .catch((err) => {
                console.warn("Fullscreen request failed safely:", err);
              });
            } else {
              lockLandscape();
            }
          } catch (err) {
            console.warn("enterFullscreen failed safely:", err);
          }
        }
      }
      window.enterFullscreen = enterFullscreen;

      // Auto fullscreen & landscape on mobile touch
      const isMobileOrTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
      if (isMobileOrTouch) {
        const triggerMobileFullscreen = (e) => {
          const doc = document;
          const isFull = !!(
            doc.fullscreenElement ||
            doc.mozFullScreenElement ||
            doc.webkitFullscreenElement ||
            doc.msFullscreenElement
          );
          if (!isFull) {
            enterFullscreen();
          }
        };
        window.addEventListener("touchstart", triggerMobileFullscreen, { passive: true });
        window.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "touch") {
            triggerMobileFullscreen(e);
          }
        }, { passive: true });
      }

      function exitFullscreen() {
        const tWindow = getTauriWindow();
        if (tWindow && typeof tWindow.setFullscreen === "function") {
          tWindow.setFullscreen(false).then(() => {
            setTimeout(syncScreenModeUI, 100);
          }).catch((err) => console.error("Tauri setFullscreen false failed", err));
          return;
        }
        const doc = document;
        const cancelFullScreen =
          doc.exitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.webkitExitFullscreen ||
          doc.msExitFullscreen;
        if (cancelFullScreen) {
          const isFull = !!(
            doc.fullscreenElement ||
            doc.mozFullScreenElement ||
            doc.webkitFullscreenElement ||
            doc.msFullscreenElement
          );
          if (isFull) {
            try {
              const res = cancelFullScreen.call(doc);
              if (res && typeof res.catch === "function") {
                res.catch((err) => {
                  console.warn("exitFullscreen promise rejected safely:", err);
                });
              }
            } catch (err) {
              console.warn("exitFullscreen failed safely:", err);
            }
          }
        }
      }

      document
        .getElementById("setModeFullscreen")
        .addEventListener("click", () => {
          initAudio();
          enterFullscreen();
        });

      document
        .getElementById("setModeWindowed")
        .addEventListener("click", () => {
          initAudio();
          exitFullscreen();
        });

      const isMobileOrTouchDevice = () => {
        return isTouchInputMode;
      };

      window.syncScreenModeUI = async function() {
        const screenModeContainer = document.getElementById("screenModeSettingContainer");
        if (screenModeContainer) {
          screenModeContainer.style.setProperty("display", "none", "important");
        }

        let isFullscreen = !!(
          document.fullscreenElement ||
          document.mozFullScreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement
        );

        const tWindow = getTauriWindow();
        if (tWindow && typeof tWindow.isFullscreen === "function") {
          try {
            isFullscreen = await tWindow.isFullscreen();
          } catch (e) {
            console.warn("Tauri isFullscreen check failed", e);
          }
        }

        const btnWindowed = document.getElementById("setModeWindowed");
        const btnFullscreen = document.getElementById("setModeFullscreen");

        if (isFullscreen) {
          if (btnFullscreen) {
            btnFullscreen.style.background = "rgba(223,183,108,0.15)";
            btnFullscreen.style.borderColor = "#dfb76c";
            btnFullscreen.style.color = "#dfb76c";
            btnFullscreen.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnWindowed) {
            btnWindowed.style.background = "rgba(255,255,255,0.05)";
            btnWindowed.style.borderColor = "rgba(255,255,255,0.2)";
            btnWindowed.style.color = "rgba(255,255,255,0.6)";
            btnWindowed.style.textShadow = "none";
          }
        } else {
          if (btnWindowed) {
            btnWindowed.style.background = "rgba(223,183,108,0.15)";
            btnWindowed.style.borderColor = "#dfb76c";
            btnWindowed.style.color = "#dfb76c";
            btnWindowed.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnFullscreen) {
            btnFullscreen.style.background = "rgba(255,255,255,0.05)";
            btnFullscreen.style.borderColor = "rgba(255,255,255,0.2)";
            btnFullscreen.style.color = "rgba(255,255,255,0.6)";
            btnFullscreen.style.textShadow = "none";
          }
        }
        isCurrentFullscreen = isFullscreen;
        const gameplayFullscreenBtn = document.getElementById("gameplayFullscreenBtn");
        if (gameplayFullscreenBtn) {
          if (isMobileOrTouchDevice()) {
            gameplayFullscreenBtn.style.setProperty("display", "none", "important");
          } else {
            gameplayFullscreenBtn.innerHTML = isFullscreen
              ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h5V3M20 8h-5V3M4 16h5v5M20 16h-5v5"></path></svg>`
              : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path></svg>`;
          }
        }
        if (typeof saveSettingsToLocalStorage === "function") {
          saveSettingsToLocalStorage();
        }
      }

      document.addEventListener("fullscreenchange", syncScreenModeUI);
      document.addEventListener("webkitfullscreenchange", syncScreenModeUI);
      document.addEventListener("mozfullscreenchange", syncScreenModeUI);
      document.addEventListener("MSFullscreenChange", syncScreenModeUI);

      window.updateFpsLimitUI = function() {
        const btn30 = document.getElementById("fps30Btn");
        const btn60 = document.getElementById("fps60Btn");
        const btn120 = document.getElementById("fps120Btn");

        const setActive = (btn) => {
          if (!btn) return;
          btn.style.background = "rgba(223, 183, 108, 0.15)";
          btn.style.borderColor = "#dfb76c";
          btn.style.color = "#dfb76c";
          btn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
        };

        const setInactive = (btn) => {
          if (!btn) return;
          btn.style.background = "rgba(255, 255, 255, 0.05)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
          btn.style.color = "rgba(255, 255, 255, 0.6)";
          btn.style.textShadow = "none";
        };

        if (targetFps === 30) {
          setActive(btn30);
          setInactive(btn60);
          setInactive(btn120);
        } else if (targetFps === 60) {
          setInactive(btn30);
          setActive(btn60);
          setInactive(btn120);
        } else {
          setInactive(btn30);
          setInactive(btn60);
          setActive(btn120);
        }
      }

      if (document.getElementById("fps30Btn")) {
          document.getElementById("fps30Btn")?.addEventListener("click", () => {
            targetFps = 30;
            frameTime = 1000 / targetFps;
            updateFpsLimitUI();
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          });
      }

      if (document.getElementById("fps60Btn")) {
          document.getElementById("fps60Btn")?.addEventListener("click", () => {
            targetFps = 60;
            frameTime = 1000 / targetFps;
            updateFpsLimitUI();
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          });
      }

      if (document.getElementById("fps120Btn")) {
          document.getElementById("fps120Btn")?.addEventListener("click", () => {
            targetFps = 120;
            frameTime = 1000 / targetFps;
            updateFpsLimitUI();
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          });
      }
      // FPS Display Toggle
      window.updateFpsToggleUI = function() {
        const btnOn = document.getElementById("fpsToggleOn");
        const btnOff = document.getElementById("fpsToggleOff");
        const fpsCounter = document.getElementById("fpsCounter");

        if (showFps) {
          if (fpsCounter) fpsCounter.style.display = "flex";
          if (btnOn) {
            btnOn.style.background = "rgba(223,183,108,0.15)";
            btnOn.style.borderColor = "#dfb76c";
            btnOn.style.color = "#dfb76c";
            btnOn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnOff) {
            btnOff.style.background = "rgba(255,255,255,0.05)";
            btnOff.style.borderColor = "rgba(255,255,255,0.2)";
            btnOff.style.color = "rgba(255,255,255,0.6)";
            btnOff.style.textShadow = "none";
            }
          } else {
          if (fpsCounter) fpsCounter.style.display = "none";
          if (btnOff) {
            btnOff.style.background = "rgba(223,183,108,0.15)";
            btnOff.style.borderColor = "#dfb76c";
            btnOff.style.color = "#dfb76c";
            btnOff.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnOn) {
            btnOn.style.background = "rgba(255,255,255,0.05)";
            btnOn.style.borderColor = "rgba(255,255,255,0.2)";
            btnOn.style.color = "rgba(255,255,255,0.6)";
            btnOn.style.textShadow = "none";
          }
        }
      }

      document.getElementById("fpsToggleOn")?.addEventListener("click", () => {
        showFps = true;
        updateFpsToggleUI();
        if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
      });

      document.getElementById("fpsToggleOff")?.addEventListener("click", () => {
        showFps = false;
        updateFpsToggleUI();
        if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
      });

      // Shadow Map Toggle UI
      window.updateShadowMapUI = function() {
        const slider = document.getElementById("shadowMapQualitySlider");
        const valLabel = document.getElementById("shadowMapQualityVal");
        if (slider && valLabel) {
          slider.value = shadowMapQuality;
          const labels = ["Off", "Low", "Medium", "High", "Ultra"];
          valLabel.textContent = labels[shadowMapQuality] || "Medium";
        }
      }

      // Anti-Aliasing Toggle UI
      window.updateAntialiasUI = function() {
        const btnOn = document.getElementById("antialiasToggleOn");
        const btnOff = document.getElementById("antialiasToggleOff");

        if (antialiasEnabled) {
          if (btnOn) {
            btnOn.style.background = "rgba(223,183,108,0.15)";
            btnOn.style.borderColor = "#dfb76c";
            btnOn.style.color = "#dfb76c";
            btnOn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnOff) {
            btnOff.style.background = "rgba(255,255,255,0.05)";
            btnOff.style.borderColor = "rgba(255,255,255,0.2)";
            btnOff.style.color = "rgba(255,255,255,0.6)";
            btnOff.style.textShadow = "none";
          }
        } else {
          if (btnOff) {
            btnOff.style.background = "rgba(223,183,108,0.15)";
            btnOff.style.borderColor = "#dfb76c";
            btnOff.style.color = "#dfb76c";
            btnOff.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";
          }
          if (btnOn) {
            btnOn.style.background = "rgba(255,255,255,0.05)";
            btnOn.style.borderColor = "rgba(255,255,255,0.2)";
            btnOn.style.color = "rgba(255,255,255,0.6)";
            btnOn.style.textShadow = "none";
          }
        }
      }

      if (document.getElementById("shadowMapQualitySlider")) {
        document.getElementById("shadowMapQualitySlider")?.addEventListener("input", (e) => {
          const val = parseInt(e.target.value);
          shadowMapQuality = val;
          shadowMapEnabled = true;
          updateShadowMapUI();
          if (typeof window.resizeShadowMap === 'function') window.resizeShadowMap();
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
        });
      }

      function showNoticeLocal(msg) {
        if (typeof showNotice === 'function') {
          showNotice(msg);
        } else {
          const toast = document.createElement("div");
          toast.style.position = "fixed";
          toast.style.bottom = "120px";
          toast.style.left = "50%";
          toast.style.transform = "translateX(-50%)";
          toast.style.background = "rgba(15, 15, 20, 0.95)";
          toast.style.color = "#dfb76c";
          toast.style.border = "1px solid #dfb76c";
          toast.style.padding = "12px 24px";
          toast.style.borderRadius = "8px";
          toast.style.fontFamily = "'Google Sans', sans-serif";
          toast.style.fontSize = "13px";
          toast.style.zIndex = "999999";
          toast.style.pointerEvents = "none";
          toast.style.boxShadow = "0 8px 32px rgba(0,0,0,0.8)";
          toast.style.transition = "opacity 0.3s";
          toast.textContent = msg;
          document.body.appendChild(toast);
          setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
          }, 2500);
        }
      }

      let pendingAntialiasValue = null;
      let antialiasHoldInterval = null;
      let antialiasHoldProgress = 0;

      function openAntialiasConfirm(targetValue) {
        window.isConfirmOverlayOpen = true; if (window.clearKeysPressed) window.clearKeysPressed();
        pendingAntialiasValue = targetValue;
        const overlay = document.getElementById("antialiasConfirmOverlay");
        if (overlay) {
          const invPanel = document.querySelector("#inventoryOverlay .inventory-panel");
          if (invPanel) {
            invPanel.style.overflow = "hidden";
          }
          overlay.style.setProperty("display", "flex", "important");
        }
        clearInterval(antialiasHoldInterval);
        antialiasHoldProgress = 0;
        const progressEl = document.getElementById("antialiasConfirmProgress");
        if (progressEl) {
          progressEl.style.transition = "none";
          progressEl.style.width = "0%";
        }
      }

      function closeAntialiasConfirm() {
        window.isConfirmOverlayOpen = false;
        pendingAntialiasValue = null;
        const overlay = document.getElementById("antialiasConfirmOverlay");
        if (overlay) overlay.style.setProperty("display", "none", "important");
        const invPanel = document.querySelector("#inventoryOverlay .inventory-panel");
        if (invPanel) {
          invPanel.style.overflow = "";
        }
        clearInterval(antialiasHoldInterval);
        antialiasHoldProgress = 0;
        const progressEl = document.getElementById("antialiasConfirmProgress");
        if (progressEl) {
          progressEl.style.transition = "none";
          progressEl.style.width = "0%";
        }
      }

      if (document.getElementById("antialiasCancelBtn")) {
        document.getElementById("antialiasCancelBtn")?.addEventListener("click", closeAntialiasConfirm);
      }

      const antialiasConfirmBtn = document.getElementById("antialiasConfirmBtn");
      if (antialiasConfirmBtn) {
        function executeAntialiasChange() {
          if (pendingAntialiasValue !== null) {
            antialiasEnabled = pendingAntialiasValue;
            updateAntialiasUI();
            if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
            
            const msg = antialiasEnabled 
              ? "เปิดระบบลดรอยหยักแล้ว! กำลังรีโหลดหน้าจอ..." 
              : "ปิดระบบลดรอยหยักแล้ว! กำลังรีโหลดหน้าจอ...";
            
            showNoticeLocal(msg);
            closeAntialiasConfirm();
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }

        antialiasConfirmBtn?.addEventListener("click", executeAntialiasChange);
      }

      if (document.getElementById("antialiasToggleOn")) {
        document.getElementById("antialiasToggleOn")?.addEventListener("click", () => {
          if (antialiasEnabled === true) return; // ทำงานเฉพาะเวลาต้องการเปลี่ยนค่า
          openAntialiasConfirm(true);
        });
      }

      if (document.getElementById("antialiasToggleOff")) {
        document.getElementById("antialiasToggleOff")?.addEventListener("click", () => {
          if (antialiasEnabled === false) return; // ทำงานเฉพาะเวลาต้องการเปลี่ยนค่า
          openAntialiasConfirm(false);
        });
      }

      // FXAA Toggle UI
      window.updateFxaaUI = function() {
        const btnOn = document.getElementById("fxaaToggleOn") || document.getElementById("taauToggleOn");
        const btnOff = document.getElementById("fxaaToggleOff") || document.getElementById("taauToggleOff");
        if (!btnOn || !btnOff) return;
        const isEnabled = typeof window.fxaaEnabled !== "undefined" ? window.fxaaEnabled : (typeof fxaaEnabled !== "undefined" ? fxaaEnabled : (typeof window.taauEnabled !== "undefined" ? window.taauEnabled : true));
        if (isEnabled) {
          btnOn.style.background = "rgba(223, 183, 108, 0.15)";
          btnOn.style.borderColor = "#dfb76c";
          btnOn.style.color = "#dfb76c";
          btnOn.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

          btnOff.style.background = "rgba(255, 255, 255, 0.05)";
          btnOff.style.borderColor = "rgba(255, 255, 255, 0.2)";
          btnOff.style.color = "rgba(255, 255, 255, 0.6)";
          btnOff.style.textShadow = "none";
        } else {
          btnOff.style.background = "rgba(223, 183, 108, 0.15)";
          btnOff.style.borderColor = "#dfb76c";
          btnOff.style.color = "#dfb76c";
          btnOff.style.textShadow = "0 0 6px rgba(223, 183, 108, 0.4)";

          btnOn.style.background = "rgba(255, 255, 255, 0.05)";
          btnOn.style.borderColor = "rgba(255, 255, 255, 0.2)";
          btnOn.style.color = "rgba(255, 255, 255, 0.6)";
          btnOn.style.textShadow = "none";
        }
      };
      window.updateTaauUI = window.updateFxaaUI;
      setTimeout(() => {
        if (typeof window.updateFxaaUI === "function") window.updateFxaaUI();
      }, 0);

      // Event delegation fallback to guarantee clicks always work
      document.addEventListener("click", (e) => {
        const onBtn = e.target && e.target.closest && (e.target.closest("#fxaaToggleOn") || e.target.closest("#taauToggleOn"));
        if (onBtn) {
          if (typeof fxaaEnabled !== "undefined") fxaaEnabled = true;
          if (typeof taauEnabled !== "undefined") taauEnabled = true;
          window.fxaaEnabled = true;
          window.taauEnabled = true;
          try {
            const opt = JSON.parse(localStorage.getItem("seedplanet_options_config") || "{}");
            opt.fxaaEnabled = true;
            opt.taauEnabled = true;
            localStorage.setItem("seedplanet_options_config", JSON.stringify(opt));
          } catch(err) {}
          if (typeof window.updateFxaaUI === "function") window.updateFxaaUI();
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          else if (typeof window.saveSettingsToLocalStorage === "function") window.saveSettingsToLocalStorage();
          return;
        }
        const offBtn = e.target && e.target.closest && (e.target.closest("#fxaaToggleOff") || e.target.closest("#taauToggleOff"));
        if (offBtn) {
          if (typeof fxaaEnabled !== "undefined") fxaaEnabled = false;
          if (typeof taauEnabled !== "undefined") taauEnabled = false;
          window.fxaaEnabled = false;
          window.taauEnabled = false;
          try {
            const opt = JSON.parse(localStorage.getItem("seedplanet_options_config") || "{}");
            opt.fxaaEnabled = false;
            opt.taauEnabled = false;
            localStorage.setItem("seedplanet_options_config", JSON.stringify(opt));
          } catch(err) {}
          if (typeof window.updateFxaaUI === "function") window.updateFxaaUI();
          if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
          else if (typeof window.saveSettingsToLocalStorage === "function") window.saveSettingsToLocalStorage();
          return;
        }
      });


      // ฟังก์ชันระบบเต็มจอแบบครอบคลุมรอบด้าน
      function toggleFullscreen() {
        const tWindow = getTauriWindow();
        if (tWindow && typeof tWindow.isFullscreen === "function" && typeof tWindow.setFullscreen === "function") {
          tWindow.isFullscreen()
            .then((isFull) => {
              tWindow.setFullscreen(!isFull).then(() => {
                setTimeout(syncScreenModeUI, 100);
              });
            })
            .catch((err) => {
              console.warn("Tauri Fullscreen error:", err);
            });
          return;
        }

        const doc = window.document;
        const docEl = doc.documentElement;

        const requestFullScreen =
          docEl.requestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.webkitRequestFullScreen ||
          docEl.msRequestFullscreen;
        const cancelFullScreen =
          doc.exitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.webkitExitFullscreen ||
          doc.msExitFullscreen;

        if (
          !doc.fullscreenElement &&
          !doc.mozFullScreenElement &&
          !doc.webkitFullscreenElement &&
          !doc.msFullscreenElement
        ) {
          if (requestFullScreen) {
            try {
              const res = requestFullScreen.call(docEl);
              if (res && typeof res.then === "function") {
                res.then(() => {
                  if (navigator.keyboard && navigator.keyboard.lock) {
                    navigator.keyboard
                      .lock(["Escape"])
                      .catch((e) => console.log("Keyboard lock failed", e));
                  }
                })
                .catch((err) => {
                  console.warn("Fullscreen request failed safely:", err);
                });
              }
            } catch (err) {
              console.warn("Fullscreen request error caught:", err);
            }
          }
          } else {
          if (cancelFullScreen) {
            cancelFullScreen.call(doc);
          }
        }
      }

      const fullscreenBtn = document.getElementById("fullscreenBtn");
      if (fullscreenBtn) {
        fullscreenBtn?.addEventListener("click", () => {
          initAudio();
          toggleFullscreen();
        });
      }

      const gameplayFullscreenBtn = document.getElementById("gameplayFullscreenBtn");
      if (gameplayFullscreenBtn) {
        gameplayFullscreenBtn?.addEventListener("click", () => {
          initAudio();
          toggleFullscreen();
        });
      }


      function updateDemolishBanner() {
        let banner = document.getElementById("demolishModeBanner");
        if (banner) {
          banner.style.display = "none";
          banner.remove();
        }
      }

      function updateTerrainModBanner() {
        let prompt = document.getElementById("interactPrompt");
        if (prompt && !isTerrainModModeEnabled) {
          prompt.style.display = "none";
        }
      }

      canvas?.addEventListener("mousedown", (e) => {
        initAudio();
        const isPointerLocked = (document.pointerLockElement === canvas || window.simulatedPointerLock);
        if (!isPointerLocked && gameStarted && e.button === 0) {
          requestPointerLockSafe();
        }
        if ((e.button === 0 || e.button === 2) && isPointerLocked) {
          const isAltAction = (e.button === 2);
          if (e.button === 0) {
              isActionDown = true;
          }
          const holdingShovelOrPickaxe = (selectedActionSlotIndex !== -1 && actionSlotsItems[selectedActionSlotIndex] && (actionSlotsItems[selectedActionSlotIndex].name === "SHOVEL" || actionSlotsItems[selectedActionSlotIndex].name === "PICKAXE"));
          
          if (holdingShovelOrPickaxe) {
            if (!isUsingItem || (activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON") && arrowShotInCurrentAnim && useAnimTimer <= (bowHoldArmTimer - bowSpamClickDelay))) {
              const item = actionSlotsItems[selectedActionSlotIndex];
              useItem(item, selectedActionSlotIndex, "action", isAltAction);
            }
          } else if (isTerrainModModeEnabled) {
            if (!isAltAction) {
              modTerrainAtPlayer(-0.35, true);
            } else {
              modTerrainAtPlayer(0.35, true);
            }
          } else if (isDemolishModeEnabled) {
            if (!isAltAction) {
                // Demolish the item targeted by the 3D crosshair (First-Hit Raycast)!
                const target = window.activeDemolishTarget;
                if (target && target.active && !target.isPreview) {
                  if (target.type !== "stone_floor") {
                    tryDemolishItem(target);
                    window.activeDemolishTarget = null;
                  }
                }
            }
          } else if (isPlacingFloor) {
            if (!isAltAction) placeFloor();
          } else if (!isUsingItem || (activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON") && arrowShotInCurrentAnim && useAnimTimer <= (bowHoldArmTimer - bowSpamClickDelay))) {
             if (selectedActionSlotIndex !== -1 && actionSlotsItems[selectedActionSlotIndex]) {
               const item = actionSlotsItems[selectedActionSlotIndex];
               if (isAltAction) {
                 if (item.name === "WOODEN_ARM_CANNON" || item.name === "ARM_CANNON") {
                   if (typeof switchCannonAmmo === "function") switchCannonAmmo();
                   else if (typeof window.switchCannonAmmo === "function") window.switchCannonAmmo();
                 } else if (item.name !== "SHOVEL" && item.name !== "PICKAXE") {
                   // Do nothing for other items on right click
                 } else {
                   useItem(item, selectedActionSlotIndex, "action", isAltAction);
                 }
               } else {
                 useItem(item, selectedActionSlotIndex, "action", isAltAction);
               }
             } else if (isAltAction) {
               // Empty hand right click: do nothing (terrain modification disabled)
             } else if (!isAltAction) {
               performSmashAction();
               smashInterval = setInterval(performSmashAction, 600);
             }
          }
        }
        isDragging = true;
        if (typeof isInteractiveTouchTarget === "function" && isInteractiveTouchTarget(e.target)) {
          window.isCameraDragging = false;
        } else if (typeof getInteractiveTarget === "function" && getInteractiveTarget(e.target)) {
          window.isCameraDragging = false;
        } else {
          window.isCameraDragging = true;
        }
        if (typeof window.updateVirtualCursorVisibility === "function") {
          window.updateVirtualCursorVisibility();
        }
        prevX = e.clientX;
        prevY = e.clientY;
      });

      window.addEventListener("mousemove", (e) => {
        const isPointerLocked = (document.pointerLockElement === canvas || window.simulatedPointerLock);
        const isCursorHidden = !!window.isVirtualCursorManualHidden;

        let dx = 0;
        let dy = 0;

        if (isPointerLocked) {
          dx = e.movementX || 0;
          dy = e.movementY || 0;
        } else {
          dx = (typeof prevX !== "undefined") ? (e.clientX - prevX) : 0;
          dy = (typeof prevY !== "undefined") ? (e.clientY - prevY) : 0;
          prevX = e.clientX;
          prevY = e.clientY;
        }

        const isDev = (typeof isDevMode !== "undefined" && isDevMode) || (typeof window.isDevMode !== "undefined" && window.isDevMode);
        const isDevTouchTest = isDev && (window.devInputMode === "touch");

        if (window.cameraMode === "freecam" || (typeof cameraSpringArm !== "undefined" && cameraSpringArm && cameraSpringArm.mode === "freecam")) {
          if (isDragging || isPointerLocked || isCursorHidden || isDevTouchTest) {
            if (isDevTouchTest && !window.isCameraDragging) return;
            if (typeof window.freeCamYaw !== "number") window.freeCamYaw = 0.0;
            if (typeof window.freeCamPitch !== "number") window.freeCamPitch = 0.0;
            window.freeCamYaw -= dx * 0.005 * mouseSensitivity;
            window.freeCamPitch += dy * 0.005 * mouseSensitivity;
            window.freeCamPitch = Math.max(-1.52, Math.min(1.52, window.freeCamPitch));
          }
          return;
        }

        if (isDevTouchTest) {
          if (!isDragging || !window.isCameraDragging) return;
        } else {
          // Only rotate camera when mouse cursor is hidden (Alt toggle)
          if (!isCursorHidden) return;
        }

        if (typeof isUIOpen === "function" && isUIOpen()) return;

        const isAimingLockedBow = isUsingItem && activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON") && activeTargetNPC;
        if (!isAimingLockedBow) {
          rotationY -= dx * 0.007 * mouseSensitivity;
          rotationX += dy * 0.007 * mouseSensitivity;
          const maxPitch = (typeof cameraMode !== "undefined" && (cameraMode === "sun" || cameraMode === "overview" || cameraMode === "freecam")) ? 1.45 : 1.2;
          const minPitch = (typeof cameraMode !== "undefined" && (cameraMode === "sun" || cameraMode === "overview" || cameraMode === "freecam")) ? -0.55 : -0.55;
          rotationX = Math.max(minPitch, Math.min(maxPitch, rotationX));

          window.rotationY = rotationY;
          window.rotationX = rotationX;
        }
      });

      window.addEventListener("mouseup", (e) => {
        if (e.button === 0) {
          isActionDown = false;
          if (smashInterval) {
            clearInterval(smashInterval);
            smashInterval = null;
            // Ensure state resets
            isUsingItem = false;
            isSmashing = false;
            activeItem = originalItem;
          }
        }
        isDragging = false;
        window.isCameraDragging = false;
        if (typeof window.updateVirtualCursorVisibility === "function") {
          window.updateVirtualCursorVisibility();
        }
      });


      // ============================================
      // Slots Touch Virtual Buttons Simulation (Q, E, R-Click, L-Click)
      // ============================================

      function setupTouchButton(btnId, downFn, upFn) {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        let isPressed = false;

        const handleDown = (e) => {
          if (window.isConfirmOverlayOpen) return;
          initAudio();
          e.preventDefault();
          if (isPressed) return;
          isPressed = true;
          btn.classList.add("active");
          downFn();
        };

        const handleUp = (e) => {
          if (window.isConfirmOverlayOpen) return;
          e.preventDefault();
          if (!isPressed) return;
          isPressed = false;
          btn.classList.remove("active");
          upFn();
        };

        btn?.addEventListener("touchstart", handleDown, { passive: false });
        btn?.addEventListener("touchend", handleUp, { passive: false });
        btn?.addEventListener("touchcancel", handleUp, { passive: false });

        btn?.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          handleDown(e);
        });
        
        const mouseUpWindow = (e) => {
          if (isPressed) {
            handleUp(e);
          }
        };
        window.addEventListener("mouseup", mouseUpWindow);
        btn?.addEventListener("mouseleave", handleUp);
      }

      // 1. Q Button (Rotate / Swim Up in water / Fly when riding winged boat)
      let activeCodeQ = null;
      setupTouchButton(
        "btnTouchQ",
        () => {
          const isWingBoat = !!(typeof activeRidingBoat !== 'undefined' && activeRidingBoat && (activeRidingBoat.hasWing || activeRidingBoat.hasWings));
          const inWater = (typeof currentSwimFactor !== 'undefined' && currentSwimFactor > 0.0);
          activeCodeQ = (isWingBoat || inWater) ? "ShiftLeft" : "KeyQ";
          if (isWingBoat) window.boatFlyButtonHeld = true;
          window.dispatchEvent(new KeyboardEvent("keydown", { code: activeCodeQ, bubbles: true }));
        },
        () => {
          window.boatFlyButtonHeld = false;
          const codeToRelease = activeCodeQ || "KeyQ";
          window.dispatchEvent(new KeyboardEvent("keyup", { code: codeToRelease, bubbles: true }));
          activeCodeQ = null;
        }
      );

      // 2. E Button (Interact / Dive Down in water)
      let activeCodeE = null;
      setupTouchButton(
        "btnTouchE",
        () => {
          const prompt = document.getElementById("interactPrompt");
          const npcPrompt = document.getElementById("npcKillPrompt");
          const isTerrainMod = (typeof isTerrainModModeEnabled !== 'undefined' && isTerrainModModeEnabled);
          const isDemolish = (typeof isDemolishModeEnabled !== 'undefined' && isDemolishModeEnabled);
          const hasActionReach = !!(
            (prompt && prompt.style.display === "block" && !isTerrainMod && !isDemolish) || 
            (npcPrompt && npcPrompt.style.display === "block")
          );

          const inWater = (typeof currentSwimFactor !== 'undefined' && currentSwimFactor > 0.0);
          const isFlyingBoat = !!(typeof activeRidingBoat !== 'undefined' && activeRidingBoat && activeRidingBoat.isFlying);
          activeCodeE = ((inWater || isFlyingBoat) && !hasActionReach) ? "KeyZ" : "KeyE";
          if (isFlyingBoat) window.boatDiveButtonHeld = true;
          window.dispatchEvent(new KeyboardEvent("keydown", { code: activeCodeE, bubbles: true }));
        },
        () => {
          window.boatDiveButtonHeld = false;
          const codeToRelease = activeCodeE || "KeyE";
          window.dispatchEvent(new KeyboardEvent("keyup", { code: codeToRelease, bubbles: true }));
          activeCodeE = null;
        }
      );

      // 3. Right Click Button (Alt Action / Dig / Fill)
      setupTouchButton(
        "btnTouchRightClick",
        () => {
          simulatedPointerLock = true;
          const e = new MouseEvent("mousedown", { button: 2, bubbles: true });
          e.simulated = true;
          canvas.dispatchEvent(e);
        },
        () => {
          const e = new MouseEvent("mouseup", { button: 2, bubbles: true });
          e.simulated = true;
          window.dispatchEvent(e);
          simulatedPointerLock = false;
        }
      );

      // 4. Left Click Button (Main Action / Smash)
      setupTouchButton(
        "btnTouchLeftClick",
        () => {
          simulatedPointerLock = true;
          const e = new MouseEvent("mousedown", { button: 0, bubbles: true });
          e.simulated = true;
          canvas.dispatchEvent(e);
        },
        () => {
          const e = new MouseEvent("mouseup", { button: 0, bubbles: true });
          e.simulated = true;
          window.dispatchEvent(e);
          simulatedPointerLock = false;
        }
      );

      // ============================================
      // Dynamic Swim State Monitoring for Touch Buttons (Q -> Shift, E -> Z)
      // ============================================
      let lastInWaterState = false;
      let lastHasActionReach = false;
      function updateTouchButtonsForWaterState() {
        const inWater = (typeof currentSwimFactor !== 'undefined' && currentSwimFactor > 0.0);
        const prompt = document.getElementById("interactPrompt");
        const npcPrompt = document.getElementById("npcKillPrompt");
        const isTerrainMod = (typeof isTerrainModModeEnabled !== 'undefined' && isTerrainModModeEnabled);
        const isDemolish = (typeof isDemolishModeEnabled !== 'undefined' && isDemolishModeEnabled);
        const hasActionReach = !!(
          (prompt && prompt.style.display === "block" && !isTerrainMod && !isDemolish) || 
          (npcPrompt && npcPrompt.style.display === "block")
        );

        const isWingBoat = !!(typeof activeRidingBoat !== 'undefined' && activeRidingBoat && (activeRidingBoat.hasWing || activeRidingBoat.hasWings));
        const isGp = (typeof isCurrentlyGamepadMode === 'function' ? isCurrentlyGamepadMode() : !!(window.isUsingGamepad && window.GamepadController && window.GamepadController.connected));
        const gpBrand = (window.GamepadController && typeof window.GamepadController.getBrand === 'function') ? window.GamepadController.getBrand() : 'xbox';

        if (inWater !== lastInWaterState || hasActionReach !== lastHasActionReach || isWingBoat !== window._lastIsWingBoatState || isGp !== window._lastIsGpState || gpBrand !== window._lastGpBrandState) {
          lastInWaterState = inWater;
          lastHasActionReach = hasActionReach;
          window._lastIsWingBoatState = isWingBoat;
          window._lastIsGpState = isGp;
          window._lastGpBrandState = gpBrand;

          const btnQKey = document.querySelector("#btnTouchQ .touch-btn-key");
          const btnQLabel = document.querySelector("#btnTouchQ .touch-btn-label");
          const btnEKey = document.querySelector("#btnTouchE .touch-btn-key");
          const btnELabel = document.querySelector("#btnTouchE .touch-btn-label");
          const btnRCKey = document.querySelector("#btnTouchRightClick .touch-btn-key");
          const btnRCLabel = document.querySelector("#btnTouchRightClick .touch-btn-label");
          const btnLCKey = document.querySelector("#btnTouchLeftClick .touch-btn-key");
          const btnLCLabel = document.querySelector("#btnTouchLeftClick .touch-btn-label");
          const btnQIcon = document.getElementById("btnTouchQIcon");
          const btnEIcon = document.getElementById("btnTouchEIcon");

          const gpCtrl = window.GamepadController;

          if (isGp && gpCtrl && typeof gpCtrl.getButtonLabel === 'function') {
            // Controller Brand UI Buttons (PlayStation: L1/R1/L2/R2, Xbox: LB/RB/LT/RT, Switch: L/R/ZL/ZR)
            if (isWingBoat) {
              if (btnQKey) btnQKey.textContent = gpCtrl.getButtonLabel("flightThrottle");
              if (btnQLabel) btnQLabel.textContent = "เร่งเครื่อง/Fly";
              if (btnQIcon) btnQIcon.innerHTML = `<span style="font-size: 16px; line-height: 1;">🪽</span>`;
            } else if (inWater) {
              if (btnQKey) btnQKey.textContent = gpCtrl.getButtonLabel("swimUp");
              if (btnQLabel) btnQLabel.textContent = "ว่ายขึ้น/Up";
              if (btnQIcon) {
                btnQIcon.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                  </svg>
                `;
              }
            } else {
              if (btnQKey) btnQKey.textContent = gpCtrl.getButtonLabel("rotate");
              if (btnQLabel) btnQLabel.textContent = "หมุน/Rotate";
              if (btnQIcon) {
                btnQIcon.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                  </svg>
                `;
              }
            }

            if (inWater && !hasActionReach) {
              if (btnEKey) btnEKey.textContent = gpCtrl.getButtonLabel("swimDown");
              if (btnELabel) btnELabel.textContent = "ดำน้ำ/Down";
              if (btnEIcon) {
                btnEIcon.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                  </svg>
                `;
              }
            } else {
              if (btnEKey) btnEKey.textContent = gpCtrl.getButtonLabel("interact");
              if (btnELabel) btnELabel.textContent = "สำรวจ/ขี่";
              if (btnEIcon) {
                btnEIcon.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 11V3a2 2 0 1 1 4 0v8h1a2 2 0 0 1 2 2v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2a2 2 0 0 1 2-2h1V7a2 2 0 1 1 4 0v4h2z"/>
                  </svg>
                `;
              }
            }

            if (btnRCKey) btnRCKey.textContent = gpCtrl.getButtonLabel("dig");
            if (btnRCLabel) btnRCLabel.textContent = "ขุด-ถม/ดิน";
            if (btnLCKey) btnLCKey.textContent = gpCtrl.getButtonLabel("attack");
            if (btnLCLabel) btnLCLabel.textContent = "โจมตี-ใช้";
          } else {
            // Standard Keyboard / Mouse Buttons
            if (isWingBoat) {
              if (btnQKey) btnQKey.textContent = "Shift";
              if (btnQLabel) btnQLabel.textContent = "บิน/Fly";
              if (btnQIcon) {
                btnQIcon.innerHTML = `<span style="font-size: 16px; line-height: 1;">🪽</span>`;
              }
            } else if (inWater) {
              if (btnQKey) btnQKey.textContent = "Shift";
              if (btnQLabel) btnQLabel.textContent = "ว่ายขึ้น/Up";
              if (btnQIcon) {
                btnQIcon.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                  </svg>
                `;
              }
            } else {
              if (btnQKey) btnQKey.textContent = "Q";
              if (btnQLabel) btnQLabel.textContent = "หมุน/Rotate";
              if (btnQIcon) {
                btnQIcon.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                  </svg>
                `;
              }
            }

            if (inWater && !hasActionReach) {
              if (btnEKey) btnEKey.textContent = "Z";
              if (btnELabel) btnELabel.textContent = "ดำน้ำ/Down";
              if (btnEIcon) {
                btnEIcon.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                  </svg>
                `;
              }
            } else {
              if (btnEKey) btnEKey.textContent = "E";
              if (btnELabel) btnELabel.textContent = "เก็บ/คุย";
              if (btnEIcon) {
                btnEIcon.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 11V3a2 2 0 1 1 4 0v8h1a2 2 0 0 1 2 2v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2a2 2 0 0 1 2-2h1V7a2 2 0 1 1 4 0v4h2z"/>
                  </svg>
                `;
              }
            }

            if (btnRCKey) btnRCKey.textContent = "R-Click";
            if (btnRCLabel) btnRCLabel.textContent = "ขุด-ถม/ขวา";
            if (btnLCKey) btnLCKey.textContent = "L-Click";
            if (btnLCLabel) btnLCLabel.textContent = "ตี-ใช้/ซ้าย";
          }
        }
      }
      
      setInterval(updateTouchButtonsForWaterState, 300);


      // ============================================
      // UI Controls
      // ============================================
      const sizeInput = document.getElementById("sizeInput");
      const sizeDisplay = document.getElementById("sizeDisplay");
      const radiusInput = document.getElementById("radiusInput");
      const radiusDisplay = document.getElementById("radiusDisplay");
      const randomBtn = document.getElementById("randomBtn");
      const randomCubesBtn = document.getElementById("randomCubesBtn");
      const randomNatureBtn = document.getElementById("randomNatureBtn");
      const devInputModeToggle = document.getElementById("devInputModeToggle");
      const hitboxToggle = document.getElementById("hitboxToggle");
      const frustumCullingToggle = document.getElementById("frustumCullingToggle");
      const caveWaterToggle = document.getElementById("caveWaterToggle");
      const colliderDistSlider = document.getElementById("colliderDist");
      const uiMarginDistSlider = document.getElementById("uiMarginDist");
      const uiMarginLabel = document.getElementById("uiMarginLabel");
      const colliderDistLabel = document.getElementById("colliderDistLabel");
      const actionReachDistSlider = document.getElementById("actionReachDist");
      const actionReachLabel = document.getElementById("actionReachLabel");
      const actionReachToggle = document.getElementById("actionReachToggle");
      const actionReachModeSelect = document.getElementById("actionReachModeSelect");
      const bowHoldArmSlider = document.getElementById("bowHoldArmSlider");
      const bowHoldArmLabel = document.getElementById("bowHoldArmLabel");
      const bowSpamClickDelaySlider = document.getElementById("bowSpamClickDelaySlider");
      const bowSpamClickDelayLabel = document.getElementById("bowSpamClickDelayLabel");
      const bowLockDistanceSlider = document.getElementById("bowLockDistanceSlider");
      const bowLockDistanceLabel = document.getElementById("bowLockDistanceLabel");
      const woodFloorHeightSlider = document.getElementById("woodFloorHeightSlider");
      const woodFloorHeightLabel = document.getElementById("woodFloorHeightLabel");
      const campfireSizeSlider = document.getElementById("campfireSizeSlider");
      const campfireSizeLabel = document.getElementById("campfireSizeLabel");
      const voxelHoleRadiusSlider = document.getElementById("voxelHoleRadiusSlider");
      const voxelHoleRadiusLabel = document.getElementById("voxelHoleRadiusLabel");
      const waterToggle = document.getElementById("waterToggle");
      const waterLevelSlider = document.getElementById("waterLevel");
      const waterLevelLabel = document.getElementById("waterLevelLabel");
      const waterOpacitySlider = document.getElementById("waterOpacity");
      const waterOpacityLabel = document.getElementById("waterOpacityLabel");
      const waveStrengthSlider = document.getElementById("waveStrength");
      const waveStrengthLabel = document.getElementById("waveStrengthLabel");
      const waterColorPicker = document.getElementById("waterColor");

      const atmosphereToggle = document.getElementById("atmosphereToggle");
      const atmosphereAlphaSlider = document.getElementById("atmosphereAlpha");
      const atmosphereAlphaLabel = document.getElementById(
        "atmosphereAlphaLabel",
      );
      const atmosphereScaleSlider = document.getElementById("atmosphereScale");
      const atmosphereScaleLabel = document.getElementById(
        "atmosphereScaleLabel",
      );
      const atmosphereColorPicker = document.getElementById("atmosphereColor");

      const godRaysToggle = document.getElementById("godRaysToggle");
      const godRaysAlphaSlider = document.getElementById("godRaysAlpha");
      const godRaysAlphaLabel = document.getElementById("godRaysAlphaLabel");
      const godRaysCountSlider = document.getElementById("godRaysCount");
      const godRaysCountLabel = document.getElementById("godRaysCountLabel");
      const godRaysColorPicker = document.getElementById("godRaysColor");

      const skyToggle = document.getElementById("skyToggle");
      const skyGasIntensitySlider = document.getElementById("skyGasIntensity");
      const skyGasIntensityLabel = document.getElementById(
        "skyGasIntensityLabel",
      );

      const cloudsToggle = document.getElementById("cloudsToggle");
      const cloudsAlphaSlider = document.getElementById("cloudsAlpha");
      const cloudsAlphaLabel = document.getElementById("cloudsAlphaLabel");
      const cloudsHeightSlider = document.getElementById("cloudsHeight");
      const cloudsHeightLabel = document.getElementById("cloudsHeightLabel");
      const cloudsThicknessSlider = document.getElementById("cloudsThickness");
      const cloudsThicknessLabel = document.getElementById(
        "cloudsThicknessLabel",
      );
      const cloudsSpeedSlider = document.getElementById("cloudsSpeed");
      const cloudsSpeedLabel = document.getElementById("cloudsSpeedLabel");
      const cloudsShapeSlider = document.getElementById("cloudsShape");
      const cloudsShapeLabel = document.getElementById("cloudsShapeLabel");
      const cloudsColorPicker = document.getElementById("cloudsColor");

      const charSpeedSlider = document.getElementById("charSpeed");
      const charSpeedLabel = document.getElementById("charSpeedLabel");
      const charScaleSlider = document.getElementById("charScale");
      const charScaleLabel = document.getElementById("charScaleLabel");

      const leafSwaySlider = document.getElementById("leafSway");
      const leafSwayLabel = document.getElementById("leafSwayLabel");
      const waterSwaySlider = document.getElementById("waterSway");
      const waterSwayLabel = document.getElementById("waterSwayLabel");

      const renderDistToggle = document.getElementById("renderDistToggle");
      const terrainRenderDistSlider = document.getElementById("terrainRenderDist") || document.getElementById("renderDist");
      const terrainRenderDistLabel = document.getElementById("terrainRenderDistLabel") || document.getElementById("renderDistLabel");
      const objectRenderDistSlider = document.getElementById("objectRenderDist");
      const objectRenderDistLabel = document.getElementById("objectRenderDistLabel");

      const charFpsSlider = document.getElementById("charFps");
      const charFpsLabel = document.getElementById("charFpsLabel");
      const waterFpsSlider = document.getElementById("waterFps");
      const waterFpsLabel = document.getElementById("waterFpsLabel");
      const leafFpsSlider = document.getElementById("leafFps");
      const leafFpsLabel = document.getElementById("leafFpsLabel");
      const cloudFpsSlider = document.getElementById("cloudFps");
      const cloudFpsLabel = document.getElementById("cloudFpsLabel");

      const playerFootstepVolumeSlider = document.getElementById(
        "playerFootstepVolumeSlider",
      );
      const playerFootstepVolumeVal = document.getElementById(
        "playerFootstepVolumeVal",
      );
      const playerSwimVolumeSlider = document.getElementById(
        "playerSwimVolumeSlider",
      );
      const playerSwimVolumeVal = document.getElementById(
        "playerSwimVolumeVal",
      );
      const collectSfxVolumeSlider = document.getElementById(
        "collectSfxVolumeSlider",
      );
      const collectSfxVolumeVal = document.getElementById(
        "collectSfxVolumeVal",
      );
      const npcSfxVolumeSlider = document.getElementById("npcSfxVolumeSlider");
      const npcSfxVolumeVal = document.getElementById("npcSfxVolumeVal");

      function updatePlanet() {
        let val = parseInt(sizeInput.value);
        if (isNaN(val) || val < 25) val = 25;
        if (val > 3200) val = 3200;

        const warningEl = document.querySelector(".warning");
        if (val > 1000) {
          warningEl.textContent =
            "⚠️ ขนาดใหญ่มาก (" + val + "x" + val + ") อาจทำให้เครื่องช้าลง";
          warningEl.style.color = "#ff6600";
        } else if (val > 500) {
          warningEl.textContent =
            "⚠️ ขนาดใหญ่ (" + val + "x" + val + ") อาจทำให้เครื่องช้าลง";
          warningEl.style.color = "#ffaa00";
        } else {
          warningEl.textContent = "✅ ขนาดเหมาะสม";
          warningEl.style.color = "#66ff66";
        }

        sizeInput.value = val;
        sizeDisplay.textContent = val + " x " + val;
        currentGridSize = val;
        
        RADIUS = val / 50.0;
        if (radiusInput) radiusInput.value = RADIUS.toFixed(2);
        if (radiusDisplay) radiusDisplay.textContent = RADIUS.toFixed(2);

        buildPlanet(currentGridSize, globalSeed);
        console.log(
          "📐 ขนาด:",
          currentGridSize,
          "x",
          currentGridSize,
          "| RADIUS:",
          RADIUS.toFixed(2),
          "| seed:",
          globalSeed,
        );
      }

      const RADIUS_PRESETS = [32, 64, 96, 128, 160];

      function updateRadiusButtonStates() {
        document.querySelectorAll(".btn-radius-preset").forEach((btn) => {
          const r = parseFloat(btn.dataset.radius);
          if (Math.abs(r - RADIUS) < 0.1) {
            btn.style.background = "#dfb76c";
            btn.style.color = "#000";
            btn.style.borderColor = "#dfb76c";
            btn.style.fontWeight = "bold";
          } else {
            btn.style.background = "rgba(0,0,0,0.6)";
            btn.style.color = "#dfb76c";
            btn.style.borderColor = "rgba(223,183,108,0.3)";
            btn.style.fontWeight = "normal";
          }
        });
      }
      window.updateRadiusButtonStates = updateRadiusButtonStates;

      document.querySelectorAll(".btn-radius-preset").forEach((btn) => {
        btn.addEventListener("click", () => {
          const r = parseFloat(btn.dataset.radius);
          if (r) {
            if (typeof window.updatePlanetRadiusAndHeightScale === "function") {
              window.updatePlanetRadiusAndHeightScale(r);
            } else {
              RADIUS = r;
              HEIGHT_SCALE = 0.6 * Math.pow(r / 8.0, 0.7);
              if (typeof window !== "undefined") {
                window.RADIUS = RADIUS;
                window.HEIGHT_SCALE = HEIGHT_SCALE;
              }
            }
            currentGridSize = Math.max(100, Math.min(1600, Math.round(RADIUS * 12.5)));
            if (radiusInput) radiusInput.value = RADIUS.toFixed(2);
            if (radiusDisplay) radiusDisplay.textContent = RADIUS.toFixed(2);
            if (sizeInput) sizeInput.value = currentGridSize;
            if (sizeDisplay) sizeDisplay.textContent = currentGridSize + " x " + currentGridSize;

            const warningEl = document.querySelector(".warning");
            if (warningEl) {
              warningEl.textContent = "✅ รัศมีดาว " + RADIUS.toFixed(2) + " (Grid: " + currentGridSize + "x" + currentGridSize + ")";
              warningEl.style.color = "#66ff66";
            }

            buildPlanet(currentGridSize, globalSeed);
            console.log("🌍 กำหนดรัศมีดาวเป็น:", RADIUS, "| ขนาด Grid:", currentGridSize, "| HEIGHT_SCALE:", HEIGHT_SCALE.toFixed(2));
            updateRadiusButtonStates();
            saveSettingsToLocalStorage();
          }
        });
      });

      updateRadiusButtonStates();

      sizeInput?.addEventListener("change", updatePlanet);

      sizeInput?.addEventListener("input", () => {
        let val = parseInt(sizeInput.value) || 25;
        if (val < 25) val = 25;
        if (val > 3200) val = 3200;
        sizeDisplay.textContent = val + " x " + val;
        
        let tempRadius = Math.max(8.0, val / 12.5);
        if (radiusInput) radiusInput.value = tempRadius.toFixed(2);
        if (radiusDisplay) radiusDisplay.textContent = tempRadius.toFixed(2);

        const warningEl = document.querySelector(".warning");
        if (val > 800) {
          warningEl.textContent =
            "⚠️ ขนาดใหญ่มาก (" + val + "x" + val + ") อาจทำให้เครื่องช้าลง";
          warningEl.style.color = "#ff6600";
        } else if (val > 400) {
          warningEl.textContent =
            "⚠️ ขนาดใหญ่ (" + val + "x" + val + ") อาจทำให้เครื่องช้าลง";
          warningEl.style.color = "#ffaa00";
        } else {
          warningEl.textContent = "✅ ขนาดเหมาะสม";
          warningEl.style.color = "#66ff66";
        }
      });

      radiusInput?.addEventListener("input", () => {
        let val = parseFloat(radiusInput.value) || 8.0;
        radiusDisplay.textContent = val.toFixed(2);
        
        let gSize = Math.round(val * 12.5);
        gSize = Math.max(25, Math.min(3200, gSize));
        
        if (sizeInput) sizeInput.value = gSize;
        if (sizeDisplay) sizeDisplay.textContent = gSize + " x " + gSize;
        updateRadiusButtonStates();
      });

      radiusInput?.addEventListener("change", () => {
        let val = parseFloat(radiusInput.value) || 8.0;
        if (typeof window.updatePlanetRadiusAndHeightScale === "function") {
          window.updatePlanetRadiusAndHeightScale(val);
        } else {
          RADIUS = val;
          HEIGHT_SCALE = 0.6 * Math.pow(val / 8.0, 0.7);
          if (typeof window !== "undefined") {
            window.RADIUS = RADIUS;
            window.HEIGHT_SCALE = HEIGHT_SCALE;
          }
        }

        let gSize = Math.round(val * 12.5);
        currentGridSize = Math.max(25, Math.min(3200, gSize));
        
        if (sizeInput) sizeInput.value = currentGridSize;
        if (sizeDisplay) sizeDisplay.textContent = currentGridSize + " x " + currentGridSize;

        buildPlanet(currentGridSize, globalSeed);
        console.log("🌍 เปลี่ยนรัศมีดาวเป็น:", RADIUS, "| ขนาด Grid:", currentGridSize, "| HEIGHT_SCALE:", HEIGHT_SCALE.toFixed(2));
        updateRadiusButtonStates();
        saveSettingsToLocalStorage();
      });

      randomBtn?.addEventListener("click", () => {
        // สุ่ม RADIUS จากชุด [32, 64, 96, 128, 160] และสเกล Grid กับ Noise ให้เหมาะสม
        const randRadius = RADIUS_PRESETS[Math.floor(Math.random() * RADIUS_PRESETS.length)];
        if (typeof window.updatePlanetRadiusAndHeightScale === "function") {
          window.updatePlanetRadiusAndHeightScale(randRadius);
        } else {
          RADIUS = randRadius;
          HEIGHT_SCALE = 0.6 * Math.pow(randRadius / 8.0, 0.7);
          if (typeof window !== "undefined") {
            window.RADIUS = RADIUS;
            window.HEIGHT_SCALE = HEIGHT_SCALE;
          }
        }
        currentGridSize = Math.max(100, Math.min(1600, Math.round(RADIUS * 12.5)));
        
        if (radiusInput) radiusInput.value = RADIUS.toFixed(2);
        if (radiusDisplay) radiusDisplay.textContent = RADIUS.toFixed(2);
        if (sizeInput) sizeInput.value = currentGridSize;
        if (sizeDisplay) sizeDisplay.textContent = currentGridSize + " x " + currentGridSize;

        // --- ระบบสุ่มสภาพแวดล้อมแบบสุดโต่ง (Extreme Planetary Biome Generator) ---
        let biomeName = "โลกปกติ (Normal)";
        const sampleRatio = Math.max(1.0, Math.pow(RADIUS / 8.0, 1.2));

        if (RADIUS < 8.0) {
          // ดาวขนาดเล็กกว่า 8.0 -> ดาวดวงจันทร์ (Moon)
          window.CURRENT_BIOME = "moon";
          window.DISABLE_ENVIRONMENT = true;
          window.DISABLE_NPCS = true;
          waterLevel = 0.0;
          window.globalTreeCountOverride = 0;
          biomeName = "🌙 ดวงจันทร์หินขรุขระ (Moon / Cratered)";
        } else {
          // ดาวขนาด >= 8.0 มี NPC อยู่เฉพาะบนดาวผู้เล่น
          window.DISABLE_NPCS = false;
          window.DISABLE_ENVIRONMENT = false;
          const biomeRoll = Math.random();

          if (biomeRoll < 0.30) {
            // ดาวน้ำ (Ocean World)
            window.CURRENT_BIOME = "water";
            waterLevel = 8.5;
            window.globalTreeCountOverride = 35;
            biomeName = "🌊 ดาวมหาสมุทร (Ocean World)";
          } else if (biomeRoll < 0.60) {
            // ดาวที่เต็มไปด้วยต้นไม้ พืชหนาทึบ (Jungle World)
            window.CURRENT_BIOME = "jungle";
            waterLevel = 1.2;
            window.globalTreeCountOverride = Math.min(1200, Math.floor(sampleRatio * 320));
            biomeName = "🌴 ดาวป่าดงดิบพืชพรรณเขียวชอุ่ม (Jungle World)";
          } else if (biomeRoll < 0.80) {
            // ดาวทะเลทราย (Desert World)
            window.CURRENT_BIOME = "desert";
            waterLevel = 0.4;
            window.globalTreeCountOverride = 0;
            biomeName = "🏜️ ดาวทะเลทรายเวิ้งว้าง (Desert World)";
          } else {
            // ดาวโลกปกติ (Normal Earth-like World)
            window.CURRENT_BIOME = "normal";
            waterLevel = 2.0;
            window.globalTreeCountOverride = undefined;
            biomeName = "🌍 ดาวโลกอุดมสมบูรณ์ (Earth-like World)";
          }
        }
        window.waterLevel = waterLevel;
        if (typeof window.clearCache === "function") window.clearCache();

        const warningEl = document.querySelector(".warning");
        if (warningEl) {
          warningEl.textContent = "✨ สุ่มดาว: " + biomeName + " | รัศมี " + RADIUS.toFixed(2);
          warningEl.style.color = "#66ff66";
        }

        globalSeed = Math.floor(Math.random() * 100000);
        buildPlanet(currentGridSize, globalSeed);
        updateRadiusButtonStates();
        console.log(
          "🎲 สุ่มดาวสุดโต่งใหม่! seed:",
          globalSeed,
          "| BIOME:",
          window.CURRENT_BIOME,
          "| RADIUS:",
          RADIUS.toFixed(2),
          "| ขนาด Grid:",
          currentGridSize,
          "| HEIGHT_SCALE:",
          HEIGHT_SCALE.toFixed(2)
        );
        saveSettingsToLocalStorage();
      });

      randomCubesBtn?.addEventListener("click", () => {
        const count = 30 + Math.floor(Math.random() * 40);
        buildCubes(count, globalSeed);
        console.log("📦 สร้างวัตถุ", count, "ชิ้น");
      });

      randomNatureBtn?.addEventListener("click", async () => {
        const count = 50 + Math.floor(Math.random() * 51);
        await buildNature(count, globalSeed);
        console.log("🌲 สร้างวัตถุธรรมชาติ", count, "ชิ้น");
      });

      function updateSettingsTogglesUI() {
        const onText = typeof t === "function" ? t("on") : "เปิด";
        const offText = typeof t === "function" ? t("off") : "ปิด";
        
        const devInputModeToggle = document.getElementById("devInputModeToggle");
        const screenModeVisibilityToggle = document.getElementById("screenModeVisibilityToggle");
        const hitboxToggle = document.getElementById("hitboxToggle");
        const frustumCullingToggle = document.getElementById("frustumCullingToggle");
        const caveWaterToggle = document.getElementById("caveWaterToggle");
        const actionReachToggle = document.getElementById("actionReachToggle");
        const waterToggle = document.getElementById("waterToggle");
        const renderDistToggle = document.getElementById("renderDistToggle");
        const atmosphereToggle = document.getElementById("atmosphereToggle");
        const godRaysToggle = document.getElementById("godRaysToggle");
        const skyToggle = document.getElementById("skyToggle");
        const cloudsToggle = document.getElementById("cloudsToggle");
        
        if (devInputModeToggle) {
          if (devInputMode === "touch") {
            devInputModeToggle.textContent = "📱 " + (typeof t === "function" ? t("input_touch") : "โหมดอินพุต: จอสัมผัส (Touch)");
          } else if (devInputMode === "keyboard") {
            devInputModeToggle.textContent = "⌨️ " + (typeof t === "function" ? t("input_keyboard") : "โหมดอินพุต: คีย์บอร์ด/เมาส์ (Keyboard/Mouse)");
          } else {
            devInputModeToggle.textContent = "🎮 " + (typeof t === "function" ? t("input_auto") : "โหมดอินพุต: อัตโนมัติ (Auto)");
          }
        }

        if (screenModeVisibilityToggle) {
          const screenModeText = typeof t === "function" ? t("screen_mode") : "โหมดแสดงผล";
          screenModeVisibilityToggle.textContent = `🖥️ ${screenModeText}: ${showScreenModeUI ? onText : offText}`;
        }

        if (hitboxToggle) {
          const hbText = typeof t === "function" ? t("toggle_hitboxes") : "แสดงโครงสร้างการชน (Show Hitboxes)";
          hitboxToggle.textContent = `🟥 ${hbText} ${showHitboxes ? onText : offText}`;
        }

        if (frustumCullingToggle) {
          const fcText = typeof t === "function" ? t("frustum_culling") : "Frustum Culling (คัดออกวัตถุนอกจอ)";
          frustumCullingToggle.textContent = `👁️ ${fcText} ${frustumCullingEnabled ? onText : offText}`;
        }

        if (caveWaterToggle) {
          const cwText = typeof t === "function" ? t("cave_water") : "น้ำในถ้ำ (Cave Water)";
          caveWaterToggle.textContent = `💧 ${cwText} ${caveWaterEnabled ? onText : offText}`;
        }

        if (actionReachToggle) {
          const arText = typeof t === "function" ? t("action_reach") : "แสดงวงระยะทำการ";
          actionReachToggle.textContent = `⚪ ${arText} ${showActionReach ? onText : offText}`;
        }

        if (waterToggle) {
          const wText = typeof t === "function" ? t("water") : "น้ำ";
          waterToggle.textContent = `🌊 ${wText} ${waterEnabled ? onText : offText}`;
        }

        if (renderDistToggle) {
          const rdText = typeof t === "function" ? t("render_dist_limit") : "จำกัดระยะเรนเดอร์";
          renderDistToggle.textContent = `🛡️ ${rdText}: ${renderDistEnabled ? onText : offText}`;
        }

        if (atmosphereToggle) {
          const atText = typeof t === "function" ? t("atmosphere") : "บรรยากาศ";
          atmosphereToggle.textContent = `✨ ${atText} ${atmosphereEnabled ? onText : offText}`;
        }

        if (godRaysToggle) {
          const grText = typeof t === "function" ? t("god_rays") : "ลำแสงเทวทูต (God Rays)";
          godRaysToggle.textContent = `☀️ ${grText} ${godRaysEnabled ? onText : offText}`;
        }

        if (skyToggle) {
          const skyText = typeof t === "function" ? t("space_sky") : "ท้องฟ้าอวกาศ";
          skyToggle.textContent = `🌌 ${skyText} ${skyEnabled ? onText : offText}`;
        }

        if (cloudsToggle) {
          const cloudText = typeof t === "function" ? t("clouds") : "เมฆกลุ่มก๊าซ";
          cloudsToggle.textContent = `☁️ ${cloudText} ${cloudsEnabled ? onText : offText}`;
        }

        const ragdollToggle = document.getElementById("ragdollToggle");
        if (ragdollToggle) {
          const ragText = typeof t === "function" ? t("ragdoll_mode") : "โหมด Ragdoll";
          ragdollToggle.textContent = `🦴 ${ragText}: ${ragdollEnabled ? onText : offText}`;
        }

        const invRagdollToggle = document.getElementById("invRagdollToggle");
        if (invRagdollToggle) {
          invRagdollToggle.textContent = ragdollEnabled ? onText : offText;
        }
      }
      window.updateSettingsTogglesUI = updateSettingsTogglesUI;

      if (devInputModeToggle) {
        devInputModeToggle?.addEventListener("click", () => {
          if (devInputMode === "auto") {
            devInputMode = "touch";
            devInputModeToggle.classList.add("active");
            showDpad();
          } else if (devInputMode === "touch") {
            devInputMode = "keyboard";
            devInputModeToggle.classList.add("active");
            hideDpad();
          } else {
            devInputMode = "auto";
            devInputModeToggle.classList.remove("active");
          }
          updateSettingsTogglesUI();
          window.devInputMode = devInputMode;
          if (typeof window.updateVirtualCursorVisibility === "function") {
            window.updateVirtualCursorVisibility();
          }
        });
      }

      const screenModeVisibilityToggle = document.getElementById("screenModeVisibilityToggle");
      if (screenModeVisibilityToggle) {
        screenModeVisibilityToggle?.addEventListener("click", () => {
          if (typeof showScreenModeUI !== 'undefined') {
            showScreenModeUI = !showScreenModeUI;
            updateSettingsTogglesUI();
            if (typeof window.syncScreenModeUI === 'function') {
              window.syncScreenModeUI();
            }
          }
        });
      }
      hitboxToggle?.addEventListener("click", () => {
        showHitboxes = !showHitboxes;
        updateSettingsTogglesUI();
        if (typeof buildHitboxes === "function") {
           buildHitboxes();
        }
      });

      frustumCullingToggle?.addEventListener("click", () => {
        frustumCullingEnabled = !frustumCullingEnabled;
        frustumCullingToggle.classList.toggle("active", frustumCullingEnabled);
        updateSettingsTogglesUI();
      });

      caveWaterToggle?.addEventListener("click", () => {
        caveWaterEnabled = !caveWaterEnabled;
        caveWaterToggle.classList.toggle("active", caveWaterEnabled);
        updateSettingsTogglesUI();
        if (typeof saveSettingsToLocalStorage === "function") {
          saveSettingsToLocalStorage();
        }
      });

      if (uiMarginDistSlider) {
        uiMarginDistSlider.value = uiMargin;
        const updateUIMargins = () => {
          uiMargin = parseInt(uiMarginDistSlider.value);
          const margin = uiMargin;
          if (uiMarginLabel) uiMarginLabel.textContent = margin;
          const topLeftMenu = document.querySelector(".top-left-menu");
          const mainControls = document.querySelector(".controls");
          const joystickContainer = document.querySelector(".joystick-container");
          const actionSlots = document.querySelector(".action-slots");
          const toggleControlsBtn = document.getElementById("toggleControlsBtn");
          const devByNskLink = document.getElementById("devByNskLink");
          const compassContainer = document.getElementById("compassContainer");
          const gameplayFullscreenBtn = document.getElementById("gameplayFullscreenBtn");

          document.documentElement.style.setProperty("--ui-margin", margin + "px");
          if (topLeftMenu) { topLeftMenu.style.top = margin + "px"; topLeftMenu.style.left = margin + "px"; }
          if (mainControls) { mainControls.style.top = (margin > 0 ? margin + 35 : 45) + "px"; mainControls.style.right = margin + "px"; }
          if (toggleControlsBtn) { toggleControlsBtn.style.top = margin + "px"; toggleControlsBtn.style.right = margin + "px"; }
          if (joystickContainer) { joystickContainer.style.bottom = margin + "px"; joystickContainer.style.left = margin + "px"; }
          if (actionSlots) { actionSlots.style.bottom = margin + "px"; actionSlots.style.right = margin + "px"; }
          if (devByNskLink) { devByNskLink.style.bottom = margin + "px"; devByNskLink.style.right = margin + "px"; }
          if (compassContainer) { compassContainer.style.top = (margin + 10) + "px"; }
          if (gameplayFullscreenBtn) {
            if (isMobileOrTouchDevice()) {
              gameplayFullscreenBtn.style.setProperty("display", "none", "important");
            } else {
              gameplayFullscreenBtn.style.setProperty("display", "flex", "important");
              gameplayFullscreenBtn.style.top = (margin + 10) + "px";
              gameplayFullscreenBtn.style.right = (margin + 10) + "px";
            }
          }
        };

        uiMarginDistSlider?.addEventListener("input", () => {
          updateUIMargins();
        });
        updateUIMargins();
      }
      if (colliderDistSlider) {
        colliderDistSlider?.addEventListener("input", () => {
          maxColliderDistance = parseFloat(colliderDistSlider.value);
          if (colliderDistLabel) colliderDistLabel.textContent = maxColliderDistance.toFixed(2);
        });
      }

      if (actionReachDistSlider) {
        actionReachDistSlider?.addEventListener("input", () => {
          actionReachDistance = parseFloat(actionReachDistSlider.value);
          if (actionReachLabel) actionReachLabel.textContent = actionReachDistance.toFixed(2);
        });
      }

      if (actionReachToggle) {
        actionReachToggle?.addEventListener("click", () => {
          showActionReach = !showActionReach;
          actionReachToggle.textContent = showActionReach ? "⚪ แสดงวงระยะทำการ (Show Action Reach) เปิด" : "⚪ แสดงวงระยะทำการ (Show Action Reach) ปิด";
          actionReachToggle.classList.toggle("active", showActionReach);
        });
      }

      if (actionReachModeSelect) {
        actionReachModeSelect?.addEventListener("change", () => {
          actionReachMode = parseInt(actionReachModeSelect.value) || 3;
          console.log("📏 รูปแบบระยะทำการเปลี่ยนเป็น:", actionReachMode);
        });
      }

      if (bowHoldArmSlider) {
        bowHoldArmSlider?.addEventListener("input", () => {
          bowHoldArmTimer = parseFloat(bowHoldArmSlider.value);
          if (bowHoldArmLabel) bowHoldArmLabel.textContent = bowHoldArmTimer.toFixed(1);
        });
      }

      if (bowSpamClickDelaySlider) {
        bowSpamClickDelaySlider?.addEventListener("input", () => {
          bowSpamClickDelay = parseFloat(bowSpamClickDelaySlider.value);
          if (bowSpamClickDelayLabel) bowSpamClickDelayLabel.textContent = bowSpamClickDelay.toFixed(1);
        });
      }

      if (bowLockDistanceSlider) {
        bowLockDistanceSlider?.addEventListener("input", () => {
          bowLockDistance = parseFloat(bowLockDistanceSlider.value);
          if (bowLockDistanceLabel) bowLockDistanceLabel.textContent = bowLockDistance.toFixed(1);
        });
      }

      if (woodFloorHeightSlider) {
        woodFloorHeightSlider?.addEventListener("input", () => {
          woodFloorHeight = parseFloat(woodFloorHeightSlider.value);
          if (typeof window !== "undefined") {
            window.woodFloorHeight = woodFloorHeight;
          }
          if (woodFloorHeightLabel) woodFloorHeightLabel.textContent = woodFloorHeight.toFixed(2);
          if (typeof refreshCollectiblesVBO === "function") {
            refreshCollectiblesVBO();
          }
        });
      }

      if (campfireSizeSlider) {
        campfireSizeSlider?.addEventListener("input", () => {
          campfireSize = parseFloat(campfireSizeSlider.value);
          if (campfireSizeLabel) campfireSizeLabel.textContent = campfireSize.toFixed(2);
          if (floorPreviewCollectible && floorPreviewCollectible.type === "campfire") {
            floorPreviewCollectible.size = campfireSize;
          }
          for (let item of collectibles) {
            if (item.active && item.type === "campfire" && !item.isPreview) {
              item.size = campfireSize;
            }
          }
          if (typeof refreshCollectiblesVBO === "function") {
            refreshCollectiblesVBO();
          }
        });
      }

      if (voxelHoleRadiusSlider) {
        voxelHoleRadiusSlider?.addEventListener("input", () => {
          voxelHoleRadiusMultiplier = parseFloat(voxelHoleRadiusSlider.value);
          voxelHoleRadiusLabel.textContent = voxelHoleRadiusMultiplier.toFixed(1);
        });
      }

      const devCameraZoomSlider = document.getElementById("devCameraZoomSlider");
      const devCameraZoomLabel = document.getElementById("devCameraZoomLabel");
      if (devCameraZoomSlider && devCameraZoomLabel) {
        devCameraZoomSlider?.addEventListener("input", () => {
          if (typeof zoom !== "undefined") {
            zoom = parseFloat(devCameraZoomSlider.value);
          }
          devCameraZoomLabel.textContent = parseFloat(devCameraZoomSlider.value).toFixed(1);
        });

        function syncZoomSlider() {
          if (typeof zoom !== "undefined" && document.activeElement !== devCameraZoomSlider) {
            devCameraZoomSlider.value = zoom;
            devCameraZoomLabel.textContent = zoom.toFixed(1);
          }
        }
        setInterval(syncZoomSlider, 300);
      }

      // === Drag to Scroll in Inventory Panel (for Touch Mode) ===
      function setupDragToScroll() {
        const panels = document.querySelectorAll(".inventory-panel");
        panels.forEach((panel) => {
          let isDown = false;
          let startY;
          let scrollTop;
          let velocityY = 0;
          let lastY = 0;
          let lastTime = 0;

          panel?.addEventListener("mousedown", (e) => {
            // Only allow drag scroll when not in strict keyboard mode (allow in touch or auto mode)
            if (typeof devInputMode !== "undefined" && devInputMode === "keyboard") return;

            // Stop any ongoing inertia scrolling
            velocityY = 0;

            // Check if the click target or its parent is an interactive element we want to ignore
            let target = e.target;
            let preventScroll = false;
            while (target && target !== panel) {
              if (
                target.tagName === "BUTTON" ||
                target.tagName === "INPUT" ||
                target.tagName === "SELECT" ||
                target.tagName === "TEXTAREA" ||
                target.getAttribute("draggable") === "true" ||
                target.classList.contains("inventory-slot") ||
                target.classList.contains("action-slot") ||
                target.classList.contains("key-bind-btn") ||
                target.closest(".inventory-slot") ||
                target.closest(".action-slot")
              ) {
                preventScroll = true;
                break;
              }
              target = target.parentElement;
            }

            if (preventScroll) return;

            isDown = true;
            panel.style.cursor = "grabbing";
            startY = e.pageY - panel.offsetTop;
            scrollTop = panel.scrollTop;
            lastY = e.pageY;
            lastTime = Date.now();
          });

          panel?.addEventListener("mouseleave", () => {
            if (isDown) {
              isDown = false;
              panel.style.cursor = "default";
              applyInertia();
            }
          });

          panel?.addEventListener("mouseup", () => {
            if (isDown) {
              isDown = false;
              panel.style.cursor = "default";
              applyInertia();
            }
          });

          panel?.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            e.preventDefault();
            const y = e.pageY - panel.offsetTop;
            const walk = (y - startY) * 1.5; // speed factor
            panel.scrollTop = scrollTop - walk;

            // Calculate velocity for inertia
            const now = Date.now();
            const dt = now - lastTime;
            if (dt > 0) {
              velocityY = (e.pageY - lastY) / dt;
            }
            lastY = e.pageY;
            lastTime = now;
          });

          function applyInertia() {
            if (Math.abs(velocityY) < 0.1) return;
            function step() {
              if (isDown) return; // Stop inertia if clicked again
              panel.scrollTop -= velocityY * 16; // 16ms frame approx
              velocityY *= 0.95; // friction
              if (Math.abs(velocityY) > 0.1) {
                requestAnimationFrame(step);
              }
            }
            requestAnimationFrame(step);
          }
        });
      }
      setupDragToScroll();

      waterToggle?.addEventListener("click", () => {
        waterEnabled = !waterEnabled;
        waterToggle.classList.toggle("active", waterEnabled);
        updateSettingsTogglesUI();
        if (waterEnabled) {
          buildWaterSphere(currentGridSize);
        }
      });

      waterLevelSlider?.addEventListener("input", () => {
        waterLevel = parseInt(waterLevelSlider.value) / 10;
        waterLevelLabel.textContent = waterLevel.toFixed(2);
        if (waterEnabled) {
          buildWaterSphere(currentGridSize);
        }
      });

      waterOpacitySlider?.addEventListener("input", () => {
        waterOpacity = parseInt(waterOpacitySlider.value) / 100;
        waterOpacityLabel.textContent = waterOpacity.toFixed(2);
      });

      waveStrengthSlider?.addEventListener("input", () => {
        waveStrength = parseInt(waveStrengthSlider.value) / 200;
        waveStrengthLabel.textContent = waveStrength.toFixed(3);
      });

      waterColorPicker?.addEventListener("input", () => {
        const hex = waterColorPicker.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        waterColor = [r, g, b];
      });

      charSpeedSlider?.addEventListener("input", () => {
        setPlayerSpeed(parseInt(charSpeedSlider.value) / 1000);
      });

      charScaleSlider?.addEventListener("input", () => {
        playerScale = parseInt(charScaleSlider.value) / 100;
        charScaleLabel.textContent = playerScale.toFixed(2);
        
        // Auto-adjust Action Reach distance based on playerScale (ratio is 1.5x)
        actionReachDistance = playerScale * 1.5;
        if (actionReachDistSlider) {
          actionReachDistSlider.value = actionReachDistance;
        }
        if (actionReachLabel) {
          actionReachLabel.textContent = actionReachDistance.toFixed(2);
        }
      });

      leafSwaySlider?.addEventListener("input", () => {
        natureSway = parseInt(leafSwaySlider.value) / 100;
        leafSwayLabel.textContent = natureSway.toFixed(2);
      });

      waterSwaySlider?.addEventListener("input", () => {
        waterPlantSway = parseInt(waterSwaySlider.value) / 100;
        waterSwayLabel.textContent = waterPlantSway.toFixed(2);
      });

      renderDistToggle?.addEventListener("click", () => {
        renderDistEnabled = !renderDistEnabled;
        if (typeof window !== "undefined") window.renderDistEnabled = renderDistEnabled;
        renderDistToggle.classList.toggle("active", renderDistEnabled);
        updateSettingsTogglesUI();
      });

      terrainRenderDistSlider?.addEventListener("input", () => {
        const val = parseInt(terrainRenderDistSlider.value) / 10;
        terrainRenderDistValue = val;
        renderDistValue = val;
        if (typeof window !== "undefined") {
          window.terrainRenderDistValue = val;
          window.renderDistValue = val;
          if (typeof window.setTerrainRenderDist === "function") {
            window.setTerrainRenderDist(val);
          }
        }
        if (terrainRenderDistLabel) terrainRenderDistLabel.textContent = val.toFixed(2);
      });

      objectRenderDistSlider?.addEventListener("input", () => {
        const val = parseInt(objectRenderDistSlider.value) / 10;
        objectRenderDistValue = val;
        if (typeof window !== "undefined") {
          window.objectRenderDistValue = val;
          if (typeof window.setObjectRenderDist === "function") {
            window.setObjectRenderDist(val);
          }
        }
        if (objectRenderDistLabel) objectRenderDistLabel.textContent = val.toFixed(2);
      });

      charFpsSlider?.addEventListener("input", () => {
        charAnimFps = parseInt(charFpsSlider.value);
        charFpsLabel.textContent = charAnimFps + " FPS";
      });

      waterFpsSlider?.addEventListener("input", () => {
        waterAnimFps = parseInt(waterFpsSlider.value);
        waterFpsLabel.textContent = waterAnimFps + " FPS";
      });

      leafFpsSlider?.addEventListener("input", () => {
        leafAnimFps = parseInt(leafFpsSlider.value);
        leafFpsLabel.textContent = leafAnimFps + " FPS";
      });

      cloudFpsSlider?.addEventListener("input", () => {
        cloudAnimFps = parseInt(cloudFpsSlider.value);
        cloudFpsLabel.textContent = cloudAnimFps + " FPS";
      });


      atmosphereToggle?.addEventListener("click", () => {
        atmosphereEnabled = !atmosphereEnabled;
        atmosphereToggle.classList.toggle("active", atmosphereEnabled);
        updateSettingsTogglesUI();
      });

      atmosphereAlphaSlider?.addEventListener("input", () => {
        atmosphereAlpha = parseInt(atmosphereAlphaSlider.value) / 100;
        atmosphereAlphaLabel.textContent = atmosphereAlpha.toFixed(2);
      });

      atmosphereScaleSlider?.addEventListener("input", () => {
        atmosphereScale = parseInt(atmosphereScaleSlider.value) / 100;
        atmosphereScaleLabel.textContent = atmosphereScale.toFixed(2);
        buildAtmosphereSphere(currentGridSize);
      });

      atmosphereColorPicker?.addEventListener("input", () => {
        const hex = atmosphereColorPicker.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        atmosphereColor = [r, g, b];
      });

      godRaysToggle?.addEventListener("click", () => {
        godRaysEnabled = !godRaysEnabled;
        godRaysToggle.classList.toggle("active", godRaysEnabled);
        updateSettingsTogglesUI();
      });

      godRaysAlphaSlider?.addEventListener("input", () => {
        godRaysAlpha = parseInt(godRaysAlphaSlider.value) / 100;
        godRaysAlphaLabel.textContent = godRaysAlpha.toFixed(2);
      });

      godRaysCountSlider?.addEventListener("input", () => {
        godRaysCount = parseInt(godRaysCountSlider.value);
        godRaysCountLabel.textContent = godRaysCount;
      });

      godRaysColorPicker?.addEventListener("input", () => {
        const hex = godRaysColorPicker.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        godRaysColor = [r, g, b];
      });

      skyToggle?.addEventListener("click", () => {
        skyEnabled = !skyEnabled;
        skyToggle.classList.toggle("active", skyEnabled);
        updateSettingsTogglesUI();
      });

      skyGasIntensitySlider?.addEventListener("input", () => {
        skyGasIntensity = parseInt(skyGasIntensitySlider.value) / 100;
        skyGasIntensityLabel.textContent = skyGasIntensity.toFixed(2);
      });

      cloudsToggle?.addEventListener("click", () => {
        cloudsEnabled = !cloudsEnabled;
        cloudsToggle.classList.toggle("active", cloudsEnabled);
        updateSettingsTogglesUI();
      });

      cloudsAlphaSlider?.addEventListener("input", () => {
        cloudsAlpha = parseInt(cloudsAlphaSlider.value) / 100;
        cloudsAlphaLabel.textContent = cloudsAlpha.toFixed(2);
      });

      cloudsHeightSlider?.addEventListener("input", () => {
        cloudsHeight = parseInt(cloudsHeightSlider.value) / 100;
        cloudsHeightLabel.textContent = cloudsHeight.toFixed(2);
        
        const devSlider = document.getElementById("devCloud3DDistanceSlider");
        const devLabel = document.getElementById("devCloud3DDistanceLabel");
        if (devSlider) devSlider.value = cloudsHeightSlider.value;
        if (devLabel) devLabel.textContent = cloudsHeight.toFixed(2);
        
        if (typeof window.rebuildClouds3D === "function") {
          window.rebuildClouds3D(cloudsHeight);
        }
      });

      cloudsThicknessSlider?.addEventListener("input", () => {
        cloudsThickness = parseInt(cloudsThicknessSlider.value) / 100;
        cloudsThicknessLabel.textContent = cloudsThickness.toFixed(2);
      });

      cloudsSpeedSlider?.addEventListener("input", () => {
        cloudsSpeed = parseInt(cloudsSpeedSlider.value) / 100;
        cloudsSpeedLabel.textContent = cloudsSpeed.toFixed(2);
      });

      cloudsShapeSlider?.addEventListener("input", () => {
        cloudsShape = parseInt(cloudsShapeSlider.value) / 100;
        cloudsShapeLabel.textContent = cloudsShape.toFixed(2);
      });

      cloudsColorPicker?.addEventListener("input", () => {
        const hex = cloudsColorPicker.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        cloudsColor = [r, g, b];
      });

      // --- Grass & Foliage Settings Listeners (DevGame Only - No Save) ---
      function updateGrassUIState() {
        const isEnabled = window.globalGrassEnabled !== false;
        const density = typeof window.globalGrassDensity === "number" ? window.globalGrassDensity : 1.0;
        const densityPercent = Math.round(density * 100);

        // Dev Tools Controls
        const devToggle = document.getElementById("devGrassToggle");
        const devSlider = document.getElementById("devGrassDensity");
        const devLabel = document.getElementById("devGrassDensityLabel");
        if (devToggle) {
          devToggle.textContent = isEnabled ? "🌿 หญ้า: เปิด" : "🌿 หญ้า: ปิด";
          devToggle.classList.toggle("active", isEnabled);
        }
        if (devSlider) devSlider.value = densityPercent;
        if (devLabel) devLabel.textContent = densityPercent + "%";
      }
      window.updateGrassUIState = updateGrassUIState;

      // Dev Tools Listeners (ปรับทันที ไม่บันทึกการตั้งค่าลง LocalStorage หรือไฟล์เซฟ)
      const devGrassToggle = document.getElementById("devGrassToggle");
      const devGrassDensity = document.getElementById("devGrassDensity");

      devGrassToggle?.addEventListener("click", () => {
        window.globalGrassEnabled = !(window.globalGrassEnabled !== false);
        updateGrassUIState();
        if (typeof window.rebuildNature === "function") window.rebuildNature();
      });

      let devGrassDebounce = null;
      devGrassDensity?.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        window.globalGrassDensity = Math.max(0.1, Math.min(2.5, val / 100));
        updateGrassUIState();
        clearTimeout(devGrassDebounce);
        devGrassDebounce = setTimeout(() => {
          if (typeof window.rebuildNature === "function") window.rebuildNature();
        }, 120);
      });



      // ============================================
      // Sync Helpers for Game and Inventory Settings
      // ============================================

      let fallRagdollTimeout = null;

      function triggerFallRagdoll(duration = 1500) {
        if (typeof playerHP !== "undefined" && playerHP <= 0) return;
        if (typeof playerControlsLocked !== "undefined" && playerControlsLocked) return;

        if (fallRagdollTimeout) {
          clearTimeout(fallRagdollTimeout);
          fallRagdollTimeout = null;
        }

        setRagdoll(true);

        fallRagdollTimeout = setTimeout(() => {
          if ((typeof playerHP === "undefined" || playerHP > 0) && (typeof playerControlsLocked === "undefined" || !playerControlsLocked)) {
            setRagdoll(false);
          }
          fallRagdollTimeout = null;
        }, duration);
      }
      window.triggerFallRagdoll = triggerFallRagdoll;

      function setRagdoll(enabled) {
        ragdollEnabled = enabled;
        if (ragdollEnabled) {
          if (typeof window.exitBoatCamera === "function") window.exitBoatCamera();
          if (typeof window.exitMechCamera === "function") window.exitMechCamera();
          activeRidingBoat = null;
          activeRidingMech = null;
        } else if (fallRagdollTimeout) {
          clearTimeout(fallRagdollTimeout);
          fallRagdollTimeout = null;
        }
        const toggle = document.getElementById("ragdollToggle");
        if (toggle) {
          if (ragdollEnabled) {
            toggle.textContent = "🦴 โหมด Ragdoll: เปิด";
            toggle.classList.add("active");
          } else {
            toggle.textContent = "🦴 โหมด Ragdoll: ปิด";
            toggle.classList.remove("active");
          }
        }
        const invToggle = document.getElementById("invRagdollToggle");
        if (invToggle) {
          invToggle.textContent = ragdollEnabled ? "เปิด" : "ปิด";
        }
      }

      function setPlayerSpeed(val) {
        playerSpeed = val;
        const speedInput = document.getElementById("charSpeed");
        const speedLabel = document.getElementById("charSpeedLabel");
        if (speedInput) speedInput.value = Math.round(playerSpeed * 1000);
        if (speedLabel) speedLabel.textContent = playerSpeed.toFixed(3);

        const invSpeedVal = document.getElementById("invCharSpeedVal");
        const invSpeedInput = document.getElementById("invCharSpeedSlider");
        if (invSpeedVal) invSpeedVal.textContent = playerSpeed.toFixed(3);
        if (invSpeedInput) invSpeedInput.value = Math.round(playerSpeed * 1000);
      }

      function setSFXMuted(muted) {
        sfxMuted = muted;
        const sfxBtn = document.getElementById("sfxMuteToggle");
        if (sfxBtn) {
          if (sfxMuted) {
            sfxBtn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                    `;
            sfxBtn.title = "เปิดเสียง (Unmute)";
          } else {
            sfxBtn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dfb76c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    `;
            sfxBtn.title = "ปิดเสียง (Mute)";
          }
        }
      }

      // ============================================
      // ระบบควบคุมการว่ายน้ำและดำน้ำ (Shared with Player & PlayerClones)
      // ============================================
      window.updateEntitySwimmingAndDiving = function(
        state, // { currentSwimFactor, lastSwimFactor, swimMovementFactor, diveDepth, isDivingMode, centerRadius }
        currentFeetRadius,
        wRadiusLocal,
        waterRadius,
        terrainRadius,
        charScale,
        rotationX = 0,
        moveForwardInput = 0,
        isRiding = false,
        dt = 1 / 60
      ) {
        if (!state) return;
        if (isRiding) {
          state.currentSwimFactor = 0.0;
        } else if (typeof waterEnabled !== "undefined" && waterEnabled && currentFeetRadius < wRadiusLocal) {
          const depth = wRadiusLocal - currentFeetRadius;
          // Use hysteresis: if we were already swimming (lastSwimFactor > 0.01), we use a much lower threshold
          // (0.2 * charScale instead of 0.48 * charScale) to prevent oscillation when moving or bobbing.
          const swimThreshold = ((state.lastSwimFactor || 0) > 0.01) ? 0.2 * charScale : 0.48 * charScale;
          if (depth > swimThreshold) {
            state.currentSwimFactor = Math.min(
              1.0,
              (depth - swimThreshold) / (0.15 * charScale),
            );
          } else {
            state.currentSwimFactor = 0.0;
          }
        } else {
          state.currentSwimFactor = 0.0;
        }

        // Initialize diveDepth if transitioning to swimming to prevent sudden yanking/springing
        if (state.currentSwimFactor > 0.0 && (state.lastSwimFactor || 0) === 0.0 && state.centerRadius) {
          const targetSwimRadius = waterRadius + (-0.22 + (state.swimMovementFactor || 0) * 0.27) * charScale;
          const bottomRadius = terrainRadius + 0.46 * charScale;
          const maxDiveDepth = Math.max(0, targetSwimRadius - bottomRadius);
          state.diveDepth = Math.max(0.0, Math.min(maxDiveDepth, targetSwimRadius - state.centerRadius));
          state.isDivingMode = state.diveDepth > 0.015 * charScale;
        }
        state.lastSwimFactor = state.currentSwimFactor;

        // Smooth swimMovementFactor based on movement state
        const isMoving = Math.abs(moveForwardInput) > 0.05;
        const rateFactor = dt ? dt * 60 : 1.0;
        if (state.currentSwimFactor > 0.0) {
          if (isMoving) {
            state.swimMovementFactor = (state.swimMovementFactor || 0) + (1.0 - (state.swimMovementFactor || 0)) * 0.08 * rateFactor;
          } else {
            state.swimMovementFactor = (state.swimMovementFactor || 0) + (0.0 - (state.swimMovementFactor || 0)) * 0.08 * rateFactor;
          }
        } else {
          state.swimMovementFactor = (state.swimMovementFactor || 0) + (0.0 - (state.swimMovementFactor || 0)) * 0.12 * rateFactor;
        }

        // Calculate and clamp diving depth
        if (state.currentSwimFactor > 0.0) {
          const targetSwimRadius = waterRadius + (-0.22 + (state.swimMovementFactor || 0) * 0.27) * charScale;
          const bottomRadius = terrainRadius + 0.46 * charScale;
          const maxDiveDepth = Math.max(0, targetSwimRadius - bottomRadius);

          let targetDiveDepthChange = 0.0;
          const diveSpeed = 0.012 * charScale;

          if (state.isDivingMode && moveForwardInput !== 0) {
            if (Math.abs(rotationX) > 0.05) {
              targetDiveDepthChange += moveForwardInput * rotationX * diveSpeed * 1.5;
            }
          }

          if (state.isPlayer && typeof keysPressed !== "undefined" && typeof currentKeyBindings !== "undefined") {
            if (keysPressed[currentKeyBindings.diveDown]) {
              targetDiveDepthChange += diveSpeed;
            } else if (
              keysPressed["Space"] ||
              keysPressed["ShiftRight"] ||
              keysPressed[currentKeyBindings.diveUp]
            ) {
              targetDiveDepthChange -= diveSpeed;
            }
          }

          state.diveDepth = Math.max(
            0.0,
            Math.min(maxDiveDepth, (state.diveDepth || 0.0) + targetDiveDepthChange),
          );

          if (state.diveDepth > 0.015 * charScale) {
            state.isDivingMode = true;
          } else if (state.diveDepth <= 0.005 * charScale) {
            state.diveDepth = 0.0;
            state.isDivingMode = false;
          }
        } else {
          state.diveDepth = 0.0;
          state.isDivingMode = false;
        }
      };

      function updatePlayerSwimmingAndDiving(
        currentFeetRadius,
        wRadiusLocal,
        waterRadius,
        terrainRadius,
        charScale,
        rotationX,
        moveForwardInput
      ) {
        const pState = {
          currentSwimFactor: typeof currentSwimFactor !== "undefined" ? currentSwimFactor : 0.0,
          lastSwimFactor: typeof lastSwimFactor !== "undefined" ? lastSwimFactor : 0.0,
          swimMovementFactor: typeof swimMovementFactor !== "undefined" ? swimMovementFactor : 0.0,
          diveDepth: typeof playerDiveDepth !== "undefined" ? playerDiveDepth : 0.0,
          isDivingMode: typeof isDivingMode !== "undefined" ? isDivingMode : false,
          centerRadius: typeof playerCenterRadius !== "undefined" ? playerCenterRadius : null,
          isPlayer: true
        };
        const isRiding = !!((typeof activeRidingBoat !== "undefined" && activeRidingBoat) || (typeof activeRidingMech !== "undefined" && activeRidingMech));

        window.updateEntitySwimmingAndDiving(
          pState,
          currentFeetRadius,
          wRadiusLocal,
          waterRadius,
          terrainRadius,
          charScale,
          rotationX,
          moveForwardInput,
          isRiding,
          typeof timeScale !== "undefined" ? (timeScale / 60) : (1 / 60)
        );

        currentSwimFactor = pState.currentSwimFactor;
        lastSwimFactor = pState.lastSwimFactor;
        swimMovementFactor = pState.swimMovementFactor;
        playerDiveDepth = pState.diveDepth;
        isDivingMode = pState.isDivingMode;

        // Cancel BOW / ARM_CANNON immediately if the player is swimming (with no auto-resume)
        if (currentSwimFactor > 0.0) {
          if (typeof activeItem !== "undefined" && activeItem && (activeItem.name === "BOW" || activeItem.name === "WOODEN_ARM_CANNON" || activeItem.name === "ARM_CANNON")) {
            useAnimTimer = 0;
            isUsingItem = false;
            activeItem = null;
          }
        }
      }


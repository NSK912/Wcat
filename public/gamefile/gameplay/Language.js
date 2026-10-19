// === SEEDPLANET MODULE: JS/I18N.JS ===

(function() {
  const DICTIONARY = {
    th: {
      // General & Common
      app_title: "SeedPlanet",
      back: "ย้อนกลับ",
      cancel: "ยกเลิก",
      confirm: "ยืนยัน",
      delete: "ลบ",
      delete_save: "ลบเซฟ",
      confirm_delete: "ยืนยันลบ?",
      on: "เปิด",
      off: "ปิด",
      low: "ต่ำ",
      medium: "ปานกลาง",
      high: "สูง",
      ultra: "อัลตร้า",
      loading: "กำลังโหลด...",

      // Start Screen
      start_game: "เริ่มเล่น",
      settings: "ตั้งค่า",
      dev_mode: "โหมดผู้พัฒนา",
      donate: "สนับสนุน",

      // Save Slots
      select_save_slot: "📂 เลือกข้อมูลเซฟ",
      save_slot_n: "เซฟช่องที่ {n}",
      slot_empty: "[ ว่าง / เกมใหม่ ]",
      slot_loaded: "[ มีข้อมูลเซฟ ]",
      slot_empty_desc: "สร้างดวงดาวใหม่ด้วยขนาดและข้อมูลเริ่มต้น",
      slot_loaded_desc: "ขนาด: {size} | Seed: {seed} | หิน: {rock}, กิ่งไม้: {branch}",
      delete_save: "ลบเซฟ",
      confirm_delete: "ยืนยันลบ?",

      // Tabs & HUD Headers
      tab_crafting: "คราฟต์ไอเทม",
      tab_inventory: "กระเป๋าเก็บของ",
      tab_items_list: "รายการไอเทม",
      tab_settings: "ตั้งค่า",
      tab_cooking: "ทำอาหาร",
      actions_label: "⚡ แอคชั่น",
      open_inventory: "เปิดกระเป๋า",
      close_inventory: "ปิดกระเป๋า",
      demolish_active_title: "ปิดโหมดรื้อถอน (คลิกเพื่อปิด)",
      toggle_fullscreen: "เปิด/ปิด เต็มจอ",
      fps_counter: "FPS: ",

      // Settings Modal
      language_label: "ภาษา (Language)",
      lang_th: "ภาษาไทย",
      lang_en: "English",
      lang_sd: "ภาษาซีเดียน (Seedian)",
      sfx_volume: "ระดับเสียงรวม",
      render_scale: "สเกลความละเอียดเรนเดอร์",
      fps_limit: "จำกัดเฟรมเรต",
      mouse_sensitivity: "ความไวเมาส์",
      rstick_sensitivity: "ความไวอนาล็อกขวา (RS)",
      screen_mode: "โหมดแสดงผล",
      mode_windowed: "โหมดหน้าต่าง",
      mode_fullscreen: "เต็มจอ",
      fps_display_toggle: "แสดงตัวนับ FPS",
      shadow_quality: "คุณภาพเงา",
      fxaa_label: "FXAA (ลดรอยหยัก)",
      fxaa_sub: "(ลดรอยหยักขอบภาพ)",
      taau_label: "FXAA (ลดรอยหยัก)",
      taau_sub: "(ลดรอยหยักขอบภาพ)",
      key_bindings: "ตั้งค่าปุ่มควบคุม",
      gamepad_bindings: "ตั้งค่าปุ่มจอย (Gamepad)",
      restore_defaults: "คืนค่าเริ่มต้น",
      defaults_restored: "🔄 คืนค่าเริ่มต้นเรียบร้อยแล้ว!",
      main_menu: "กลับไปหน้าเริ่มเกม",

      // Bottom Inventory Buttons
      bottom_btn_action: "⚡ แอคชั่น UI",
      bottom_btn_split: "แบ่งจำนวนไอเทม",
      bottom_btn_destroy: "ทำลายไอเทม",

      // Key Bindings
      key_move: "เดิน / เคลื่อนที่",
      key_camera: "หมุนมุมกล้อง",
      key_attack: "โจมตี / ใช้อาวุธ / วางของ",
      key_terrainMod: "ขุดดิน / ถมดิน",
      key_flightThrottle: "เรือติดปีก: เร่งเครื่อง",
      key_flightPitch: "เรือติดปีก: บินขึ้น / บินลง",
      key_interact: "สำรวจ / เก็บของ / ขี่",
      key_rotate: "หมุนโครงสร้าง / ว่ายขึ้น",
      key_jump: "กระโดด",
      key_cancel: "ยกเลิก / ปิดเมนู",
      key_demolish: "แอคชั่นด่วน / รื้อถอน",
      key_bottomShortcut: "ลัดไป 3 ปุ่มล่างในกระเป๋า",
      key_inventory: "กระเป๋า / เมนู",
      key_action1: "ช่องแอคชั่น 1",
      key_action2: "ช่องแอคชั่น 2",
      key_action3: "ช่องแอคชั่น 3",
      key_action4: "ช่องแอคชั่น 4",
      key_sprint: "วิ่งเร็ว / บูสต์",
      key_resetCam: "รีเซ็ตมุมกล้อง",
      key_forward: "เดินหน้า",
      key_backward: "ถอยหลัง",
      key_left: "เดินซ้าย",
      key_right: "เดินขวา",
      key_diveDown: "ดำน้ำลง",
      key_diveUp: "ว่ายน้ำขึ้น",
      key_toggleMouse: "ซ่อน/แสดง เมาส์จำลอง",
      key_press_key: "กดปุ่ม...",

      // Chest Overlay
      chest_storage: "กล่องเก็บของ",
      chest_take_all: "เก็บทั้งหมด",
      your_inventory: "กระเป๋าเดินทาง",

      // Crafting & Cooking
      craft_button: "คราฟต์",
      cook_button: "ปรุงอาหาร",
      required_ingredients: "วัตถุดิบที่ต้องการ:",
      insufficient_materials: "วัตถุดิบไม่พอ",

      // Confirm Modals
      destroy_item: "ทำลายไอเทม?",
      hold_delete: "กดค้างเพื่อทำลาย",
      antialias_title: "ลดรอยหยัก เปิด-ปิด",
      antialias_sub: "(ต้องการรีโหลดเกม)",
      confirm_reload: "ตกลง (รีโหลด)",
      kill_npc: "กำจัด NPC",
      unconscious_title: "หมดสติ...",

      // Items
      item_ROCK: "หิน",
      item_BIG_ROCK: "หินใหญ่",
      item_IRON_ORE: "แร่เหล็ก",
      item_GOLD_ORE: "แร่ทองคำ",
      item_GLOW_ORE: "แร่หินเรืองแสง",
      item_GLOW_BATTERY: "หินเรืองแสงอัดแท่ง(แบต)",
      item_GLOW_BATTERY_EMPTY: "แบตเตอรี่เรืองแสง(หมดพลังงาน)",
      item_BRANCH: "กิ่งไม้",
      item_AXE: "ขวาน",
      item_PICKAXE: "อีเตอร์",
      item_LOG: "ท่อนไม้",
      item_BOW: "ธนู",
      item_ARROW: "ลูกธนู",
      item_WOODEN_ARM_CANNON: "ปืนไม้ติดแขน",
      item_ARM_CANNON: "ปืนไม้ติดแขน",
      item_WOOD_FLOOR: "พื้นไม้",
      item_THIN_WOOD_FLOOR: "พื้นไม้บาง",
      item_STONE_FLOOR: "พื้นหิน",
      item_WOOD_STAIRS: "บันไดไม้",
      item_FOLDING_LADDER: "บันไดพับ",
      item_CAMPFIRE: "กองไฟ",
      item_WOOD_BOAT: "เรือไม้",
      item_WOOD_WHEEL: "ล้อไม้",
      item_BOAT_WING: "ปีกเรือ (Boat Wing)",
      item_ELECTRIC_ENGINE: "เครื่องยนต์ไฟฟ้า",
      item_WOOD_WALL: "กำแพงไม้",
      item_WOOD_WINDOW: "หน้าต่างไม้",
      item_WOOD_DOOR: "ประตูไม้",
      item_WOOD_ROOF: "หลังคาไม้",
      item_WOOD_CHEST: "กล่องไม้",
      item_MEGANEURA: "แมลงปอยักษ์",
      item_ISOPOD: "ไอโซพอด",
      item_FRIED_BUG: "แมลงทอด",
      item_SHOVEL: "พลั่ว",
      item_ROBOT_STAND: "แท่นประกอบหุ่นยนต์",
      item_ROBOT_COCKPIT: "ห้องคนขับหุ่นยนต์",
      item_ROBOT_LEFT_ARM: "แขนซ้ายหุ่นยนต์",
      item_ROBOT_RIGHT_ARM: "แขนขวาหุ่นยนต์",
      item_ROBOT_LEFT_LEG: "ขาซ้ายหุ่นยนต์",
      item_ROBOT_RIGHT_LEG: "ขาขวาหุ่นยนต์",
      item_PLANET_CORE: "แกนกลางดวงดาว",

      // Mech Stand System
      robot_stand_title: "ระบบฐานตั้งหุ่นยนต์ (ROBOT STAND)",
      mech_stand_title: "ระบบฐานตั้งหุ่นยนต์ (ROBOT STAND)",
      mech_slot_equipped: "✔ ประกอบแล้ว",
      mech_slot_empty: "✚ ว่าง",
      mech_slot_empty_title: "ช่องว่าง (คลิกเพื่อประกอบชิ้นส่วน)",
      mech_slot_dismantle_title: "คลิกเพื่อถอด {part}",
      mech_part_cockpit: "ห้องนักบิน",
      mech_part_left_arm: "แขนซ้าย",
      mech_part_right_arm: "แขนขวา",
      mech_part_left_leg: "ขาซ้าย",
      mech_part_right_leg: "ขาขวา",
      mech_part_stand: "ฐานตั้ง",
      mech_part_core: "คอร์พลังงาน",
      mech_part_module: "โมดูลเสริม",
      mech_part_generic: "ชิ้นส่วนหุ่นยนต์",
      mech_cannot_remove_stand: "ไม่สามารถถอดฐานตั้งขณะใช้งาน UI ได้!",
      mech_dismantle_success: "ถอด {part} เรียบร้อย!",
      mech_inventory_full: "กระเป๋าเต็ม! ไม่สามารถถอดได้",
      mech_require_cockpit: "ต้องประกอบห้องนักบิน (Cockpit) ก่อนประกอบแขนหรือขา!",
      mech_no_parts_to_equip: "ไม่มีชิ้นส่วนใหม่ที่สามารถประกอบได้!",
      mech_equip_success: "ประกอบ {part} สำเร็จ!",
      mech_missing_parts_warn: "⚠️ หุ่นยังประกอบไม่ครบ (ขาด: {missing}) — วางชิ้นส่วนใส่หุ่นยนต์ให้ครบ 4 ชิ้นก่อนจึงจะขับได้",
      mech_need_4_parts: "⚠️ ต้องประกอบชิ้นส่วนหุ่นยนต์ให้ครบ 4 ชิ้น (ขาซ้าย, ขาขวา, แขนซ้าย, แขนขวา) ก่อนจึงจะขับได้!",
      mech_docked_notice: "⚙️ กลับเข้าสู่โหมดประกอบกับฐานตั้งแล้ว",

      // Settings & Toggles
      input_touch: "โหมดอินพุต: จอสัมผัส (Touch)",
      input_keyboard: "โหมดอินพุต: คีย์บอร์ด/เมาส์ (Keyboard/Mouse)",
      input_auto: "โหมดอินพุต: อัตโนมัติ (Auto)",
      toggle_hitboxes: "แสดงโครงสร้างการชน (Show Hitboxes)",
      frustum_culling: "Frustum Culling (คัดออกวัตถุนอกจอ)",
      cave_water: "น้ำในถ้ำ (Cave Water)",
      action_reach: "แสดงวงระยะทำการ",
      water: "ระบบน้ำ",
      render_dist_limit: "จำกัดระยะเรนเดอร์",
      atmosphere: "บรรยากาศ",
      god_rays: "ลำแสงเทวทูต (God Rays)",
      space_sky: "ท้องฟ้าอวกาศ",
      clouds: "เมฆกลุ่มก๊าซ",
      ragdoll_mode: "โหมด Ragdoll",
      grass_toggle: "หญ้า",

      // Dynamic Notices
      craft_success: "คราฟต์สำเร็จ",
      cook_success: "ปรุงสำเร็จ",
      summon_success: "เสกสำเร็จ: ได้รับ",
      inventory_full: "กระเป๋าเต็มแล้ว!",
      chest_full: "กล่องเต็มแล้ว!"
    },
    en: {
      // General & Common
      app_title: "SeedPlanet",
      back: "Back",
      cancel: "Cancel",
      confirm: "Confirm",
      delete: "Delete",
      delete_save: "Delete Save",
      confirm_delete: "Confirm Delete?",
      on: "On",
      off: "Off",
      low: "Low",
      medium: "Medium",
      high: "High",
      ultra: "Ultra",
      loading: "Loading...",

      // Start Screen
      start_game: "Start Game",
      settings: "Settings",
      dev_mode: "Dev Mode",
      donate: "Donate",

      // Save Slots
      select_save_slot: "📂 Select Save Slot",
      save_slot_n: "Save Slot {n}",
      slot_empty: "[ Empty / New Game ]",
      slot_loaded: "[ Saved Game ]",
      slot_empty_desc: "Create a new planet with default settings",
      slot_loaded_desc: "Size: {size} | Seed: {seed} | Rock: {rock}, Branch: {branch}",
      delete_save: "Delete Save",
      confirm_delete: "Confirm Delete?",

      // Tabs & HUD Headers
      tab_crafting: "CRAFTING",
      tab_inventory: "INVENTORY",
      tab_items_list: "ITEMS LIST",
      tab_settings: "SETTINGS",
      tab_cooking: "COOKING",
      actions_label: "⚡ ACTIONS",
      open_inventory: "Open Inventory",
      close_inventory: "Close Inventory",
      demolish_active_title: "Demolish Mode Active (Click to Close)",
      toggle_fullscreen: "Toggle Fullscreen",
      fps_counter: "FPS: ",

      // Settings Modal
      language_label: "Language",
      lang_th: "Thai",
      lang_en: "English",
      lang_sd: "Seedian",
      sfx_volume: "Master SFX Volume",
      render_scale: "Render Scale",
      fps_limit: "FPS Limit",
      mouse_sensitivity: "Mouse Sensitivity",
      rstick_sensitivity: "Right Stick Sensitivity (RS)",
      screen_mode: "Screen Mode",
      mode_windowed: "Windowed",
      mode_fullscreen: "Fullscreen",
      fps_display_toggle: "FPS Counter",
      shadow_quality: "Shadow Quality",
      fxaa_label: "FXAA (Anti-Aliasing)",
      fxaa_sub: "(Smooth Jagged Edges)",
      taau_label: "FXAA (Anti-Aliasing)",
      taau_sub: "(Smooth Jagged Edges)",
      key_bindings: "Key Bindings",
      gamepad_bindings: "Gamepad Bindings",
      restore_defaults: "Restore Defaults",
      defaults_restored: "🔄 Defaults Restored!",
      main_menu: "Return to Main Menu",

      // Bottom Inventory Buttons
      bottom_btn_action: "⚡ ACTION UI",
      bottom_btn_split: "SPLIT STACK",
      bottom_btn_destroy: "DESTROY ITEM",

      // Key Bindings
      key_move: "Move",
      key_camera: "Camera Look",
      key_attack: "Attack / Place",
      key_terrainMod: "Dig / Fill Terrain",
      key_flightThrottle: "Flight Throttle",
      key_flightPitch: "Flight Pitch",
      key_interact: "Interact / Ride",
      key_rotate: "Rotate / Swim Up",
      key_jump: "Jump",
      key_cancel: "Cancel / Close Menu",
      key_demolish: "Quick Action / Demolish",
      key_bottomShortcut: "Bottom Shortcut",
      key_inventory: "Inventory / Menu",
      key_action1: "Action Slot 1",
      key_action2: "Action Slot 2",
      key_action3: "Action Slot 3",
      key_action4: "Action Slot 4",
      key_sprint: "Sprint / Boost",
      key_resetCam: "Center Camera View",
      key_forward: "Move Forward",
      key_backward: "Move Backward",
      key_left: "Move Left",
      key_right: "Move Right",
      key_diveDown: "Dive Down",
      key_diveUp: "Swim Up",
      key_toggleMouse: "Toggle Virtual Cursor",
      key_press_key: "Press key...",

      // Chest Overlay
      chest_storage: "CHEST STORAGE",
      chest_take_all: "Take All",
      your_inventory: "YOUR INVENTORY",

      // Crafting & Cooking
      craft_button: "Craft",
      cook_button: "Cook",
      required_ingredients: "Required Ingredients:",
      insufficient_materials: "Insufficient Materials",

      // Confirm Modals
      destroy_item: "DESTROY ITEM?",
      hold_delete: "HOLD TO DELETE",
      antialias_title: "ANTI-ALIASING ON/OFF",
      antialias_sub: "(Requires Reload)",
      confirm_reload: "RELOAD",
      kill_npc: "Kill NPC",
      unconscious_title: "Unconscious...",

      // Items
      item_ROCK: "Rock",
      item_BIG_ROCK: "Big Rock",
      item_IRON_ORE: "Iron Ore",
      item_GOLD_ORE: "Gold Ore",
      item_GLOW_ORE: "Glowing Ore",
      item_GLOW_BATTERY: "Glowing Battery Rod",
      item_GLOW_BATTERY_EMPTY: "Empty Glowing Battery",
      item_BRANCH: "Branch",
      item_AXE: "Axe",
      item_PICKAXE: "Pickaxe",
      item_LOG: "Wood Log",
      item_BOW: "Bow",
      item_ARROW: "Arrow",
      item_WOODEN_ARM_CANNON: "Wooden Arm Cannon",
      item_ARM_CANNON: "Wooden Arm Cannon",
      item_WOOD_FLOOR: "Wood Floor",
      item_THIN_WOOD_FLOOR: "Thin Wood Floor",
      item_STONE_FLOOR: "Stone Floor",
      item_WOOD_STAIRS: "Wood Stairs",
      item_FOLDING_LADDER: "Folding Ladder",
      item_CAMPFIRE: "Campfire",
      item_WOOD_BOAT: "Wood Boat",
      item_WOOD_WHEEL: "Wooden Wheel",
      item_BOAT_WING: "Boat Wing",
      item_ELECTRIC_ENGINE: "Electric Engine",
      item_WOOD_WALL: "Wood Wall",
      item_WOOD_WINDOW: "Wood Window",
      item_WOOD_DOOR: "Wood Door",
      item_WOOD_ROOF: "Wooden Roof",
      item_WOOD_CHEST: "Wooden Chest",
      item_MEGANEURA: "Meganeura",
      item_ISOPOD: "Giant Isopod",
      item_FRIED_BUG: "Fried Bug",
      item_SHOVEL: "Shovel",
      item_ROBOT_STAND: "Robot Stand",
      item_ROBOT_COCKPIT: "Robot Cockpit",
      item_ROBOT_LEFT_ARM: "Robot Left Arm",
      item_ROBOT_RIGHT_ARM: "Robot Right Arm",
      item_ROBOT_LEFT_LEG: "Robot Left Leg",
      item_ROBOT_RIGHT_LEG: "Robot Right Leg",
      item_PLANET_CORE: "Planet Core",

      // Mech Stand System
      robot_stand_title: "ROBOT STAND SYSTEM",
      mech_stand_title: "ROBOT STAND SYSTEM",
      mech_slot_equipped: "✔ EQUIPPED",
      mech_slot_empty: "✚ EMPTY",
      mech_slot_empty_title: "Empty Slot (Click to Equip Part)",
      mech_slot_dismantle_title: "Click to dismantle {part}",
      mech_part_cockpit: "Cockpit",
      mech_part_left_arm: "Left Arm",
      mech_part_right_arm: "Right Arm",
      mech_part_left_leg: "Left Leg",
      mech_part_right_leg: "Right Leg",
      mech_part_stand: "Stand",
      mech_part_core: "Power Core",
      mech_part_module: "Module",
      mech_part_generic: "Robot Part",
      mech_cannot_remove_stand: "Cannot remove stand while active!",
      mech_dismantle_success: "Dismantled {part} successfully!",
      mech_inventory_full: "Inventory full! Cannot dismantle",
      mech_require_cockpit: "Must equip Cockpit before arms or legs!",
      mech_no_parts_to_equip: "No new parts to equip!",
      mech_equip_success: "Equipped {part} successfully!",
      mech_missing_parts_warn: "⚠️ Mech incomplete (Missing: {missing}) — Assemble all 4 parts before piloting",
      mech_need_4_parts: "⚠️ Must assemble all 4 parts (Left Leg, Right Leg, Left Arm, Right Arm) before piloting!",
      mech_docked_notice: "⚙️ Docked to Robot Stand",

      // Settings & Toggles
      input_touch: "Input Mode: Touch",
      input_keyboard: "Input Mode: Keyboard/Mouse",
      input_auto: "Input Mode: Auto",
      toggle_hitboxes: "Show Hitboxes",
      frustum_culling: "Frustum Culling",
      cave_water: "Cave Water",
      action_reach: "Show Action Reach",
      water: "Water",
      render_dist_limit: "Render Distance Limit",
      atmosphere: "Atmosphere",
      god_rays: "God Rays",
      space_sky: "Space Sky",
      clouds: "Clouds",
      ragdoll_mode: "Ragdoll Mode",
      grass_toggle: "Grass",

      // Dynamic Notices
      craft_success: "Crafted Successfully",
      cook_success: "Cooked Successfully",
      summon_success: "Spawned: Received",
      inventory_full: "Inventory Full!",
      chest_full: "Chest Full!"
    }
  };

  // Build Seedian dictionary based on Thai text translated via Seedian Script
  DICTIONARY.seedian = {};
  if (typeof window !== "undefined") {
    const toSeedianFn = (text) => {
      if (window.Seedian && typeof window.Seedian.toSeedian === "function") {
        return window.Seedian.toSeedian(text);
      }
      return text;
    };
    for (const [k, v] of Object.entries(DICTIONARY.th)) {
      if (typeof v === "string") {
        DICTIONARY.seedian[k] = toSeedianFn(v);
      }
    }
    DICTIONARY.seedian.lang_th = "ภาษาไทย";
    DICTIONARY.seedian.lang_en = "English";
    DICTIONARY.seedian.lang_sd = toSeedianFn("ภาษาซีเดียน") + " (Seedian)";
  }

  let currentLang = "en";

  // Pre-load language from storage
  try {
    const savedOpts = localStorage.getItem("seedplanet_options_config");
    if (savedOpts) {
      const parsed = JSON.parse(savedOpts);
      if (parsed && (parsed.language === "th" || parsed.language === "en" || parsed.language === "seedian")) {
        currentLang = parsed.language;
      }
    } else {
      const savedSettings = localStorage.getItem("seedplanet_settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed && (parsed.language === "th" || parsed.language === "en" || parsed.language === "seedian")) {
          currentLang = parsed.language;
        }
      }
    }
  } catch (e) {
    console.error("I18N: Failed to read saved language:", e);
  }

  function getGameLanguage() {
    return currentLang;
  }

  function t(key, params) {
    // Lazy populate seedian if needed
    if (currentLang === "seedian" && (!DICTIONARY.seedian || Object.keys(DICTIONARY.seedian).length === 0)) {
      const toSeedianFn = (text) => {
        if (window.Seedian && typeof window.Seedian.toSeedian === "function") {
          return window.Seedian.toSeedian(text);
        }
        return text;
      };
      DICTIONARY.seedian = {};
      const sourceDict = DICTIONARY.en || DICTIONARY.th;
      for (const [k, v] of Object.entries(sourceDict)) {
        if (typeof v === "string") {
          DICTIONARY.seedian[k] = toSeedianFn(v);
        }
      }
      // Ensure keys from TH that might not be in EN are also translated
      if (DICTIONARY.th) {
        for (const [k, v] of Object.entries(DICTIONARY.th)) {
          if (!DICTIONARY.seedian[k] && typeof v === "string") {
            DICTIONARY.seedian[k] = toSeedianFn(v);
          }
        }
      }
      DICTIONARY.seedian.lang_th = "ภาษาไทย";
      DICTIONARY.seedian.lang_en = "English";
      DICTIONARY.seedian.lang_sd = toSeedianFn("ภาษาซีเดียน") + " (Seedian)";
    }

    const dict = DICTIONARY[currentLang] || DICTIONARY.en;
    let text = dict[key] || (DICTIONARY.en && DICTIONARY.en[key]) || (DICTIONARY.th && DICTIONARY.th[key]) || key;
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      }
    }
    return text;
  }

  function getItemDisplayName(itemName, lang) {
    if (!itemName) return "";
    const curLang = lang || (typeof getGameLanguage === "function" ? getGameLanguage() : currentLang) || "en";
    if (typeof window.getItemDefinition === "function") {
      const def = window.getItemDefinition(itemName);
      if (def) {
        if (curLang === "th") return def.name_th || def.name_en;
        if (curLang === "seedian") {
          const baseName = def.name_th || def.name_en;
          return (window.Seedian && typeof window.Seedian.toSeedian === "function")
            ? window.Seedian.toSeedian(baseName)
            : baseName;
        }
        return def.name_en || def.name_th;
      }
    }
    const rawName = typeof itemName === "string" ? itemName : (itemName.name || itemName.type || "");
    const cleanKey = "item_" + String(rawName).toUpperCase();
    const translated = t(cleanKey);
    if (translated && translated !== cleanKey) {
      return translated;
    }
    const fallbackName = typeof itemName === "string" ? itemName : (itemName.label || itemName.name || "");
    if (curLang === "seedian" && window.Seedian && typeof window.Seedian.toSeedian === "function") {
      return window.Seedian.toSeedian(fallbackName);
    }
    return fallbackName;
  }

  function updateUILanguage() {
    if (typeof document !== "undefined" && document.body) {
      if (currentLang === "seedian") {
        document.body.classList.add("lang-seedian");
      } else {
        document.body.classList.remove("lang-seedian");
      }
    }

    // Clear cached seedian dictionary when language is updated
    if (DICTIONARY) {
      DICTIONARY.seedian = null;
    }

    // Update all text nodes with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        const val = t(key);
        if (typeof val === "string" && (val.includes("<svg") || val.includes("<span") || currentLang === "seedian")) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Update titles with data-i18n-title
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      if (key) {
        el.title = t(key);
      }
    });

    // Update placeholders with data-i18n-placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) {
        el.placeholder = t(key);
      }
    });

    // Update Language Buttons styling in Settings
    const langThBtn = document.getElementById("langThBtn");
    const langEnBtn = document.getElementById("langEnBtn");
    const langSdBtn = document.getElementById("langSdBtn");

    const activeStyle = {
      background: "rgba(223, 183, 108, 0.15)",
      borderColor: "#dfb76c",
      color: "#dfb76c",
      textShadow: "0 0 6px rgba(223, 183, 108, 0.4)"
    };
    const inactiveStyle = {
      background: "rgba(255, 255, 255, 0.05)",
      borderColor: "rgba(255, 255, 255, 0.2)",
      color: "rgba(255, 255, 255, 0.6)",
      textShadow: "none"
    };

    const applyStyle = (btn, isActive) => {
      if (!btn) return;
      const st = isActive ? activeStyle : inactiveStyle;
      btn.style.background = st.background;
      btn.style.borderColor = st.borderColor;
      btn.style.color = st.color;
      btn.style.textShadow = st.textShadow;
    };

    applyStyle(langThBtn, currentLang === "th");
    applyStyle(langEnBtn, currentLang === "en");
    applyStyle(langSdBtn, currentLang === "seedian");

    // Re-render dynamic components if functions exist
    if (typeof window.updateSettingsTogglesUI === "function") {
      window.updateSettingsTogglesUI();
    }
    if (typeof window.renderKeyBindingsUI === "function") {
      window.renderKeyBindingsUI();
    }
    if (typeof window.renderInventory === "function") {
      window.renderInventory();
    }
    if (typeof window.renderActionSlots === "function") {
      window.renderActionSlots();
    }
    if (typeof window.renderCrafting === "function") {
      window.renderCrafting();
    }
    if (typeof window.renderCooking === "function") {
      window.renderCooking();
    }
    if (typeof window.renderItemsList === "function") {
      window.renderItemsList();
    }
    if (typeof window.renderSaveSlots === "function") {
      const saveOverlay = document.getElementById("saveSelectOverlay");
      if (saveOverlay && saveOverlay.style.display !== "none") {
        window.renderSaveSlots();
      }
    }
    if (typeof window.updateShadowMapUI === "function") {
      window.updateShadowMapUI();
    }
    if (typeof window.renderMechStandUI === "function" && typeof window._lastActiveStand !== "undefined" && window._lastActiveStand) {
      window.renderMechStandUI(window._lastActiveStand, window._lastAttachedCollectibles);
    }
  }

  function setElementTextOrHTML(el, str) {
    if (!el) return;
    const val = String(str || "");
    if (val.includes("<svg") || val.includes("<span") || currentLang === "seedian") {
      el.innerHTML = val;
    } else {
      el.textContent = val;
    }
  }

  function setGameLanguage(lang, save = true) {
    if (lang !== "th" && lang !== "en" && lang !== "seedian") return;
    currentLang = lang;
    window.gameLanguage = currentLang;

    updateUILanguage();

    if (save) {
      if (typeof window.saveSettingsToLocalStorage === "function") {
        window.saveSettingsToLocalStorage();
      } else {
        try {
          const opts = JSON.parse(localStorage.getItem("seedplanet_options_config") || "{}");
          opts.language = currentLang;
          localStorage.setItem("seedplanet_options_config", JSON.stringify(opts));
        } catch (e) {}
      }
    }
  }

  window.I18N_DICTIONARY = DICTIONARY;
  window.getGameLanguage = getGameLanguage;
  window.setGameLanguage = setGameLanguage;
  window.setElementTextOrHTML = setElementTextOrHTML;
  window.t = t;
  window.getItemDisplayName = getItemDisplayName;
  window.updateUILanguage = updateUILanguage;
  window.gameLanguage = currentLang;

  document.addEventListener("DOMContentLoaded", () => {
    updateUILanguage();

    // Hook up language buttons
    const langThBtn = document.getElementById("langThBtn");
    const langEnBtn = document.getElementById("langEnBtn");
    const langSdBtn = document.getElementById("langSdBtn");
    if (langThBtn) {
      langThBtn.addEventListener("click", () => setGameLanguage("th", true));
    }
    if (langEnBtn) {
      langEnBtn.addEventListener("click", () => setGameLanguage("en", true));
    }
    if (langSdBtn) {
      langSdBtn.removeAttribute("title");
      let pressTimer = null;
      let isLongPress = false;

      const startPress = (e) => {
        isLongPress = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          isLongPress = true;
          if (navigator.vibrate) {
            try { navigator.vibrate(35); } catch(_) {}
          }
          if (window.Seedian && typeof window.Seedian.openModal === "function") {
            window.Seedian.openModal();
          }
        }, 420);
      };

      const cancelPress = () => {
        clearTimeout(pressTimer);
      };

      const endPress = (e) => {
        clearTimeout(pressTimer);
        if (!isLongPress) {
          setGameLanguage("seedian", true);
        }
      };

      langSdBtn.addEventListener("pointerdown", startPress);
      langSdBtn.addEventListener("pointerup", endPress);
      langSdBtn.addEventListener("pointerleave", cancelPress);
      langSdBtn.addEventListener("pointercancel", cancelPress);
      langSdBtn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (window.Seedian && typeof window.Seedian.openModal === "function") {
          window.Seedian.openModal();
        }
      });
    }
  });
})();

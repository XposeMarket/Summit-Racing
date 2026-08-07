from pathlib import Path
import json

root = Path('.')

def replace(path, old, new, count=1):
    p = root / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Missing expected text in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, count))

# ---- Device/mobile quality profile ----
game = root / 'game.js'
text = game.read_text()
old = """  const lowEndMobile = isMobile && ((memory > 0 && memory <= 4) || cores <= 4);\n  const performanceMode = forced === 'performance' || (forced !== 'high' && (isMobile || constrainedMac));\n  const maxRenderScale = isMobile ? (lowEndMobile ? 0.7 : 0.8) : (performanceMode ? 0.9 : 1.45);\n  const minRenderScale = isMobile ? (lowEndMobile ? 0.5 : 0.58) : (performanceMode ? 0.68 : 1);\n  return {\n    isMobile,\n    isIOS,\n    lowEndMobile,\n    performanceMode,\n    memory,\n    cores,\n    targetFps: isMobile ? (lowEndMobile ? 34 : 40) : (performanceMode ? 45 : 60),\n    menuFps: isMobile ? 20 : (performanceMode ? 24 : 60),\n    maxRenderScale,\n    minRenderScale\n  };"""
new = """  const lowEndMobile = isMobile && ((memory > 0 && memory <= 4) || cores <= 4);\n  const storedMobileQuality = localStorage.getItem('summitRushMobileGraphics');\n  const mobileHd = isMobile && forced !== 'performance' && (forced === 'high' || forced === 'hd' || storedMobileQuality === 'hd' || (!lowEndMobile && storedMobileQuality !== 'performance'));\n  // Mobile HD keeps the lightweight scene/material profile, but raises actual raster\n  // resolution, enables MSAA and improves texture filtering. This is far cheaper than\n  // switching every object back to the full desktop rendering path.\n  const performanceMode = forced === 'performance' || (forced !== 'high' && forced !== 'hd' && (isMobile || constrainedMac));\n  const maxRenderScale = isMobile ? (mobileHd ? (lowEndMobile ? 1.05 : 1.25) : (lowEndMobile ? 0.72 : 0.86)) : (performanceMode ? 0.9 : 1.45);\n  const minRenderScale = isMobile ? (mobileHd ? (lowEndMobile ? 0.82 : 0.95) : (lowEndMobile ? 0.55 : 0.68)) : (performanceMode ? 0.68 : 1);\n  return {\n    isMobile,\n    isIOS,\n    lowEndMobile,\n    mobileHd,\n    performanceMode,\n    memory,\n    cores,\n    targetFps: isMobile ? (mobileHd ? (lowEndMobile ? 32 : 38) : (lowEndMobile ? 34 : 40)) : (performanceMode ? 45 : 60),\n    menuFps: isMobile ? (mobileHd ? 24 : 20) : (performanceMode ? 24 : 60),\n    maxRenderScale,\n    minRenderScale\n  };"""
if old not in text:
    raise SystemExit('device profile block not found')
text = text.replace(old, new, 1)
text = text.replace("texture.anisotropy = DEVICE_PROFILE.performanceMode ? 2 : 8;", "texture.anisotropy = DEVICE_PROFILE.mobileHd ? 8 : (DEVICE_PROFILE.performanceMode ? 2 : 8);", 1)
text = text.replace("this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:!this.performanceMode&&!this.isMobile,powerPreference:'high-performance',alpha:false,stencil:false,preserveDrawingBuffer:false});", "this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:this.profile.mobileHd||(!this.performanceMode&&!this.isMobile),powerPreference:'high-performance',alpha:false,stencil:false,preserveDrawingBuffer:false});", 1)
text = text.replace("this.showroomRenderer=new THREE.WebGLRenderer({canvas:this.showroomCanvas,antialias:!this.performanceMode,alpha:false,powerPreference:'high-performance',stencil:false,preserveDrawingBuffer:false});", "this.showroomRenderer=new THREE.WebGLRenderer({canvas:this.showroomCanvas,antialias:this.profile.mobileHd||!this.performanceMode,alpha:false,powerPreference:'high-performance',stencil:false,preserveDrawingBuffer:false});", 1)
text = text.replace("this.storage=this.loadStorage();this.selectedVehicle=0;this.selectedTrack=0;this.selectedDifficulty=this.storage.difficulty||'easy';this.steeringMode=localStorage.getItem('summitRushSteeringMode')==='arrows'?'arrows':'joystick';this.releaseSteeringJoystick=null;", "this.storage=this.loadStorage();this.selectedVehicle=0;this.selectedTrack=0;this.selectedDifficulty=this.storage.difficulty||'easy';this.steeringMode=localStorage.getItem('summitRushSteeringMode')==='arrows'?'arrows':'joystick';this.mobileGraphicsMode=this.profile.mobileHd?'hd':'performance';this.releaseSteeringJoystick=null;", 1)
text = text.replace("this.ui=this.bindUI();this.setSteeringMode(this.steeringMode,false);this.buildMenuCards();", "this.ui=this.bindUI();this.setSteeringMode(this.steeringMode,false);this.setMobileGraphicsMode(this.mobileGraphicsMode,false);this.buildMenuCards();", 1)
text = text.replace("steeringModeJoystick:$('#steeringModeJoystick'),steeringModeArrows:$('#steeringModeArrows'),multiplayerRaceLabel", "steeringModeJoystick:$('#steeringModeJoystick'),steeringModeArrows:$('#steeringModeArrows'),mobileGraphicsPerformance:$('#mobileGraphicsPerformance'),mobileGraphicsHd:$('#mobileGraphicsHd'),multiplayerRaceLabel", 1)

needle = """  setSteeringMode(mode,persist=true){\n    this.steeringMode=mode==='arrows'?'arrows':'joystick';\n    document.body.classList.toggle('steering-arrows-mode',this.steeringMode==='arrows');\n    document.body.classList.toggle('steering-joystick-mode',this.steeringMode==='joystick');\n    this.ui.steeringModeJoystick?.classList.toggle('selected',this.steeringMode==='joystick');\n    this.ui.steeringModeArrows?.classList.toggle('selected',this.steeringMode==='arrows');\n    this.ui.steeringModeJoystick?.setAttribute('aria-pressed',String(this.steeringMode==='joystick'));\n    this.ui.steeringModeArrows?.setAttribute('aria-pressed',String(this.steeringMode==='arrows'));\n    if(persist)localStorage.setItem('summitRushSteeringMode',this.steeringMode);\n    this.resetInputs();\n  }\n"""
insert = needle + """  setMobileGraphicsMode(mode,persist=true){\n    this.mobileGraphicsMode=mode==='hd'?'hd':'performance';\n    const hd=this.mobileGraphicsMode==='hd';\n    document.body.classList.toggle('mobile-hd-mode',hd);\n    this.ui.mobileGraphicsHd?.classList.toggle('selected',hd);\n    this.ui.mobileGraphicsPerformance?.classList.toggle('selected',!hd);\n    this.ui.mobileGraphicsHd?.setAttribute('aria-pressed',String(hd));\n    this.ui.mobileGraphicsPerformance?.setAttribute('aria-pressed',String(!hd));\n    if(persist){\n      localStorage.setItem('summitRushMobileGraphics',this.mobileGraphicsMode);\n      // Renderer antialiasing is a context-creation option, so reload once when\n      // changing modes. The race/menu state is intentionally not persisted.\n      if(hd!==this.profile.mobileHd)location.reload();\n    }\n  }\n"""
if needle not in text:
    raise SystemExit('setSteeringMode block not found')
text = text.replace(needle, insert, 1)
text = text.replace("this.ui.steeringModeArrows?.addEventListener('click',()=>this.setSteeringMode('arrows'));\n    this.bindTouchControls();", "this.ui.steeringModeArrows?.addEventListener('click',()=>this.setSteeringMode('arrows'));\n    this.ui.mobileGraphicsPerformance?.addEventListener('click',()=>this.setMobileGraphicsMode('performance'));\n    this.ui.mobileGraphicsHd?.addEventListener('click',()=>this.setMobileGraphicsMode('hd'));\n    this.bindTouchControls();", 1)
text = text.replace("this.showroomRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.isMobile?0.62:(this.performanceMode?0.82:1.25)));", "this.showroomRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.isMobile?(this.profile.mobileHd?1.1:0.72):(this.performanceMode?0.82:1.25)));", 1)
text = text.replace("const maxScale=this.isMobile?Math.min(this.profile.maxRenderScale,.8):(this.performanceMode?this.profile.maxRenderScale:1.45);", "const maxScale=this.isMobile?this.profile.maxRenderScale:(this.performanceMode?this.profile.maxRenderScale:1.45);", 1)

game.write_text(text)

# ---- Pause menu graphics selector + cache bump ----
index = root / 'index.html'
html = index.read_text()
steering = """        <div class=\"pause-settings\" aria-label=\"Touch steering settings\">\n          <div class=\"pause-setting-heading\"><span>TOUCH STEERING</span><small>Choose the control style used on phones and tablets.</small></div>\n          <div class=\"steering-mode-options\" role=\"group\" aria-label=\"Touch steering style\">\n            <button id=\"steeringModeJoystick\" class=\"steering-mode-button\" type=\"button\" aria-pressed=\"true\"><strong>JOYSTICK</strong><small>Analog steering</small></button>\n            <button id=\"steeringModeArrows\" class=\"steering-mode-button\" type=\"button\" aria-pressed=\"false\"><strong>LEFT / RIGHT</strong><small>Digital buttons</small></button>\n          </div>\n        </div>\n"""
graphics = steering + """        <div class=\"pause-settings mobile-graphics-settings\" aria-label=\"Mobile graphics settings\">\n          <div class=\"pause-setting-heading\"><span>MOBILE GRAPHICS</span><small>HD is sharper; Performance protects frame rate on older phones.</small></div>\n          <div class=\"steering-mode-options graphics-mode-options\" role=\"group\" aria-label=\"Mobile graphics quality\">\n            <button id=\"mobileGraphicsPerformance\" class=\"steering-mode-button\" type=\"button\" aria-pressed=\"false\"><strong>PERFORMANCE</strong><small>Lower resolution</small></button>\n            <button id=\"mobileGraphicsHd\" class=\"steering-mode-button\" type=\"button\" aria-pressed=\"true\"><strong>HD</strong><small>Sharper image + filtering</small></button>\n          </div>\n        </div>\n"""
if steering not in html:
    raise SystemExit('pause steering HTML not found')
html = html.replace(steering, graphics, 1)
html = html.replace('style.css?v=1.7.7', 'style.css?v=1.7.8')
html = html.replace('game.js?v=1.7.7', 'game.js?v=1.7.8')
index.write_text(html)

# ---- CSS ----
style = root / 'style.css'
css = style.read_text()
marker = '/* v1.7.8 mobile HD rendering controls */'
if marker not in css:
    css += r'''

/* v1.7.8 mobile HD rendering controls */
body:not(.touch-mode) .mobile-graphics-settings { display: none; }
body.touch-mode.mobile-hd-mode #gameCanvas { image-rendering: auto; }
.mobile-graphics-settings .steering-mode-button.selected strong { color: #fff; }
@media (hover: none) and (pointer: coarse) and (orientation: landscape) {
  .mobile-graphics-settings { margin-top: -8px; }
  .mobile-graphics-settings .pause-setting-heading small { max-width: 270px; text-align: right; line-height: 1.25; }
}
'''
style.write_text(css)

# ---- Version/docs ----
pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
pkg['version'] = '1.7.8'
pkg['description'] = 'Landscape-first Three.js racing game with larger mobile controls, closer chase camera, selectable Mobile HD rendering, sharper texture filtering, 12-car grids, randomized AI racing lines, eight circuits, customization, hosted single-player deployment detection, and same-Wi-Fi room multiplayer.'
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

readme = root / 'README.md'
r = readme.read_text().replace('# Summit Rush v1.7.7', '# Summit Rush v1.7.8', 1)
section = '''\n## v1.7.8 — Mobile HD graphics\n\n- Added **Mobile Graphics** in the pause settings with Performance and HD modes.\n- HD is the default on capable phones; constrained phones stay on the lighter profile unless HD is chosen manually.\n- Raised mobile internal render resolution from the old sub-1.0 pixel ratio to an adaptive 0.95–1.25 range on capable phones.\n- Enabled antialiasing in Mobile HD mode for much cleaner car, barrier, road-edge and building silhouettes.\n- Raised texture anisotropic filtering from 2x to 8x in HD mode so asphalt, grass and trackside textures stay sharper at shallow camera angles.\n- Raised the mobile showroom render resolution as well.\n- Adaptive quality can still reduce resolution when frame rate falls, rather than forcing a permanently blurry image.\n- v1.7.7 larger joystick/arrows and closer mobile chase camera remain included.\n\n'''
if '## v1.7.8 — Mobile HD graphics' not in r:
    pos = r.find('\n', r.find('\n') + 1)
    r = r[:pos+1] + section + r[pos+1:]
readme.write_text(r)

print('v1.7.8 mobile HD patch applied')

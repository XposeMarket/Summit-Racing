from pathlib import Path
import json

root = Path('.')

def require_replace(path, old, new, count=1):
    p = root / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Missing expected text in {path}: {old[:120]!r}')
    text = text.replace(old, new, count)
    p.write_text(text)

# Mobile chase camera: stay closer at speed and reduce boost pullback/FOV expansion.
require_replace('game.js', 'dist=this.isMobile?5.45:7.2', 'dist=this.isMobile?5.1:7.2')
require_replace('game.js', 'lookAhead=this.isMobile?4.2:5', 'lookAhead=this.isMobile?4.0:5')
require_replace('game.js', 'this.camera.fov=this.isMobile?62:68', 'this.camera.fov=this.isMobile?61.5:68')
require_replace('game.js', 'mobile?lerp(5.15,6.25,clamp(speedRatio,0,1)):lerp(6.8,8.6,clamp(speedRatio,0,1)))+(this.player.boosting?(mobile?.48:1.3):0)', 'mobile?lerp(4.95,5.75,clamp(speedRatio,0,1)):lerp(6.8,8.6,clamp(speedRatio,0,1)))+(this.player.boosting?(mobile?.26:1.3):0)')
require_replace('game.js', "const targetFov=mobile?(this.player.boosting?69:62+speedRatio*1.5):(this.player.boosting?82:68+speedRatio*3)", "const targetFov=mobile?(this.player.boosting?66.5:61.5+speedRatio*1.0):(this.player.boosting?82:68+speedRatio*3)")

# Make both mobile steering schemes substantially easier to hit in landscape.
style = root / 'style.css'
css = style.read_text()
marker = '/* v1.7.7 larger mobile steering controls */'
if marker not in css:
    css += r'''

/* v1.7.7 larger mobile steering controls */
@media (hover: none) and (pointer: coarse) and (orientation: landscape) {
  .steering-joystick { width: 140px; }
  .joystick-ring { width: 126px; height: 126px; }
  .joystick-thumb { width: 60px; height: 60px; }
  .steering-arrows { width: 154px; }
  .steering-arrow-row { gap: 10px; }
  .steering-arrow-button { width: 70px !important; height: 86px !important; border-radius: 20px !important; }
  .steering-arrow-button span { font-size: 31px !important; }
}

@media (hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 430px) {
  .steering-joystick { width: 116px; }
  .joystick-ring { width: 102px; height: 102px; }
  .joystick-thumb { width: 50px; height: 50px; }
  .steering-arrows { width: 132px; }
  .steering-arrow-row { gap: 8px; }
  .steering-arrow-button { width: 60px !important; height: 74px !important; }
  .steering-arrow-button span { font-size: 27px !important; }
}
'''
style.write_text(css)

# Cache/version bump.
for filename in ('index.html',):
    p = root / filename
    p.write_text(p.read_text().replace('1.7.6', '1.7.7'))

pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
pkg['version'] = '1.7.7'
pkg['description'] = 'Landscape-first Three.js racing game with larger mobile joystick/arrow controls, a closer mobile chase camera, 12-car grids, persistent randomized AI racing lines, collision recovery, radius-based corner speed, eight circuits, customization, hosted single-player deployment detection, and same-Wi-Fi room multiplayer.'
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

readme = root / 'README.md'
text = readme.read_text()
if text.startswith('# Summit Rush v1.7.6'):
    text = text.replace('# Summit Rush v1.7.6', '# Summit Rush v1.7.7', 1)
section = '''\n## v1.7.7 — Larger mobile controls + closer camera\n\n- Increased the landscape analog joystick ring and thumb size for easier steering on phones.\n- Increased the Left / Right steering button hit areas and arrow icons.\n- Kept both control schemes larger even on short-height landscape phones where older media rules previously shrank them.\n- Pulled the mobile chase camera closer at normal and high speed.\n- Reduced boost camera pullback and FOV expansion so the car stays more prominent on screen.\n\n'''
if '## v1.7.7 — Larger mobile controls + closer camera' not in text:
    first_break = text.find('\n', text.find('\n') + 1)
    text = text[:first_break+1] + section + text[first_break+1:]
readme.write_text(text)

print('v1.7.7 patch applied')

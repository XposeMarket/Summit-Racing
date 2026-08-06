# Summit Rush v1.7.5

## v1.7.5 circuit, UI, and race-pace fixes

- Rebuilt the Spa start sector so the grid begins on a long straight instead of at the apex of the opening corner.
- Widened the La Source-style hairpin and smoothed its approach and exit.
- Realigned and moved the Spa pit building completely outside the racing surface.
- Limited the desktop circuit selector to three visible cards with vertical scrolling.
- Hard-clamped every human car to the same normal forward-speed cap when boost is inactive.
- AI reaches the full shared cap on genuine straights; difficulty still changes corner pace, braking, recovery, and aggression.
- Added short network dead-reckoning so remote cars visually maintain their real speed between snapshots.

Three.js racing game with eight circuits, 12-car grids, landscape mobile controls, customization, single-player career racing, and optional same-Wi-Fi multiplayer through the included Node server.

## Vercel / static hosting

Import this repository into Vercel with the project root unchanged. The hosted build runs the complete single-player game. Multiplayer is intentionally greyed out because static hosting cannot run the authoritative LAN WebSocket room server.

To use multiplayer, clone or download the repository on a Mac or Windows computer and run `start.command`, `start-performance.command`, `start.bat`, or `start-performance.bat`. Friends on the same Wi-Fi can then open the LAN URL shown by the launcher. When the game detects the local `/__summit/network.json` endpoint, Multiplayer enables automatically.

# Summit Rush v1.7.3 — Spa Circuit + Mobile/Multiplayer Hotfix

Summit Rush is a third-person Three.js arcade road racer with eight circuits, twelve-car grids, a live vehicle garage, mobile touch controls, AI racing, and real-time rooms for friends connected to the same Wi-Fi server.

## v1.7.3 expansion

- Added **Spa-Francorchamps**, a long Ardennes forest circuit based on the recognizable modern Grand Prix layout.
- The new circuit includes a steep Eau Rouge–Raidillon-style climb, a long Kemmel-style straight, Les Combes-inspired direction changes, a downhill technical middle sector, Pouhon-style sweepers, a fast Blanchimont-style return and a final chicane.
- Approximately 2.8 km of drivable in-game centerline, 19-turn presentation, 18.8 m road width and roughly 49 m of total elevation range.
- Added dense forest scenery, mountain backdrops, red/yellow kerbs, hillside grandstands and a modeled pit building.
- Spa is available in single-player and in the host's multiplayer track picker.
- Multiplayer track synchronization now accepts all eight circuit indexes.

## v1.7.2 fixes

- Pulled the landscape mobile chase camera significantly closer to the player car.
- Reduced mobile speed-based camera pullback and boost zoom-out.
- Narrowed the mobile FOV so the car remains visually prominent at speed.
- Added a host-controlled **AI Difficulty** selector to every multiplayer lobby.
- Multiplayer rooms now synchronize Easy, Medium, or Hard AI difficulty to every device before the race starts.
- AI top speed remains identical to the player cap on every setting; difficulty changes braking, corner speed, acceleration recovery, and aggression.
- Room cards now display the selected AI difficulty.


## v1.7.1 fixes

- Rebuilt the analog joystick around native Safari touch tracking so dragging reliably produces steering input.
- Verified steering direction against the desktop controls: dragging left matches **A**, and dragging right matches **D**.
- Added a pause-menu steering setting that switches between **Analog Joystick** and **Left / Right buttons**. The choice is saved in the browser.
- Moved the speed, gear, boost meter, and boost status underneath the top-right map/pause cluster and above the mobile pedals.
- Corrected elevation orientation so the road controls chassis pitch/roll without replacing the direction the player is actually steering.
- Applied the same road-plane orientation correction to remote multiplayer cars.

## Best launcher for the 8 GB Intel MacBook

Double-click **`start-performance.command`**.

The launcher will:

1. Start the authoritative game and multiplayer server on the MacBook.
2. Open Summit Rush on the Mac.
3. Print one or more Wi-Fi addresses, such as `http://192.168.1.42:4173/?quality=performance`.
4. Make that same address visible on the game homepage.

Keep the Terminal window open for the entire session. If macOS asks whether Node may accept incoming connections, click **Allow**.

If macOS blocks the command file, right-click it and choose **Open**.

## Join from a phone or another computer

1. Connect every device to the same normal home Wi-Fi network as the MacBook.
2. Open Safari, Chrome, or another modern browser.
3. Enter the Wi-Fi address printed by the launcher.
4. Rotate phones into **landscape orientation**.

A VPN, guest Wi-Fi, school/corporate Wi-Fi, or router client isolation can prevent devices from communicating. Everyone must open the address from the same Mac server; rooms are discovered automatically inside that server.

The server prefers port `4173` and automatically tries later ports if it is occupied.

## Multiplayer flow

1. Choose **MULTIPLAYER** on the new homepage.
2. Enter a username.
3. Host a room or select an open room from the live room browser.
4. Select or change your vehicle and body color at any time in the lobby.
5. The host selects the circuit by opening the scrollable track picker.
6. Press **READY UP**.
7. When every active driver is ready, the synchronized starting sequence begins automatically.
8. After the race, everyone receives the same ordered results sheet.
9. Select **NEXT — RETURN TO ROOM** to return to the same lobby for another race.

Rooms support up to **12 human drivers**. When fewer than twelve people race, AI cars fill the remaining grid positions. A person joining during an active race remains in the lobby and enters the next grid.

The Mac is the authoritative room server. Vehicle movement is exchanged through a lightweight WebSocket connection, while race start times, finishing order, room state, car selections, colors, and collision impulses are coordinated by the server.

## Landscape mobile interface

- Portrait mode displays a rotate-to-landscape prompt.
- The homepage, single-player garage, room browser, multiplayer lobby, pause menu, and results sheet are designed for sideways phone use.
- Steering defaults to an analog virtual joystick on the left. The pause menu can switch to dedicated Left / Right buttons.
- The larger Gas pedal sits on the right beside Brake and Boost.
- Steering, Gas, and Boost support simultaneous multi-touch input.
- The minimap is in the top-right, immediately left of the pause button.
- Safe-area spacing supports notches, rounded corners, and the Home indicator.
- Swipeable card rows keep vehicle, circuit, paint, and rim selection usable on narrow displays.
- Pull-to-refresh, accidental zooming, scrolling, and text selection are suppressed during races.

## Race balance in v1.7

All player vehicles and AI racers now share the same normal straight-line top-speed cap: approximately **241 km/h / 150 mph**.

Vehicle choice still changes acceleration, grip, steering response, drift behavior, and boost output. Boost temporarily raises the player's available speed above the normal race cap.

Difficulty no longer imposes a hidden AI top-speed ceiling:

- **Easy** — same top speed, earlier braking and more forgiving corner exits.
- **Medium** — same top speed, later braking and stronger acceleration out of turns.
- **Hard** — same top speed, committed corner pace, quicker recovery, and more aggression.

Hard mode should require strategic boost use after mistakes, not constant boosting for basic straight-line parity.

## Road and elevation contact

Cars use a road-surface orientation basis rather than only rotating around the vertical axis. The local road plane controls pitch and roll, while the car's own steering yaw remains its forward direction. This prevents the old uphill/downhill behavior where the body could suddenly point along the track centerline instead of where the player was driving.

Roads retain textured top, underside, and side geometry as a fallback on steep elevation changes.

## Collision behavior

- Human, network, and AI cars use larger solid contact envelopes.
- Normal and lateral impulses affect both cars.
- Side contact has greater friction, so cars press against one another instead of instantly slipping apart.
- Multiplayer impact impulses are relayed to the other driver's simulation.
- AI racers can push and unsettle the player using the same collision model.

## Single-player features

- Eight road circuits, including the Spa-Francorchamps-inspired Ardennes course and four other long Grand Prix-style layouts.
- Twelve-car grid with eleven AI opponents.
- Three selectable detailed multi-part vehicles.
- Full showroom garage with tiled flooring, concrete and metal walls, wheel racks, cabinets, overhead lighting, and a rotating turntable.
- Body, trim, and wheel colors with presets and native full-spectrum color pickers.
- Four modeled rim styles.
- F1-style starting lights and countdown.
- Three-lap races, position, lap, timer, gear, speed, boost, and minimap HUD.
- Persistent wins, completed races, best times, difficulty, and per-car customization.

## Desktop controls

- **W** — throttle
- **S** — brake / reverse
- **A / D** — steer
- **Shift** — turbo boost / boost-assisted powerslide
- **Escape** — pause

## Performance profile

The forced performance launcher is recommended for Intel Macs with 8 GB RAM. It retains all racers and gameplay systems while reducing GPU and memory pressure through:

- Adaptive internal render resolution.
- Disabled real-time shadows and expensive full-screen filters.
- Lower terrain and distant scenery density.
- Instanced road markings, guardrails, and vegetation.
- Lightweight AI/network car detail while the player and showroom cars remain detailed.
- Cached minimap background.
- Precomputed track samples for AI movement.
- Lower-frequency HUD and network snapshot updates.
- Reduced showroom resolution on phones.

You can also force a quality mode manually:

- `http://localhost:4173/?quality=performance`
- `http://localhost:4173/?quality=high`

## Windows

Double-click `start.bat`, or use `start-performance.bat` for lower-power hardware. Both expose the game and multiplayer rooms to other devices on the same Wi-Fi.

## Manual start

From the game folder:

```bash
node server.js
```

No `npm install` is required for the local room server.

The game currently imports the pinned Three.js `0.185.1` browser module from jsDelivr. Each device therefore needs internet access when loading that library. The room server, game code, procedural textures, cars, rims, garage, tracks, terrain, props, physics, UI, and save data are served or generated locally.

## Save data

Career records, username, difficulty, and vehicle customizations are stored in each browser's `localStorage`. Different phones and computers keep separate local career records, while multiplayer room and race state is held by the Mac server for the current session.

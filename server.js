const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

const root = __dirname;
const preferredPort = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const startPath = process.env.START_PATH || '';
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp'
};

const clients = new Map();
const rooms = new Map();
let nextClientId = 1;

function cleanText(value, max = 24) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
}
function cleanColor(value, fallback = '#ff4e1f') {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}
function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}
function getLanAddresses() {
  const ignored = /^(lo|awdl|llw|utun|bridge|docker|veth|br-|vmnet|vbox|tailscale)/i;
  const preferred = /^(en0|en1|wi-?fi|wlan|ethernet)/i;
  const found = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const family = typeof entry.family === 'string' ? entry.family : String(entry.family);
      if (family !== 'IPv4' && family !== '4') continue;
      if (entry.internal || entry.address.startsWith('169.254.') || ignored.test(name)) continue;
      found.push({ name, address: entry.address, score: preferred.test(name) ? 0 : 1 });
    }
  }
  return found.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
}
function sendJsonHttp(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate', 'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function websocketFrame(value, opcode = 0x1) {
  const payload = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2); header[1] = payload.length;
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4); header[1] = 126; header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10); header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, payload]);
}
function wsSend(client, message) {
  if (!client || client.socket.destroyed || !client.socket.writable) return;
  try { client.socket.write(websocketFrame(message)); } catch (_) {}
}
function wsBroadcast(room, message, exceptId = null) {
  for (const player of room.players.values()) {
    if (player.id === exceptId) continue;
    wsSend(clients.get(player.id), message);
  }
}
function publicPlayer(player, room) {
  return {
    id: player.id, name: player.name, host: room.hostId === player.id,
    ready: !!player.ready, waiting: !!player.waiting,
    vehicleIndex: player.vehicleIndex || 0,
    customization: player.customization || { bodyColor: '#ff4e1f', trimColor: '#111318', wheelColor: '#bfc4ca', rimStyle: 'five' }
  };
}
function publicRoom(room, includePlayers = false) {
  const value = {
    id: room.id, name: room.name, hostId: room.hostId, trackIndex: room.trackIndex, difficulty: room.difficulty || 'easy',
    state: room.state, playerCount: room.players.size, maxPlayers: 12,
    raceId: room.raceId || null, raceStartAt: room.raceStartAt || null
  };
  if (includePlayers) value.players = [...room.players.values()].map(p => publicPlayer(p, room));
  return value;
}
function roomList() {
  return [...rooms.values()].map(room => publicRoom(room, false));
}
function broadcastRoomList() {
  const payload = { type: 'room_list', rooms: roomList() };
  for (const client of clients.values()) wsSend(client, payload);
}
function broadcastRoomState(room) {
  wsBroadcast(room, { type: 'room_state', room: publicRoom(room, true) });
  broadcastRoomList();
}
function leaveRoom(client, disconnecting = false) {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  client.roomId = null;
  if (!room) return;
  room.players.delete(client.id);
  if (room.raceParticipants?.has(client.id) && !room.finishers?.has(client.id)) {
    room.finishers.set(client.id, { id: client.id, name: client.name, time: null, dnf: true });
  }
  if (!room.players.size) {
    clearTimeout(room.finishTimer); rooms.delete(room.id); broadcastRoomList(); return;
  }
  if (room.hostId === client.id) room.hostId = room.players.keys().next().value;
  if (!disconnecting) wsSend(client, { type: 'left_room' });
  maybeFinalizeRace(room);
  broadcastRoomState(room);
}
function joinRoom(client, room) {
  if (!room || room.players.size >= 12) return wsSend(client, { type: 'error', message: 'That room is full.' });
  leaveRoom(client);
  const player = {
    id: client.id, name: client.name || `DRIVER ${client.id}`, ready: false,
    waiting: room.state === 'racing', vehicleIndex: client.vehicleIndex || 0,
    customization: client.customization || { bodyColor: '#ff4e1f', trimColor: '#111318', wheelColor: '#bfc4ca', rimStyle: 'five' }
  };
  room.players.set(client.id, player); client.roomId = room.id;
  wsSend(client, { type: 'joined_room', room: publicRoom(room, true), selfId: client.id });
  broadcastRoomState(room);
}
function maybeStartRace(room) {
  if (room.state !== 'lobby') return;
  const active = [...room.players.values()].filter(p => !p.waiting);
  if (active.length < 2 || !active.every(p => p.ready)) return;
  room.state = 'racing'; room.raceId = `${room.id}-${Date.now().toString(36)}`;
  room.raceStartAt = Date.now() + 4600;
  room.raceParticipants = new Set(active.map(p => p.id));
  room.finishers = new Map();
  room.firstFinishAt = null;
  for (const player of room.players.values()) player.ready = false;
  const grid = active.map(p => publicPlayer(p, room));
  wsBroadcast(room, { type: 'race_start', room: publicRoom(room, true), raceId: room.raceId, startAt: room.raceStartAt, trackIndex: room.trackIndex, difficulty: room.difficulty || 'easy', players: grid });
  broadcastRoomState(room);
}
function finalizeRace(room) {
  if (!room || room.state !== 'racing') return;
  clearTimeout(room.finishTimer);
  const participantIds = [...(room.raceParticipants || [])];
  const records = participantIds.map(id => {
    const finished = room.finishers.get(id);
    const player = room.players.get(id);
    return finished || { id, name: player?.name || 'DISCONNECTED', time: null, dnf: true };
  });
  records.sort((a, b) => {
    if (a.dnf && !b.dnf) return 1;
    if (!a.dnf && b.dnf) return -1;
    return (a.time ?? Infinity) - (b.time ?? Infinity);
  });
  room.state = 'lobby'; room.raceStartAt = null;
  for (const player of room.players.values()) { player.ready = false; player.waiting = false; }
  wsBroadcast(room, { type: 'race_results', raceId: room.raceId, results: records });
  room.raceParticipants = new Set(); room.finishers = new Map();
  setTimeout(() => broadcastRoomState(room), 150);
}
function maybeFinalizeRace(room) {
  if (!room || room.state !== 'racing' || !room.raceParticipants) return;
  const accounted = [...room.raceParticipants].every(id => room.finishers.has(id));
  if (accounted) finalizeRace(room);
}

function handleMessage(client, message) {
  let data;
  try { data = JSON.parse(message); } catch { return; }
  if (!data || typeof data.type !== 'string') return;
  switch (data.type) {
    case 'hello': {
      client.name = cleanText(data.name, 16) || `DRIVER ${client.id}`;
      wsSend(client, { type: 'hello', id: client.id, name: client.name, rooms: roomList() });
      break;
    }
    case 'list_rooms': wsSend(client, { type: 'room_list', rooms: roomList() }); break;
    case 'create_room': {
      if (!client.name) return wsSend(client, { type: 'error', message: 'Choose a username first.' });
      const id = roomCode();
      const room = { id, name: `${client.name}'S ROOM`, hostId: client.id, trackIndex: 0, difficulty: 'easy', state: 'lobby', players: new Map(), raceId: null, raceStartAt: null, raceParticipants: new Set(), finishers: new Map() };
      rooms.set(id, room); joinRoom(client, room); break;
    }
    case 'join_room': {
      const room = rooms.get(cleanText(data.roomId, 8).toUpperCase());
      if (!room) return wsSend(client, { type: 'error', message: 'That room no longer exists.' });
      joinRoom(client, room); break;
    }
    case 'leave_room': leaveRoom(client); break;
    case 'update_player': {
      const room = rooms.get(client.roomId), player = room?.players.get(client.id); if (!room || !player) return;
      player.vehicleIndex = Math.max(0, Math.min(2, Number(data.vehicleIndex) || 0));
      const c = data.customization || {};
      player.customization = {
        bodyColor: cleanColor(c.bodyColor), trimColor: cleanColor(c.trimColor, '#111318'),
        wheelColor: cleanColor(c.wheelColor, '#bfc4ca'), rimStyle: ['five', 'mesh', 'turbine', 'classic'].includes(c.rimStyle) ? c.rimStyle : 'five'
      };
      client.vehicleIndex = player.vehicleIndex; client.customization = player.customization;
      broadcastRoomState(room); break;
    }
    case 'set_track': {
      const room = rooms.get(client.roomId); if (!room || room.hostId !== client.id || room.state !== 'lobby') return;
      room.trackIndex = Math.max(0, Math.min(7, Number(data.trackIndex) || 0)); broadcastRoomState(room); break;
    }
    case 'set_difficulty': {
      const room = rooms.get(client.roomId); if (!room || room.hostId !== client.id || room.state !== 'lobby') return;
      room.difficulty = ['easy', 'medium', 'hard'].includes(data.difficulty) ? data.difficulty : 'easy';
      broadcastRoomState(room); break;
    }
    case 'ready': {
      const room = rooms.get(client.roomId), player = room?.players.get(client.id); if (!room || !player || room.state !== 'lobby') return;
      player.ready = !!data.ready; player.waiting = false; broadcastRoomState(room); maybeStartRace(room); break;
    }
    case 'snapshot': {
      const room = rooms.get(client.roomId); if (!room || room.state !== 'racing' || data.raceId !== room.raceId || !room.raceParticipants.has(client.id)) return;
      const snapshot = {
        type: 'snapshot', id: client.id, raceId: room.raceId,
        x: Number(data.x) || 0, y: Number(data.y) || 0, z: Number(data.z) || 0,
        yaw: Number(data.yaw) || 0, pitch: Number(data.pitch) || 0, roll: Number(data.roll) || 0,
        speed: Number(data.speed) || 0, lap: Number(data.lap) || 0, progress: Number(data.progress) || 0,
        boosting: !!data.boosting, timestamp: Date.now()
      };
      wsBroadcast(room, snapshot, client.id); break;
    }
    case 'collision': {
      const room = rooms.get(client.roomId); if (!room || room.state !== 'racing' || data.raceId !== room.raceId) return;
      const target = clients.get(Number(data.targetId));
      if (!target || target.roomId !== room.id) return;
      const impulse = data.impulse || {};
      wsSend(target, { type: 'collision', raceId: room.raceId, fromId: client.id, impulse: { x: Number(impulse.x) || 0, z: Number(impulse.z) || 0 } });
      break;
    }
    case 'finish': {
      const room = rooms.get(client.roomId); if (!room || room.state !== 'racing' || data.raceId !== room.raceId || !room.raceParticipants.has(client.id) || room.finishers.has(client.id)) return;
      room.finishers.set(client.id, { id: client.id, name: client.name, time: Math.max(0, Number(data.time) || 0), dnf: false });
      if (!room.firstFinishAt) {
        room.firstFinishAt = Date.now();
        room.finishTimer = setTimeout(() => finalizeRace(room), 45000);
      }
      wsBroadcast(room, { type: 'driver_finished', id: client.id, name: client.name, time: Number(data.time) || 0 });
      maybeFinalizeRace(room); break;
    }
    case 'ping': wsSend(client, { type: 'pong', now: Date.now() }); break;
    default: break;
  }
}

function parseFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length >= 2) {
    const first = client.buffer[0], second = client.buffer[1];
    const opcode = first & 0x0f, masked = !!(second & 0x80);
    let length = second & 0x7f, offset = 2;
    if (length === 126) { if (client.buffer.length < 4) return; length = client.buffer.readUInt16BE(2); offset = 4; }
    else if (length === 127) { if (client.buffer.length < 10) return; const big = client.buffer.readBigUInt64BE(2); if (big > BigInt(1e7)) return client.socket.destroy(); length = Number(big); offset = 10; }
    const maskBytes = masked ? 4 : 0;
    if (client.buffer.length < offset + maskBytes + length) return;
    const mask = masked ? client.buffer.subarray(offset, offset + 4) : null;
    offset += maskBytes;
    const payload = Buffer.from(client.buffer.subarray(offset, offset + length));
    client.buffer = client.buffer.subarray(offset + length);
    if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    if (opcode === 0x8) { client.socket.end(websocketFrame('', 0x8)); return; }
    if (opcode === 0x9) { client.socket.write(websocketFrame(payload, 0xA)); continue; }
    if (opcode === 0x1) handleMessage(client, payload.toString('utf8'));
  }
}

function attachWebSocket(server) {
  server.on('upgrade', (req, socket) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/__summit/ws' || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') return socket.destroy();
    const key = req.headers['sec-websocket-key']; if (!key) return socket.destroy();
    const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`, '\r\n'
    ].join('\r\n'));
    const client = { id: nextClientId++, socket, buffer: Buffer.alloc(0), name: '', roomId: null, vehicleIndex: 0, customization: null };
    clients.set(client.id, client);
    socket.setNoDelay(true);
    socket.on('data', chunk => parseFrames(client, chunk));
    socket.on('error', () => {});
    socket.on('close', () => { leaveRoom(client, true); clients.delete(client.id); });
  });
}

function createServer(port) {
  const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/', clean = decodeURIComponent(rawUrl.split('?')[0]);
    if (clean === '/__summit/network.json') {
      const addresses = getLanAddresses();
      return sendJsonHttp(res, 200, {
        port, startPath, hostname: os.hostname(), websocket: true,
        localUrl: `http://localhost:${port}${startPath}`,
        lanUrls: addresses.map(({ name, address }) => ({ interface: name, address, url: `http://${address}:${port}${startPath}` }))
      });
    }
    const requested = clean === '/' ? '/index.html' : clean;
    const file = path.normalize(path.join(root, requested));
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500); res.end(error.code === 'ENOENT' ? 'Not found' : 'Server error'); return; }
      res.writeHead(200, {
        'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0', 'X-Content-Type-Options': 'nosniff'
      });
      if (req.method === 'HEAD') res.end(); else res.end(data);
    });
  });
  attachWebSocket(server);
  return server;
}

function launch(port) {
  const localUrl = `http://localhost:${port}${startPath}`, addresses = getLanAddresses();
  console.log('\n============================================================');
  console.log('  SUMMIT RUSH v1.7.3 — SPA + MOBILE/MULTIPLAYER HOTFIX');
  console.log('============================================================');
  console.log(`  This Mac:  ${localUrl}`);
  if (addresses.length) {
    console.log('\n  PHONE / FRIENDS — open on the same Wi-Fi:');
    addresses.forEach(({ name, address }) => console.log(`  ${name.padEnd(8)} http://${address}:${port}${startPath}`));
  } else {
    console.log('\n  No Wi-Fi/LAN IPv4 address was detected yet.');
  }
  console.log('\n  Multiplayer rooms live inside this Terminal server.');
  console.log('  Keep this window open. If macOS asks, click Allow.');
  console.log('============================================================\n');
  if (!process.env.NO_OPEN) {
    const command = process.platform === 'win32' ? `start "" "${localUrl}"` : process.platform === 'darwin' ? `open "${localUrl}"` : `xdg-open "${localUrl}"`;
    exec(command, () => {});
  }
}
function listen(port, attemptsLeft = 8) {
  const server = createServer(port);
  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && attemptsLeft > 0) { console.log(`Port ${port} is busy; trying ${port + 1}...`); listen(port + 1, attemptsLeft - 1); return; }
    console.error(`Unable to start Summit Rush: ${error.message}`); process.exitCode = 1;
  });
  server.listen(port, host, () => launch(port));
}
listen(preferredPort);

// Сеть: WebRTC через Trystero (поиск напарника через публичные Nostr-реле, без своего сервера).
// Режим ?net=local — BroadcastChannel между вкладками одного браузера, для отладки без интернета.
const APP_ID = 'dvoe-v-lodke-nekit-v1';
const TRYSTERO_URL = 'https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm';

export async function connect(code, mode) {
  if (mode === 'local') return localRoom(code);
  const { joinRoom, selfId } = await import(TRYSTERO_URL);
  const room = joinRoom({ appId: APP_ID }, 'room-' + code);
  return {
    selfId,
    onJoin(cb) { room.onPeerJoin = cb; },
    onLeave(cb) { room.onPeerLeave = cb; },
    action(name) {
      const a = room.makeAction(name);
      return {
        send: (data, to) => a.send(data, to ? { target: to } : undefined),
        on: (cb) => { a.onMessage = (data, { peerId }) => cb(data, peerId); },
      };
    },
    ping: (id) => room.ping(id),
    leave: () => room.leave(),
  };
}

function localRoom(code) {
  const ch = new BroadcastChannel('lodka-' + code);
  const selfId = Math.random().toString(36).slice(2, 10);
  const peers = new Map();
  const handlers = {};
  let onJoin = () => {};
  let onLeave = () => {};
  const post = (m) => ch.postMessage({ ...m, from: selfId });

  const seen = (id, reply) => {
    if (!peers.has(id)) {
      peers.set(id, Date.now());
      onJoin(id);
      if (reply) post({ k: 'ack', to: id });
    } else peers.set(id, Date.now());
  };
  ch.onmessage = ({ data: m }) => {
    if (m.to && m.to !== selfId) return;
    if (m.k === 'hello') seen(m.from, true);
    else if (m.k === 'ack' || m.k === 'hb') seen(m.from, false);
    else if (m.k === 'bye') { if (peers.delete(m.from)) onLeave(m.from); }
    else if (m.k === 'msg') { peers.set(m.from, Date.now()); handlers[m.n]?.(m.d, m.from); }
  };
  setTimeout(() => post({ k: 'hello' }), 50);
  const hb = setInterval(() => {
    post({ k: 'hb' });
    const now = Date.now();
    for (const [id, t] of peers) if (now - t > 4000) { peers.delete(id); onLeave(id); }
  }, 1000);
  const bye = () => post({ k: 'bye' });
  addEventListener('pagehide', bye);

  return {
    selfId,
    onJoin(cb) { onJoin = cb; for (const id of peers.keys()) cb(id); },
    onLeave(cb) { onLeave = cb; },
    action(name) {
      return {
        send: (d, to) => post({ k: 'msg', n: name, d, to }),
        on: (cb) => { handlers[name] = cb; },
      };
    },
    ping: async () => 1,
    leave() { bye(); clearInterval(hb); removeEventListener('pagehide', bye); ch.close(); },
  };
}

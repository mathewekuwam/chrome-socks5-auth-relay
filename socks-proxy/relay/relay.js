// Local SOCKS5 relay: accepts unauthenticated SOCKS5 from Chrome on localhost,
// logs in to your upstream SOCKS5 proxy with username/password (RFC 1929),
// and pipes the traffic. No dependencies. Usage: node relay.js [config.json]
const net = require("net");
const fs = require("fs");
const dns = require("dns").promises;
const path = require("path");

const cfg = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, "config.json"), "utf8"));

const REPLY = {
  1: "general failure (proxy error, quota/bandwidth exhausted, or target blocked)",
  2: "connection not allowed by the proxy's ruleset (target/port blocked)",
  3: "network unreachable", 4: "host unreachable", 5: "connection refused by target",
  6: "TTL expired", 7: "command not supported",
  8: "address type not supported (proxy does not accept hostnames; set resolveLocally: true)"
};

function describeTarget(atyp, addr, port) {
  const p = port.readUInt16BE(0);
  if (atyp === 3) return `${addr.subarray(1).toString()}:${p}`;
  if (atyp === 1) return `${[...addr].join(".")}:${p}`;
  return `[ipv6]:${p}`;
}

// Read exactly n bytes from a socket (works for handshake steps).
function readBytes(sock, n) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      if (buf.length >= n) {
        cleanup();
        sock.pause();
        if (buf.length > n) sock.unshift(buf.subarray(n));
        resolve(buf.subarray(0, n));
      }
    };
    const onEnd = () => { cleanup(); reject(new Error("closed")); };
    const onErr = (e) => { cleanup(); reject(e); };
    const cleanup = () => {
      sock.off("data", onData); sock.off("end", onEnd);
      sock.off("error", onErr); sock.off("close", onEnd);
    };
    sock.on("data", onData); sock.on("end", onEnd);
    sock.on("error", onErr); sock.on("close", onEnd);
    sock.resume();
  });
}

function reply(sock, code) {
  // VER, REP, RSV, ATYP=IPv4, BND.ADDR=0.0.0.0, BND.PORT=0
  sock.write(Buffer.from([5, code, 0, 1, 0, 0, 0, 0, 0, 0]));
}

async function connectUpstream(atyp, addrBytes, portBytes) {
  const up = net.connect(cfg.upstreamPort, cfg.upstreamHost);
  up.setNoDelay(true);
  up.setTimeout(15000, () => up.destroy(new Error("upstream timed out")));
  await new Promise((res, rej) => { up.once("connect", res); up.once("error", rej); });
  up.on("error", () => {}); // later errors handled by pipe/close
  try {

  // Greeting: offer username/password auth only
  up.write(Buffer.from([5, 1, 2]));
  const g = await readBytes(up, 2);
  if (g[0] !== 5 || g[1] !== 2) throw new Error("upstream refused user/pass auth method");

  // RFC 1929 sub-negotiation
  const u = Buffer.from(cfg.username), p = Buffer.from(cfg.password);
  up.write(Buffer.concat([Buffer.from([1, u.length]), u, Buffer.from([p.length]), p]));
  const a = await readBytes(up, 2);
  if (a[1] !== 0) throw new Error("upstream auth failed (check username/password)");

  // Forward the CONNECT request (domain names stay unresolved -> remote DNS)
  up.write(Buffer.concat([Buffer.from([5, 1, 0, atyp]), addrBytes, portBytes]));
  const head = await readBytes(up, 4);
  if (head[1] !== 0) { up.destroy(); const e = new Error("upstream connect failed"); e.code = head[1]; throw e; }
  if (head[3] === 1) await readBytes(up, 6);
  else if (head[3] === 4) await readBytes(up, 18);
  else { const l = (await readBytes(up, 1))[0]; await readBytes(up, l + 2); }
  up.setTimeout(0);
  return up;
  } catch (e) { up.destroy(); throw e; }
}

const server = net.createServer(async (client) => {
  client.on("error", () => {});
  try {
    // Greeting from Chrome: accept "no auth"
    const h = await readBytes(client, 2);
    if (h[0] !== 5) return client.destroy();
    await readBytes(client, h[1]);
    client.write(Buffer.from([5, 0]));

    // Request
    const r = await readBytes(client, 4);
    if (r[1] !== 1) { reply(client, 7); return client.end(); } // only CONNECT supported
    const atyp = r[3];
    let addr;
    if (atyp === 1) addr = await readBytes(client, 4);
    else if (atyp === 4) addr = await readBytes(client, 16);
    else if (atyp === 3) {
      const len = await readBytes(client, 1);
      addr = Buffer.concat([len, await readBytes(client, len[0])]);
    } else { reply(client, 8); return client.end(); }
    const port = await readBytes(client, 2);

    const target = describeTarget(atyp, addr, port);
    let up, a = atyp, ab = addr;
    try {
      if (cfg.resolveLocally && atyp === 3) {
        const { address } = await dns.lookup(addr.subarray(1).toString(), { family: 4 });
        a = 1; ab = Buffer.from(address.split(".").map(Number));
      }
      up = await connectUpstream(a, ab, port);
    } catch (e) {
      const why = e.code && REPLY[e.code] ? `reply code ${e.code}: ${REPLY[e.code]}` : e.message;
      console.error(`[relay] ${target} -> ${why}`);
      reply(client, typeof e.code === "number" ? e.code : 1);
      return client.end();
    }
    reply(client, 0);
    client.resume(); up.resume();
    client.pipe(up); up.pipe(client);
    const close = () => { client.destroy(); up.destroy(); };
    client.on("close", close); up.on("close", close); up.on("error", close);
  } catch { client.destroy(); }
});

server.listen(cfg.listenPort, cfg.listenHost, () =>
  console.log(`Relay listening on ${cfg.listenHost}:${cfg.listenPort} -> ${cfg.upstreamHost}:${cfg.upstreamPort}`));

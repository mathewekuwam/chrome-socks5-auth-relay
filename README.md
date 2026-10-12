# Chrome SOCKS5 Auth Relay & Switcher

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20(Zero%20Dependencies)-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#)

A lightweight Chrome Extension and local loopback relay that allows Google Chrome to connect to authenticated SOCKS5 proxies requiring username and password credentials (RFC 1929).

---

## 💡 The Problem

Google Chrome's proxy engine natively supports SOCKS5 proxies, but **does not support SOCKS5 username and password authentication** via standard extension APIs or browser flags. When users try to route Chrome traffic through private, authenticated proxies, authentication requests are either rejected or fail silently.

## 🚀 The Solution

This project implements a clean dual-component bridge:

```
┌─────────────────┐       SOCKS5 (No Auth)       ┌────────────────────────┐       SOCKS5 + RFC 1929 Auth       ┌──────────────────────┐       Internet
│  Google Chrome  │ ───────────────────────────> │  Local Node.js Relay   │ ─────────────────────────────────> │  Upstream SOCKS5     │ ─────────────────>
│  (Extension)    │ <─────────────────────────── │   (127.0.0.1:1080)     │ <───────────────────────────────── │      Proxy Server    │ <─────────────────
└─────────────────┘                              └────────────────────────┘                                    └──────────────────────┘
```

1. **Manifest V3 Chrome Extension (`My Proxy Switch`)**: Configures Chrome to route all traffic to `127.0.0.1:1080` without authentication.
2. **Local SOCKS5 Relay (`relay.js`)**: A zero-dependency Node.js service running on localhost that intercepts local connections, performs RFC 1929 username/password handshake with the remote upstream proxy, and pipes traffic bidirectionally.

---

## ✨ Key Features

- 🔒 **Full RFC 1929 Authentication:** Seamlessly authenticate with private proxies using username and password.
- 📦 **Zero External Dependencies:** Built using native Node.js core modules (`net`, `dns`, `fs`, `path`). No `npm install` required.
- 🛡️ **DNS Leak Protection:** Chrome sends target hostnames directly to the proxy (`ATYP = 3` domain name addressing), resolving DNS on the remote proxy side.
- 🚫 **WebRTC IP Leak Defense:** Automatically sets Chrome's WebRTC policy to `disable_non_proxied_udp`, preventing real IP exposure.
- 📴 **Fail-Closed Guarantee:** If the relay or upstream proxy goes down, requests immediately fail with `ERR_PROXY_CONNECTION_FAILED` instead of silently leaking through a direct connection.
- 🔒 **Local Security Boundary:** The relay binds strictly to `127.0.0.1`, preventing local network devices from accessing the relay.
- ⚠️ **Conflict Detection:** Visual badge alerts (`!`) notify you if another extension attempts to override proxy settings.
- 🪟 **Silent Windows Background Runner:** Includes a VBS script to run the relay hidden in the background on Windows startup.

---

## 📁 Project Structure

```text
socks-proxy/
├── extension/                 # Chrome Extension (Manifest V3)
│   ├── manifest.json          # Extension configuration & permissions
│   ├── background.js          # Service worker managing proxy rules & WebRTC policies
│   ├── popup.html / popup.js  # Popup UI for toggle button and IP verification
│   └── options.html / .js     # Settings page for custom relay host/port and bypass rules
├── relay/                     # Node.js SOCKS5 Relay
│   ├── relay.js               # Core relay server (RFC 1929 auth handler)
│   ├── config.example.json    # Configuration template
│   ├── config.json            # Active configuration (ignored by git)
│   └── start-relay.vbs        # VBS script to start relay invisibly on Windows
├── .gitignore                 # Protects sensitive config & log files
├── LICENSE                    # MIT License
└── README.md                  # Project documentation
```

---

## 🛠️ Prerequisites

- **Node.js 18+** installed ([Download Node.js](https://nodejs.org/))
- **Google Chrome** (or Chromium-based browsers such as Brave, Edge, Opera)

---

## ⚡ Quickstart Guide

### Step 1: Set Up and Start the Relay

1. Navigate to the `relay` directory:
   ```bash
   cd relay
   ```
   *(or `cd socks-proxy/relay` if at root directory)*

2. Create your `config.json` from the example template:
   - **Windows:**
     ```cmd
     copy config.example.json config.json
     ```
   - **Linux / macOS:**
     ```bash
     cp config.example.json config.json
     chmod 600 config.json
     ```

3. Open `config.json` in your favorite editor and configure your upstream proxy:
   ```json
   {
     "listenHost": "127.0.0.1",
     "listenPort": 1080,
     "upstreamHost": "YOUR.PROXY.HOST",
     "upstreamPort": 1080,
     "username": "YOUR_USERNAME",
     "password": "YOUR_PASSWORD",
     "resolveLocally": false
   }
   ```

4. Run the relay server:
   ```bash
   node relay.js
   ```
   You should see:
   ```text
   Relay listening on 127.0.0.1:1080 -> YOUR.PROXY.HOST:1080
   ```

> [!WARNING]
> Keep `relay.js` running in your terminal while browsing. Never commit `config.json` to a public repository!

---

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to:
   ```text
   chrome://extensions
   ```
2. Toggle **Developer mode** on (top-right switch).
3. Click **Load unpacked** (top-left).
4. Select the `extension/` folder in this repository.
5. (Optional) To enable proxying in Private windows, click **Details** on the extension card and turn on **"Allow in Incognito"**.

---

### Step 3: Verify Connection

1. Click the **My Proxy Switch** icon in your browser extensions toolbar.
2. Click **Turn proxy ON** (badge updates to green `ON`).
3. Click **Test connection** in the popup:
   - If connected, it will display: `Current public IP: <Your-Proxy-IP>`.
   - If it fails, check the relay terminal logs.

---

## ⚙️ Configuration Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `listenHost` | `string` | `"127.0.0.1"` | Local IP address the relay listens on. Keep as `127.0.0.1` for security. |
| `listenPort` | `number` | `1080` | Local port the relay listens on. Must match the extension settings. |
| `upstreamHost` | `string` | - | Hostname or IP of your remote SOCKS5 proxy server. |
| `upstreamPort` | `number` | - | Port number of your remote SOCKS5 proxy server. |
| `username` | `string` | - | SOCKS5 authentication username. |
| `password` | `string` | - | SOCKS5 authentication password. |
| `resolveLocally` | `boolean` | `false` | When `false`, hostnames are resolved remotely by the proxy. Set to `true` only if upstream fails with code `8`. |

---

## 🪟 Windows Auto-Start (Silent Background Mode)

To start the relay silently without keeping an open terminal window:

1. Press <kbd>Win</kbd> + <kbd>R</kbd>, enter `shell:startup`, and press <kbd>Enter</kbd>.
2. Locate `relay/start-relay.vbs` in File Explorer.
3. Right-click `start-relay.vbs` ➔ **Create shortcut**.
4. Drag and drop the shortcut into your Windows `Startup` folder.
5. The relay will now start automatically in the background when you log in.
   - Logs and runtime errors are written to `relay/relay.log`.
   - To stop the relay: Open **Task Manager** and terminate the **Node.js JavaScript Runtime** process.

---

## 🔍 Troubleshooting & Error Codes

### Common Browser Errors
- **`ERR_PROXY_CONNECTION_FAILED`**: The local relay is not running, or the port in extension settings does not match `listenPort`.
- **`ERR_SOCKS_CONNECTION_FAILED`**: The relay is running, but the connection to the upstream proxy failed. Check relay terminal output (`"upstream auth failed"` indicates incorrect credentials).
- **Extension Badge displays `!`**: Another extension is currently controlling Chrome's proxy settings. Disable conflicting proxy extensions.

### SOCKS5 Reply Codes (Logged by Relay)
If the relay logs `[relay] <host>:<port> -> reply code N`:

| Code | Meaning | Resolution |
| :---: | :--- | :--- |
| **`1`** | General SOCKS server failure | Often indicates expired proxy plan, exceeded bandwidth, or proxy provider issue. |
| **`2`** | Connection not allowed by ruleset | Upstream proxy blocks target destination or port (e.g. SMTP, torrenting). |
| **`3`** | Network unreachable | Target network routing issue on the proxy side. |
| **`4`** | Host unreachable | Target host cannot be reached from proxy server. |
| **`5`** | Connection refused | Target server rejected connection on specified port. |
| **`6`** | TTL expired | Network packet timeout occurred. |
| **`7`** | Command not supported | Protocol command unsupported. |
| **`8`** | Address type not supported | Proxy does not accept domain names. Set `"resolveLocally": true` in `config.json`. *(Note: DNS will then resolve locally).* |

---

## 🔒 Security Best Practices

1. **Keep `config.json` Private:** `config.json` contains your plaintext proxy credentials. It is already added to `.gitignore`. Ensure you never force-add it to git (`git add -f`).
2. **Restrict Permissions:** On Unix-like systems, restrict permissions using `chmod 600 relay/config.json`.
3. **Localhost Binding:** Always keep `listenHost` set to `127.0.0.1` so unauthenticated local traffic cannot be reached from other machines on your LAN.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

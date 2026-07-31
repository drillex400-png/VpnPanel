import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SSHConfig, VPNProtocolCatalog, InstalledVPNService, VPNAssistantMessage, VPNClientEntry, VPNProtocolId } from "../types";
import { execCommand, authFetch } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { runDeployPipeline, DeployStep } from "../utils/deployPipeline";
import { QRCodeSVG } from "./QRCodeSVG";
import {
  ShieldCheck,
  Zap,
  Play,
  Square,
  RotateCw,
  Copy,
  Check,
  QrCode,
  Terminal,
  Bot,
  Send,
  AlertTriangle,
  Info,
  Server,
  Lock,
  Globe,
  Radio,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Download,
  FileText,
  X,
  CheckCircle2,
  Clock,
  Activity,
  Sliders,
  RefreshCw,
  Rocket,
  Trash2,
  UserPlus,
  Users,
  ArrowLeftRight
} from "lucide-react";

interface VPNViewProps {
  server: SSHConfig;
}

const VPN_PROTOCOLS: VPNProtocolCatalog[] = [
  {
    id: "xray-vless-reality",
    name: "Xray VLESS + REALITY (Vision)",
    badge: "DPI PROOF • ТОП ОБХОДА",
    version: "v1.8.24 (Latest)",
    description: "Самый устойчивый протокол к блокировкам ТСПУ. Маскирует трафик под легитимный TLS Handshake без необходимости покупки собственного домена.",
    defaultPort: 443,
    defaultSni: "dl.google.com",
    securityRating: "ЭЛИТНЫЙ",
    obfuscationLevel: "DPI Proof",
    transportLayer: "TCP",
    features: [
      "Обход блокировок по протоколу и SNI",
      "Маскировка под Google / Apple CDN",
      "Не требуется личный домен или SSL сертификат",
      "Поддержка gRPC и X-TLS Vision flow"
    ],
    recommendedApps: ["v2rayNG", "Happ", "Streisand", "NekoBox", "Amnezia"],
    gradient: "from-violet-500/20 via-fuchsia-500/10 to-transparent",
    isPopular: true,
  },
  {
    id: "anytls",
    name: "AnyTLS (sing-box Core)",
    badge: "SAGERNET • ANYTLS INBOUND",
    version: "sing-box (Latest SagerNet)",
    description: "Протокол AnyTLS, работающий исключительно на официальном ядре sing-box (SagerNet). Обладает высокой стойкостью к DPI, динамическим шлейфом и безопасным fallback.",
    defaultPort: 8443,
    defaultSni: "swdist.apple.com",
    securityRating: "ЭЛИТНЫЙ",
    obfuscationLevel: "TLS Proxy",
    transportLayer: "TCP",
    features: [
      "Работает на официальном ядре sing-box (SagerNet)",
      "Официальный inbound протокол type: anytls",
      "Автоматический фоллбэк при сканировании портов",
      "Защита от активного зондирования ТСПУ"
    ],
    recommendedApps: ["sing-box", "v2rayNG", "Shadowrocket", "NekoBox"],
    gradient: "from-fuchsia-500/20 via-blue-500/10 to-transparent",
    isPopular: true,
  },
  {
    id: "xray-vmess-ws",
    name: "Xray VMess + WebSocket + TLS",
    badge: "CDN FAST • CLOUDFLARE",
    version: "v1.8.24",
    description: "Надежное решение для работы через проксирование Cloudflare CDN. Позволяет скрывать реальный IP-адрес вашего сервера.",
    defaultPort: 2083,
    defaultSni: "cloudflare.com",
    securityRating: "ВЫСОКИЙ",
    obfuscationLevel: "CDN Fast",
    transportLayer: "TCP",
    features: [
      "Маршрутизация через Cloudflare CDN",
      "Защита IP-адреса сервера от блокировки",
      "Поддержка WebSocket каналов"
    ],
    recommendedApps: ["v2rayNG", "Streisand", "PassWall"],
    gradient: "from-purple-500/20 via-indigo-500/10 to-transparent",
  },
  {
    id: "shadowsocks-2022",
    name: "Shadowsocks-2022 (AEAD)",
    badge: "AEAD 2022 • MIN LATENCY",
    version: "v2022.2",
    description: "Стандарт нового поколения с усиленным шифрованием AEAD BLAKE3 для онлайн-игр и низкого пинга.",
    defaultPort: 8388,
    defaultSni: "shadowsocks.org",
    securityRating: "ВЫСОКИЙ",
    obfuscationLevel: "AEAD 2022",
    transportLayer: "TCP+UDP",
    features: [
      "Минимальная задержка (Ping)",
      "Шифрование BLAKE3 + ChaCha20",
      "Оптимизировано для UDP голосового чата и игр"
    ],
    recommendedApps: ["Shadowrocket", "NekoBox", "Outline"],
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
  {
    id: "xray-trojan-grpc",
    name: "Trojan + gRPC / TLS",
    badge: "HTTPS MIMICRY",
    version: "v1.8.24",
    description: "Классический протокол, полностью имитирующий регулярный HTTPS трафик веб-браузеров при посещении защищенных сайтов.",
    defaultPort: 8443,
    defaultSni: "www.microsoft.com",
    securityRating: "ВЫСОКИЙ",
    obfuscationLevel: "TLS Proxy",
    transportLayer: "TCP",
    features: [
      "Высокая скорость передачи данных",
      "gRPC транспозиция пакетов",
      "Полная совместимость со всеми клиентами"
    ],
    recommendedApps: ["v2rayNG", "Shadowrocket", "Clash Meta"],
    gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
  },
  {
    id: "amnezia-wg",
    name: "AmneziaWG 2.0 / WireGuard",
    badge: "STEALTH UDP 2.0 • KERNEL",
    version: "v2.0 (AmneziaWG 2.0 Engine / github.com/amnezia-vpn)",
    description: "Второе поколение AmneziaWG v2.0 с двойной обфускацией заголовков и продвинутым рандомизатором размера пакетов для обхода ТСПУ 2.0.",
    defaultPort: 51820,
    defaultSni: "wireguard.org",
    securityRating: "ЭЛИТНЫЙ",
    obfuscationLevel: "UDP Stealth",
    transportLayer: "UDP",
    features: [
      "AmneziaWG 2.0 Next-Gen Obfuscation",
      "Работа на уровне ядра Linux (Kernel dkms)",
      "Защита от активного зондирования и блокировок ТСПУ 2.0",
      "Минимальное энергопотребление на смартфоне"
    ],
    recommendedApps: ["Amnezia VPN Client (v2.0+)", "AmneziaWG App"],
    gradient: "from-violet-500/20 via-lime-500/10 to-transparent",
  },
];

const SNI_PRESETS = [
  "dl.google.com",
  "swdist.apple.com",
  "www.microsoft.com",
  "images.unsplash.com",
  "cdn.cloudflare.com",
  "gateway.icloud.com",
];

// Demo-only seed data for the "Мои VPN" list -- ONLY ever shown for the built-in demo
// server, so a real production server never starts out displaying VPN services that
// don't actually exist on it. Real servers start with an empty list and are populated
// exclusively by actual deploys made through this panel (see handleStartDeploy) -- there
// is no "scan the server and discover any pre-existing VPN install" feature yet, so a
// protocol installed outside the panel before it was ever connected won't appear here.
const DEMO_INSTALLED_SERVICES: InstalledVPNService[] = [
  {
    id: "vpn-inst-1",
    protocolId: "xray-vless-reality",
    name: "Xray-core (VLESS + REALITY)",
    status: "active",
    port: 443,
    sni: "dl.google.com",
    uuid: "e89c4a12-7b3e-4f12-9012-a1b2c3d4e5f6",
    publicKey: "x8F2k9L1mN3pQ5rT7vW9xZ2aC4eG6iI8kM0oQ2sU4wY",
    clientLink: "vless://e89c4a12-7b3e-4f12-9012-a1b2c3d4e5f6@demo.server.com:443?type=grpc&security=reality&pbk=x8F2k9L1mN3pQ5rT7vW9xZ2aC4eG6iI8kM0oQ2sU4wY&fp=chrome&sni=dl.google.com#Ubuntu-VLESS-REALITY",
    uptime: "4 дня 12 часов",
    trafficRxGb: 14.8,
    trafficTxGb: 42.1,
    activeClientsCount: 3,
    installedAt: "2026-07-26",
    version: "v1.8.24",
    configPath: "/usr/local/etc/xray/config.json",
    clients: [
      {
        id: "c-demo-1",
        name: "Client-Device-01",
        uuid: "e89c4a12-7b3e-4f12-9012-a1b2c3d4e5f6",
        clientLink: "vless://e89c4a12-7b3e-4f12-9012-a1b2c3d4e5f6@demo.server.com:443?type=grpc&security=reality&pbk=x8F2k9L1mN3pQ5rT7vW9xZ2aC4eG6iI8kM0oQ2sU4wY&fp=chrome&sni=dl.google.com#Ubuntu-VLESS-REALITY",
        createdAt: "2026-07-26T00:00:00.000Z",
      },
    ],
  },
  {
    id: "vpn-inst-2",
    protocolId: "anytls",
    name: "sing-box (AnyTLS Core)",
    status: "active",
    port: 8443,
    sni: "swdist.apple.com",
    uuid: "3f9a12b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
    clientLink: "anytls://3f9a12b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b@demo.server.com:8443?sni=swdist.apple.com#Ubuntu-AnyTLS-sing-box",
    uptime: "1 день 6 часов",
    trafficRxGb: 4.2,
    trafficTxGb: 12.5,
    activeClientsCount: 2,
    installedAt: "2026-07-29",
    version: "sing-box (Official)",
    configPath: "/etc/sing-box/config.json",
    clients: [
      {
        id: "c-demo-2",
        name: "Client-Device-01",
        uuid: "3f9a12b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
        clientLink: "anytls://3f9a12b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b@demo.server.com:8443?sni=swdist.apple.com#Ubuntu-AnyTLS-sing-box",
        createdAt: "2026-07-29T00:00:00.000Z",
      },
    ],
  },
];

// ---- Live metrics helpers (real data from the server, not static demo numbers) ----

// Russian pluralization (день/дня/дней, час/часа/часов, etc.)
const pluralRu = (n: number, one: string, few: string, many: string): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
};

// -1 is the sentinel for "unknown / service never started" (see buildLiveMetricsProbe) --
// rendered as "--" instead of fabricating a duration.
const formatUptimeSeconds = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days} ${pluralRu(days, "день", "дня", "дней")} ${hours} ${pluralRu(hours, "час", "часа", "часов")}`;
  if (hours > 0) return `${hours} ${pluralRu(hours, "час", "часа", "часов")} ${minutes} мин`;
  return `${minutes} мин`;
};

// Splits "===KEY===\nvalue\n===KEY2===\nvalue2..." style output into a lookup map
// (same sectioning convention used by the software-installer probe in ToolsView.tsx).
const parseKeySections = (raw: string): Record<string, string> => {
  const sections: Record<string, string> = {};
  let currentKey = "default";
  for (const line of raw.split("\n")) {
    const m = line.match(/^===\s*([A-Z0-9_]+)\s*===/);
    if (m) {
      currentKey = m[1];
      sections[currentKey] = "";
    } else {
      sections[currentKey] = (sections[currentKey] || "") + line + "\n";
    }
  }
  return sections;
};

// Builds ONE combined SSH probe covering every installed (non-demo) service in a single
// round-trip:
//  - Real uptime per shared systemd unit (xray / sing-box / awg-quick@awg0) via
//    ActiveEnterTimestamp -- numeric epoch math only, no locale-sensitive date parsing
//    (LC_ALL=C forces English output regardless of server locale).
//  - Real AmneziaWG traffic + active-peer count via `wg show <iface> transfer` /
//    `latest-handshakes` (a peer counts as "active" if it handshook in the last 3 min).
//  - Real per-port traffic + connection count for Xray-family/AnyTLS cards via `ss -ti`
//    TCP_INFO byte counters and established-connection counts on that exact port -- this
//    isolates traffic correctly per protocol/port without touching Xray's config (no
//    stats-API wiring needed) and legitimately reads 0 for a stale port nothing is
//    actually listening on anymore (honest, not fabricated).
const buildLiveMetricsProbe = (services: InstalledVPNService[]): string => {
  const hasXray = services.some((s) => s.protocolId.includes("xray") || s.protocolId === "shadowsocks-2022");
  const hasAnytls = services.some((s) => s.protocolId === "anytls");
  const hasAwg = services.some((s) => s.protocolId === "amnezia-wg");
  const ports = Array.from(
    new Set(
      services
        .filter((s) => s.protocolId !== "amnezia-wg")
        .map((s) => Number(s.port))
        .filter((p) => Number.isInteger(p) && p > 0 && p < 65536)
    )
  );

  const uptimeBlock = (marker: string, unit: string) => `
echo "===${marker}==="
ST=$(LC_ALL=C systemctl show '${unit}' --property=ActiveEnterTimestamp --value 2>/dev/null)
if [ -z "$ST" ] || [ "$ST" = "n/a" ]; then
  echo -1
else
  EP=$(LC_ALL=C date -d "$ST" +%s 2>/dev/null || echo -1)
  if [ "$EP" -lt 0 ]; then echo -1; else echo $(( $(date +%s) - EP )); fi
fi`;

  const blocks: string[] = [];
  if (hasXray) blocks.push(uptimeBlock("XRAY_UPTIME", "xray"));
  if (hasAnytls) blocks.push(uptimeBlock("ANYTLS_UPTIME", "sing-box"));
  if (hasAwg) {
    blocks.push(uptimeBlock("AWG_UPTIME", "awg-quick@awg0"));
    blocks.push(`
echo "===AWG_TRANSFER==="
sudo wg show awg0 transfer 2>/dev/null || echo "NONE"
echo "===AWG_HANDSHAKES==="
sudo wg show awg0 latest-handshakes 2>/dev/null || echo "NONE"`);
  }
  for (const port of ports) {
    blocks.push(`
echo "===PORT_${port}_BYTES==="
ss -ti state established "( sport = :${port} )" 2>/dev/null | grep -oE 'bytes_sent:[0-9]+|bytes_received:[0-9]+'
echo "===PORT_${port}_CONNS==="
ss -tn state established "( sport = :${port} )" 2>/dev/null | tail -n +2 | wc -l`);
  }

  return blocks.join("\n");
};

// ---- Shared protocol runtime info: single source of truth for systemd unit name + real
// config file path per protocol, used by BOTH the initial deploy pipeline and the
// add/remove-client pipelines so they can never drift apart. (This also fixes a
// pre-existing bug: InstalledVPNService.configPath used to be hardcoded as
// /etc/${protocolId}/config.json, which never matched the REAL path any protocol's deploy
// pipeline actually wrote to -- e.g. Xray really lives at /usr/local/etc/xray/config.json.) --
const getProtocolRuntimeInfo = (
  protocolId: VPNProtocolId
): { serviceName: string; primaryConfigPath: string; secondaryConfigPath: string; configFormat: "json" | "ini" } => {
  const isXrayFamily = protocolId.includes("xray") || protocolId === "shadowsocks-2022";
  if (isXrayFamily) {
    return { serviceName: "xray", primaryConfigPath: "/usr/local/etc/xray/config.json", secondaryConfigPath: "/etc/xray/config.json", configFormat: "json" };
  }
  if (protocolId === "anytls") {
    return { serviceName: "sing-box", primaryConfigPath: "/etc/sing-box/config.json", secondaryConfigPath: "", configFormat: "json" };
  }
  if (protocolId === "amnezia-wg") {
    return { serviceName: "awg-quick@awg0", primaryConfigPath: "/etc/amnezia/amneziawg/awg0.conf", secondaryConfigPath: "/etc/wireguard/awg0.conf", configFormat: "ini" };
  }
  return { serviceName: protocolId, primaryConfigPath: `/etc/${protocolId}/config.json`, secondaryConfigPath: "", configFormat: "json" };
};

// Cryptographically secure random key generator (Web Crypto, not Math.random) -- shared by
// initial deploy AND add-client flows so every generated secret goes through the same path.
const generateSecureBase64Key = (bytes: number, urlSafe: boolean = false): string => {
  const array = new Uint8Array(bytes);
  window.crypto.getRandomValues(array);
  let binary = "";
  for (let i = 0; i < array.byteLength; i++) binary += String.fromCharCode(array[i]);
  let b64 = btoa(binary);
  if (urlSafe) b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b64;
};

// Builds an AmneziaWG client .conf -- parameterized (unlike the old inline version that
// hardcoded Address = 10.29.29.2/32, which only happened to be correct for a service's very
// first client). Used by both the initial deploy AND by "add client" for every subsequent
// peer, each with its own allocated /32 address.
const buildAwgClientConfShared = (opts: {
  clientPriv: string;
  serverPub: string;
  clientAddress: string;
  endpointHost: string;
  endpointPort: number;
  awgVersion: "1.0" | "2.0";
  awgJc: number | string; awgJmin: number | string; awgJmax: number | string;
  awgS1: number | string; awgS2: number | string; awgS3: number | string; awgS4: number | string;
  awgH1: number | string; awgH2: number | string; awgH3: number | string; awgH4: number | string;
}): string => {
  const lines = [
    "[Interface]",
    `PrivateKey = ${opts.clientPriv}`,
    `Address = ${opts.clientAddress}`,
    "DNS = 1.1.1.1, 1.0.0.1",
    `Jc = ${opts.awgJc}`,
    `Jmin = ${opts.awgJmin}`,
    `Jmax = ${opts.awgJmax}`,
    `S1 = ${opts.awgS1}`,
    `S2 = ${opts.awgS2}`,
  ];
  if (opts.awgVersion === "2.0") lines.push(`S3 = ${opts.awgS3}`, `S4 = ${opts.awgS4}`);
  lines.push(
    `H1 = ${opts.awgH1}`,
    `H2 = ${opts.awgH2}`,
    `H3 = ${opts.awgH3}`,
    `H4 = ${opts.awgH4}`,
    "",
    "[Peer]",
    `PublicKey = ${opts.serverPub}`,
    `Endpoint = ${opts.endpointHost}:${opts.endpointPort}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25"
  );
  return lines.join("\n");
};

// ============================================================================================
// AmneziaWG obfuscation parameter generator
//
// Ranges and constraints below come from the widely-deployed bivlked/amneziawg-installer
// (the de-facto reference for correct AWG 2.0 parameter values -- see its ADVANCED.md param
// table) cross-checked against the official Amnezia docs (docs.amnezia.org/documentation/
// amnezia-wg). The H1-H4 non-overlapping-range generation algorithm is adapted directly from
// a real, working community generator (gist.github.com/ftk/8d179876d5eac47b670190bfbc1b6faa)
// rather than invented from scratch: allocate h4 first with a huge span (data packets carry
// the most traffic and benefit most from max entropy), then h3/h2/h1 each checked against
// all previously-placed ranges, shrinking the candidate span by 25% on every retry so the
// search is guaranteed to terminate even in worst-case collision runs.
//
// Critical correctness facts that were previously violated by this codebase's hardcoded
// defaults (H1=1..H4=4): those four values are WireGuard's OWN reserved message-type IDs
// (1=handshake init, 2=handshake response, 3=cookie reply, 4=data) -- setting H1-H4 to them
// does not obfuscate anything, it reproduces vanilla WireGuard's real headers. Every H value
// (or range, in 2.0) must be >= 5.
// ============================================================================================

const randInt = (min: number, max: number): number => {
  // crypto.getRandomValues for real entropy (this picks obfuscation params meant to defeat
  // DPI fingerprinting, so Math.random()'s weaker PRNG is worth avoiding even though it's
  // not a cryptographic secret like a private key).
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return min + (buf[0] % range);
};

const randUint32 = (): number => {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return buf[0];
};

export interface AwgObfuscationParams {
  awgJc: number; awgJmin: number; awgJmax: number;
  awgS1: number; awgS2: number; awgS3: number; awgS4: number;
  awgH1: number | string; awgH2: number | string; awgH3: number | string; awgH4: number | string;
}

export const generateAwgObfuscationParams = (version: "1.0" | "2.0"): AwgObfuscationParams => {
  // Jc/Jmin/Jmax: junk-packet count and size range sent before the handshake.
  const awgJc = randInt(3, 6);
  const awgJmin = randInt(40, 89);
  const awgJmax = awgJmin + randInt(50, 250);

  // S1/S2: Init/Response padding. Hard constraint: S1 + 56 !== S2 (148-byte Init + S1 must
  // never equal 92-byte Response + S2, or the two message types become distinguishable by
  // size again -- defeats the point of padding them).
  const awgS1 = randInt(15, 150);
  let awgS2 = randInt(15, 150);
  while (awgS2 === awgS1 + 56) awgS2 = randInt(15, 150);

  // S3/S4: Cookie/Data padding -- 2.0 only, sent as 0 (disabled) on 1.0.
  const awgS3 = version === "2.0" ? randInt(8, 55) : 0;
  const awgS4 = version === "2.0" ? randInt(4, 27) : 0;

  if (version === "1.0") {
    // Legacy AWG 1.0: H1-H4 are single fixed values (no range support), just need to be
    // >=5 and pairwise distinct.
    const used = new Set<number>();
    const pick = (): number => {
      let v = randInt(5, 2147483647);
      while (used.has(v)) v = randInt(5, 2147483647);
      used.add(v);
      return v;
    };
    return { awgJc, awgJmin, awgJmax, awgS1, awgS2, awgS3, awgS4, awgH1: pick(), awgH2: pick(), awgH3: pick(), awgH4: pick() };
  }

  // AWG 2.0: H1-H4 are non-overlapping uint32 RANGES "min-max". Port of the ftk gist
  // algorithm: place h4 first with the largest span (it's the data-packet header, carries
  // the most traffic so benefits most from entropy), then h3/h2/h1 in turn, each rejecting
  // any candidate that overlaps an already-placed range, shrinking span by 25% per retry.
  const MAX_U32 = 0xffffffff;
  let span = 1_000_000_000 + randInt(0, 1_000_000_000);
  const placed: { start: number; end: number }[] = [];

  const overlaps = (start: number, end: number): boolean =>
    placed.some((r) => (start >= r.start && start <= r.end) || (end >= r.start && end <= r.end) || (r.start >= start && r.start <= end));

  const placeNext = (): { start: number; end: number } => {
    let start = 0;
    let end = 0;
    let attempts = 0;
    do {
      start = randUint32();
      end = start + span;
      if (start < 5 || end > MAX_U32 || overlaps(start, end)) {
        span = Math.max(1, span - Math.floor(span / 4));
        attempts++;
        continue;
      }
      break;
    } while (attempts < 200); // generous ceiling -- span shrinks geometrically so this always converges well before 200
    placed.push({ start, end });
    return { start, end };
  };

  const h4 = placeNext();
  const h3 = placeNext();
  const h2 = placeNext();
  const h1 = placeNext();

  return {
    awgJc, awgJmin, awgJmax, awgS1, awgS2, awgS3, awgS4,
    awgH1: `${h1.start}-${h1.end}`,
    awgH2: `${h2.start}-${h2.end}`,
    awgH3: `${h3.start}-${h3.end}`,
    awgH4: `${h4.start}-${h4.end}`,
  };
};

// Validates a set of AWG params against the same hard constraints the generator enforces --
// used to warn/block the deploy button if a user manually edits values into an invalid state
// (e.g. typing H1=1 by hand, or S2 = S1+56).
const parseHRange = (v: number | string): { start: number; end: number } | null => {
  const s = String(v).trim();
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return { start: parseInt(m[1], 10), end: parseInt(m[2], 10) };
  const n = parseInt(s, 10);
  if (!Number.isNaN(n)) return { start: n, end: n };
  return null;
};

const validateAwgParams = (p: AwgObfuscationParams, version: "1.0" | "2.0"): string[] => {
  const issues: string[] = [];
  if (p.awgJmax <= p.awgJmin) issues.push("Jmax должен быть больше Jmin.");
  if (Number(p.awgS1) + 56 === Number(p.awgS2)) issues.push("S1 + 56 не должно равняться S2 (иначе Init и Response пакеты снова станут различимы по размеру).");
  const hVals = [p.awgH1, p.awgH2, p.awgH3, p.awgH4];
  const ranges = hVals.map(parseHRange);
  if (ranges.some((r) => !r)) {
    issues.push("H1-H4 должны быть числом (v1.0) или диапазоном вида \"min-max\" (v2.0).");
  } else {
    const rs = ranges as { start: number; end: number }[];
    rs.forEach((r, i) => {
      if (r.start < 5 || r.end < 5) issues.push(`H${i + 1} должен быть >= 5 (значения 1-4 зарезервированы под настоящие типы пакетов WireGuard и отключают обфускацию заголовков).`);
      if (r.start > r.end) issues.push(`H${i + 1}: минимум диапазона больше максимума.`);
    });
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        if (a.start <= b.end && b.start <= a.end) {
          issues.push(`H${i + 1} и H${j + 1} пересекаются -- диапазоны H1-H4 обязаны быть непересекающимися.`);
        }
      }
    }
  }
  return issues;
};

// ============================================================================================
// AnyTLS (sing-box) advanced settings: padding_scheme + ALPN + TLS version pinning
//
// Prior implementation only ever set users[]/tls.{enabled,server_name,certificate_path,
// key_path} -- every AnyTLS-specific tunable beyond that was silently absent from the UI.
// Per the official sing-box docs (sing-box.sagernet.org/configuration/inbound/anytls) the
// inbound only has 3 top-level fields: users, padding_scheme, tls -- so padding_scheme was
// the one entirely missing protocol-specific knob. ALPN/min_version/max_version come from
// the shared TLS server object (also usable, also absent from the UI).
//
// padding_scheme grammar is NOT sing-box's own invention -- it comes from the upstream
// anytls-go protocol spec (github.com/anytls/anytls-go/blob/main/docs/protocol.md), which
// this validator follows exactly:
//   "stop=N"      -- stop padding packets from index N onward (sent as-is after that).
//   "<idx>=<seg>[,<seg>...]" -- describes how to pad/split packet <idx>. Each <seg> is
//                    either "min-max" (a filler chunk with a random size in that byte
//                    range) or the literal "c" (a checkpoint: stop emitting further filler
//                    segments for this packet if no real user data remains to send).
//   Packet 0 is the auth packet and is a hard protocol special case: it may ONLY have a
//   single "min-max" segment -- no comma-separated multi-segment padding, no "c" marker.
// ============================================================================================

export const ANYTLS_DEFAULT_PADDING_SCHEME = [
  "stop=8",
  "0=30-30",
  "1=100-400",
  "2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000",
  "3=9-9,500-1000",
  "4=500-1000",
  "5=500-1000",
  "6=500-1000",
  "7=500-1000",
];

export const validateAnytlsPaddingScheme = (raw: string): string[] => {
  const issues: string[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length === 0) {
    issues.push("Схема паддинга пуста -- добавь хотя бы одну строку или переключись на режим \"по умолчанию\".");
    return issues;
  }
  const seenKeys = new Set<string>();
  for (const line of lines) {
    const m = line.match(/^(stop|\d+)=(.+)$/);
    if (!m) {
      issues.push(`Некорректная строка "${line}" -- ожидается формат "stop=N" или "<номер пакета>=<сегменты>".`);
      continue;
    }
    const key = m[1];
    const value = m[2];
    if (seenKeys.has(key)) issues.push(`Повторяющийся ключ "${key}" -- каждый пакет/stop должен встречаться один раз.`);
    seenKeys.add(key);
    if (key === "stop") {
      if (!/^\d+$/.test(value)) issues.push(`"stop=${value}" -- значение должно быть целым числом.`);
      continue;
    }
    const packetIndex = parseInt(key, 10);
    const segments = value.split(",");
    if (packetIndex === 0 && segments.length > 1) {
      issues.push("Пакет 0 (padding0, часть аутентификации) не поддерживает разбиение на несколько сегментов -- допустим только один диапазон \"min-max\".");
    }
    segments.forEach((seg) => {
      if (seg === "c") {
        if (packetIndex === 0) issues.push("Пакет 0 не поддерживает маркер \"c\".");
        return;
      }
      const rangeMatch = seg.match(/^(\d+)-(\d+)$/);
      if (!rangeMatch) {
        issues.push(`Пакет ${packetIndex}: сегмент "${seg}" некорректен -- ожидается "min-max" или "c".`);
        return;
      }
      if (parseInt(rangeMatch[1], 10) > parseInt(rangeMatch[2], 10)) {
        issues.push(`Пакет ${packetIndex}: в сегменте "${seg}" минимум больше максимума.`);
      }
    });
  }
  return issues;
};

// ============================================================================================
// VLESS REALITY -- full inbound (server-side) parameter set, per the official spec:
// xtls.github.io/en/config/transports/reality.html
//
// Prior implementation only wired 4 of the ~11 real inbound fields (dest/target, xver=0
// hardcoded, a single serverNames entry, privateKey, a single shortIds entry) -- and it also
// had a real bug: it stuffed `fingerprint` into the SERVER's realitySettings. Per the docs,
// `fingerprint` is explicitly an OUTBOUND/client-only field ("the following fields are for
// outbound (client-side) configuration") -- it has no effect server-side and doesn't belong
// there (the client link already correctly carries fp= for the client). Fixed by removing it
// from the inbound JSON entirely -- the client link generation was already correct and is
// untouched.
//
// Newly wired real fields: minClientVer/maxClientVer (client version gating), maxTimeDiff
// (replay/clock-skew tolerance), multiple serverNames + shortIds (docs: "can be used to
// distinguish different clients"), mldsa65Seed (post-quantum certificate signature, added
// to Xray-core's REALITY implementation for future-proofing against quantum attacks on
// X25519), and limitFallbackUpload/limitFallbackDownload (anti-scan rate limiting for
// unauthenticated fallback traffic -- off by default per the docs' own warning that, if
// misconfigured, the rate-limit shape itself becomes a fingerprint).
// ============================================================================================

export const validateRealityParams = (params: {
  serverNames: string[];
  shortIds: string[];
  minClientVer: string;
  maxClientVer: string;
  maxTimeDiff: string;
  fallbackLimitEnabled: boolean;
  fallbackAfterBytes: string;
  fallbackBytesPerSec: string;
  fallbackBurstBytesPerSec: string;
}): string[] => {
  const issues: string[] = [];
  const { serverNames, shortIds, minClientVer, maxClientVer, maxTimeDiff, fallbackLimitEnabled, fallbackAfterBytes, fallbackBytesPerSec, fallbackBurstBytesPerSec } = params;

  if (serverNames.length === 0) {
    issues.push("Список serverNames пуст -- нужен хотя бы один домен (обычно совпадающий с target/dest).");
  }
  serverNames.forEach((name) => {
    if (name.includes("*")) issues.push(`serverNames: "${name}" -- wildcard-домены (*) не поддерживаются REALITY.`);
  });

  if (shortIds.length === 0) {
    issues.push("Список shortIds пуст -- требуется хотя бы одно значение (может быть пустой строкой).");
  }
  shortIds.forEach((sid) => {
    if (sid === "") return; // an empty shortId is explicitly valid per the spec
    if (!/^[0-9a-fA-F]+$/.test(sid)) issues.push(`shortIds: "${sid}" -- допустимы только hex-символы (0-9, a-f).`);
    else if (sid.length > 16) issues.push(`shortIds: "${sid}" -- максимум 16 hex-символов (8 байт).`);
    else if (sid.length % 2 !== 0) issues.push(`shortIds: "${sid}" -- число символов должно быть чётным (1 байт = 2 hex-символа).`);
  });

  const verRegex = /^\d+\.\d+\.\d+$/;
  if (minClientVer.trim() && !verRegex.test(minClientVer.trim())) {
    issues.push(`minClientVer: "${minClientVer}" -- формат должен быть x.y.z (например 25.9.11).`);
  }
  if (maxClientVer.trim() && !verRegex.test(maxClientVer.trim())) {
    issues.push(`maxClientVer: "${maxClientVer}" -- формат должен быть x.y.z (например 25.9.11).`);
  }
  if (maxTimeDiff.trim() && (!/^\d+$/.test(maxTimeDiff.trim()))) {
    issues.push(`maxTimeDiff: "${maxTimeDiff}" -- должно быть целым числом миллисекунд.`);
  }

  if (fallbackLimitEnabled) {
    [["afterBytes", fallbackAfterBytes], ["bytesPerSec", fallbackBytesPerSec], ["burstBytesPerSec", fallbackBurstBytesPerSec]].forEach(([label, val]) => {
      if (val.trim() && !/^\d+$/.test(val.trim())) {
        issues.push(`Fallback rate-limit ${label}: "${val}" -- должно быть целым неотрицательным числом.`);
      }
    });
  }

  return issues;
};

// Shadowsocks-2022 in Xray-core was audited previously and found unstable in true
// multi-user mode across all supported ciphers -- kept intentionally single-user. See
// VPNClientEntry doc comment in types.ts.
const SS2022_NO_MULTI_CLIENT_REASON =
  "Shadowsocks-2022 в Xray-core работает только в single-user режиме (проверено ранее: многопользовательский режим нестабилен на части шифров) -- мультиклиент недоступен для этого протокола.";

export const VPNView: React.FC<VPNViewProps> = ({ server }) => {
  const toast = useToast();
  // Installed VPNs State -- seeded per-server below (demo seed only for the demo server;
  // real servers start empty and fill up only from actual deploys/detections).
  const [installedServices, setInstalledServices] = useState<InstalledVPNService[]>(
    server.isDemo ? DEMO_INSTALLED_SERVICES : []
  );

  // Modals & Drawers
  const [selectedDeployProtocol, setSelectedDeployProtocol] = useState<VPNProtocolCatalog | null>(null);
  const [deployPort, setDeployPort] = useState<number>(443);
  const [deploySni, setDeploySni] = useState<string>("dl.google.com");
  const [deployClientName, setDeployClientName] = useState<string>("Client-Device-01");
  const [enableBbr, setEnableBbr] = useState<boolean>(true);

  // Protocol-specific advanced options (AnyTLS, Xray VLESS REALITY, AmneziaWG, 3X-UI Panel)
  const [utlsFingerprint, setUtlsFingerprint] = useState<"chrome" | "safari" | "firefox">("chrome");
  
  // AmneziaWG Obfuscation parameters (Version 2.0 vs 1.0, Jc, Jmin, Jmax, S1, S2, H1, H2, H3, H4)
  const [awgVersion, setAwgVersion] = useState<"2.0" | "1.0">("2.0");
  // Seeded ONCE from the real generator (see generateAwgObfuscationParams above) instead of
  // the old hardcoded H1=1..H4=4 -- those are WireGuard's own reserved packet-type IDs and
  // using them as "obfuscation" headers produced completely unobfuscated vanilla traffic.
  // This plain (non-lazy) call re-runs on every render but React only consumes it on mount;
  // the wasted recomputation is a handful of crypto-random ints, not worth memoizing.
  const initialAwgParams = generateAwgObfuscationParams("2.0");
  const [awgJc, setAwgJc] = useState<number>(initialAwgParams.awgJc);
  const [awgJmin, setAwgJmin] = useState<number>(initialAwgParams.awgJmin);
  const [awgJmax, setAwgJmax] = useState<number>(initialAwgParams.awgJmax);
  const [awgS1, setAwgS1] = useState<number>(initialAwgParams.awgS1);
  const [awgS2, setAwgS2] = useState<number>(initialAwgParams.awgS2);
  const [awgS3, setAwgS3] = useState<number>(initialAwgParams.awgS3);
  const [awgS4, setAwgS4] = useState<number>(initialAwgParams.awgS4);
  const [awgH1, setAwgH1] = useState<number | string>(initialAwgParams.awgH1);
  const [awgH2, setAwgH2] = useState<number | string>(initialAwgParams.awgH2);
  const [awgH3, setAwgH3] = useState<number | string>(initialAwgParams.awgH3);
  const [awgH4, setAwgH4] = useState<number | string>(initialAwgParams.awgH4);

  const applyGeneratedAwgParams = (version: "1.0" | "2.0") => {
    const p = generateAwgObfuscationParams(version);
    setAwgJc(p.awgJc); setAwgJmin(p.awgJmin); setAwgJmax(p.awgJmax);
    setAwgS1(p.awgS1); setAwgS2(p.awgS2); setAwgS3(p.awgS3); setAwgS4(p.awgS4);
    setAwgH1(p.awgH1); setAwgH2(p.awgH2); setAwgH3(p.awgH3); setAwgH4(p.awgH4);
  };

  // Regenerate valid H1-H4 (+ S3/S4) whenever the protocol VERSION toggles, since 1.0 needs
  // single distinct values and 2.0 needs non-overlapping ranges -- values from one version
  // are not meaningful for the other (e.g. a "123-456" range string is not a valid 1.0 H
  // value, and single small values like the old hardcoded 1-4 aren't real 2.0 ranges).
  const awgVersionMountRef = useRef(awgVersion);
  useEffect(() => {
    if (awgVersionMountRef.current !== awgVersion) {
      awgVersionMountRef.current = awgVersion;
      applyGeneratedAwgParams(awgVersion);
    }
  }, [awgVersion]);

  const awgParamIssues = validateAwgParams(
    { awgJc: Number(awgJc), awgJmin: Number(awgJmin), awgJmax: Number(awgJmax), awgS1: Number(awgS1), awgS2: Number(awgS2), awgS3: Number(awgS3), awgS4: Number(awgS4), awgH1, awgH2, awgH3, awgH4 },
    awgVersion
  );

  // AnyTLS advanced settings state -- "default" omits padding_scheme entirely from the
  // generated config so sing-box falls back to its own built-in scheme; "custom" ships
  // whatever's in anytlsPaddingScheme (seeded with the real upstream default as a sane
  // editable starting point, not a placeholder).
  const [anytlsPaddingMode, setAnytlsPaddingMode] = useState<"default" | "custom">("default");
  const [anytlsPaddingScheme, setAnytlsPaddingScheme] = useState<string>(ANYTLS_DEFAULT_PADDING_SCHEME.join("\n"));
  const [anytlsAlpn, setAnytlsAlpn] = useState<string>("");
  const [anytlsTlsVersion, setAnytlsTlsVersion] = useState<"auto" | "1.2" | "1.3">("auto");
  const anytlsPaddingIssues = anytlsPaddingMode === "custom" ? validateAnytlsPaddingScheme(anytlsPaddingScheme) : [];


  // 3X-UI Full Xray Panel Fine-Tuning Parameters
  // "http" (plain H2 transport) and "quic" were REMOVED from Xray-core entirely (confirmed
  // against current upstream docs/source -- network:"http" was replaced by splithttp/XHTTP,
  // and the standalone "quic" transport method no longer exists at all, replaced by the
  // "hysteria" method which has a completely different config shape). Deploying either of
  // the old option values would generate a config with an unrecognized `network` value --
  // the pipeline's `xray run -test` validate_config step would catch it before touching the
  // running service, so it wouldn't have broken anything live, but it was a guaranteed-to-fail
  // dead option sitting in the UI. Replaced both with real splithttp (XHTTP) support, which is
  // also the one non-raw/non-grpc transport that's actually REALITY-compatible per the docs'
  // compatibility table.
  const [xrayTransport, setXrayTransport] = useState<"grpc" | "tcp" | "ws" | "splithttp">("grpc");
  const [xraySecurity, setXraySecurity] = useState<"reality" | "tls" | "none">("reality");
  const [xrayFlow, setXrayFlow] = useState<"xtls-rprx-vision" | "xtls-rprx-vision-udp-443" | "none">("xtls-rprx-vision");
  const [xrayDest, setXrayDest] = useState<string>("dl.google.com:443");
  const [xrayShortId, setXrayShortId] = useState<string>("6ba7b810");
  const [xrayPrivateKey, setXrayPrivateKey] = useState<string>("x8F2k9L1mN3pQ5rT7vW9xZ2aC4eG6iI8kM0oQ2sU4wY");
  const [xrayPublicKey, setXrayPublicKey] = useState<string>("p1K9mL2nQ4rT6vW8xZ0aC3eG5iH7kJ9mL1oP3sU5wX0");

  // REALITY advanced (server-side inbound) tunables -- see validateRealityParams above for
  // why each of these exists. Kept separate from the primary deploySni/xrayShortId fields
  // used elsewhere (client link, cert CN, other protocols' TLS server_name) so this stays
  // purely additive -- primary values are always merged in as the first list entry.
  const [xrayExtraServerNames, setXrayExtraServerNames] = useState<string>("");
  const [xrayExtraShortIds, setXrayExtraShortIds] = useState<string>("");
  const [xrayMinClientVer, setXrayMinClientVer] = useState<string>("");
  const [xrayMaxClientVer, setXrayMaxClientVer] = useState<string>("");
  const [xrayMaxTimeDiff, setXrayMaxTimeDiff] = useState<string>("");
  const [xrayMldsa65Seed, setXrayMldsa65Seed] = useState<string>("");
  const [xrayFallbackLimitEnabled, setXrayFallbackLimitEnabled] = useState<boolean>(false);
  const [xrayFallbackAfterBytes, setXrayFallbackAfterBytes] = useState<string>("10485760");
  const [xrayFallbackBytesPerSec, setXrayFallbackBytesPerSec] = useState<string>("1048576");
  const [xrayFallbackBurstBytesPerSec, setXrayFallbackBurstBytesPerSec] = useState<string>("5242880");
  const [xrayRealityAdvancedOpen, setXrayRealityAdvancedOpen] = useState<boolean>(false);

  // Primary value (deploySni / xrayShortId) always first, matching the single-value client
  // link which always references those primary fields; extras are additional/optional.
  // Dedupe while keeping the primary's position stable at index 0.
  const realityServerNamesList = Array.from(new Set([deploySni.trim(), ...xrayExtraServerNames.split(",").map((s) => s.trim()).filter(Boolean)]));
  const realityShortIdsList = Array.from(new Set([xrayShortId.trim(), ...xrayExtraShortIds.split(",").map((s) => s.trim()).filter(Boolean)]));
  const realityIssues = xraySecurity === "reality" ? validateRealityParams({
    serverNames: realityServerNamesList,
    shortIds: realityShortIdsList,
    minClientVer: xrayMinClientVer,
    maxClientVer: xrayMaxClientVer,
    maxTimeDiff: xrayMaxTimeDiff,
    fallbackLimitEnabled: xrayFallbackLimitEnabled,
    fallbackAfterBytes: xrayFallbackAfterBytes,
    fallbackBytesPerSec: xrayFallbackBytesPerSec,
    fallbackBurstBytesPerSec: xrayFallbackBurstBytesPerSec,
  }) : [];
  const [xrayAlpn, setXrayAlpn] = useState<string>("h2,http/1.1");
  const [xrayGrpcServiceName, setXrayGrpcServiceName] = useState<string>("grpc-vless");
  const [xrayGrpcMultiMode, setXrayGrpcMultiMode] = useState<boolean>(false);
  const [xrayWsPath, setXrayWsPath] = useState<string>("/ws");
  const [xrayWsHost, setXrayWsHost] = useState<string>("");
  // WebSocket keepalive (real, documented field) -- 0/empty disables. Helps keep NAT/CGNAT
  // mappings alive on mobile networks that otherwise silently drop idle TCP sessions.
  const [xrayWsHeartbeat, setXrayWsHeartbeat] = useState<string>("");
  // gRPC keepalive tuning (real, documented fields) -- optional, blank = library defaults.
  const [xrayGrpcIdleTimeout, setXrayGrpcIdleTimeout] = useState<string>("");
  // splithttp (XHTTP) -- shares the Path/Host fields above with WebSocket (same concept,
  // different transport) but has its own mode + optional random padding range.
  const [xraySplitHttpMode, setXraySplitHttpMode] = useState<"auto" | "packet-up" | "stream-up" | "stream-one">("auto");
  const [xraySplitHttpPaddingEnabled, setXraySplitHttpPaddingEnabled] = useState<boolean>(false);
  const [xraySplitHttpPaddingFrom, setXraySplitHttpPaddingFrom] = useState<string>("100");
  const [xraySplitHttpPaddingTo, setXraySplitHttpPaddingTo] = useState<string>("1000");
  const [xraySsCipher, setXraySsCipher] = useState<"2022-blake3-chacha20-poly1305" | "2022-blake3-aes-128-gcm" | "2022-blake3-aes-256-gcm">("2022-blake3-chacha20-poly1305");

  // 3X-UI Traffic Sniffing
  const [xraySniffing, setXraySniffing] = useState<boolean>(true);
  const [xraySniffingHttp, setXraySniffingHttp] = useState<boolean>(true);
  const [xraySniffingTls, setXraySniffingTls] = useState<boolean>(true);
  const [xraySniffingQuic, setXraySniffingQuic] = useState<boolean>(true);
  const [xraySniffingFakedns, setXraySniffingFakedns] = useState<boolean>(true);
  const [xrayRouteOnly, setXrayRouteOnly] = useState<boolean>(true);

  // 3X-UI Client Quotas & Expiry Limits

  // 3X-UI Routing & Outbound Rules
  const [xrayDomainStrategy, setXrayDomainStrategy] = useState<"IPIfNonMatch" | "UseIPv4" | "UseIPv6" | "AsIs">("IPIfNonMatch");
  const [xrayBlockP2p, setXrayBlockP2p] = useState<boolean>(true);
  const [xrayBlockAds, setXrayBlockAds] = useState<boolean>(true);
  const [xrayBlockPrivateIp, setXrayBlockPrivateIp] = useState<boolean>(true);
  const [xrayPreferIpv4, setXrayPreferIpv4] = useState<boolean>(true);

  // Active Xray sub tab in 3X-UI panel
  const [xrayPanelSubTab, setXrayPanelSubTab] = useState<"stream" | "limits" | "sniffing" | "routing">("stream");
  
  // Deployment Execution Animation State
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deploySuccessService, setDeploySuccessService] = useState<InstalledVPNService | null>(null);

  // QR Code & Copy link Modal -- shows a single client's link/QR. Loosely typed (not the
  // full InstalledVPNService) since it now needs to open for any ONE client out of a
  // service's client list, not just "the" service-level link.
  const [qrModalService, setQrModalService] = useState<{ name: string; uuid: string; clientLink: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Multi-client management: add/remove a client (peer/user) on an already-deployed
  // service, without touching the rest of its live config.
  const [addClientTarget, setAddClientTarget] = useState<InstalledVPNService | null>(null);
  const [newClientName, setNewClientName] = useState<string>("");
  const [isMutatingClients, setIsMutatingClients] = useState<boolean>(false);
  const [clientMutationLogs, setClientMutationLogs] = useState<string[]>([]);
  const [addClientResult, setAddClientResult] = useState<VPNClientEntry | null>(null);
  const [removingClient, setRemovingClient] = useState<{ service: InstalledVPNService; client: VPNClientEntry } | null>(null);

  // AI Assistant State ("МАСТЕР В СФЕРЕ ВПН")
  const [activeTab, setActiveTab] = useState<"catalog" | "installed" | "ai-expert">("catalog");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiMessages, setAiMessages] = useState<VPNAssistantMessage[]>([
    {
      id: "welcome-msg",
      sender: "ai",
      text: "👋Приветствую! Я — **МАСТЕР В СФЕРЕ ВПН**. Специализируюсь на протоколах Xray (VLESS REALITY, gRPC, VMess), AnyTLS v0.2.1, Shadowsocks-2022 и обходе блокировок ТСПУ/DPI.\n\nЗадайте вопрос по настройке, выбору маскировочного SNI домена или отправьте ошибку из логов для мгновенного решения!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      severity: "INFO",
      suggestedFixes: [
        "sudo systemctl status xray",
        "sudo ufw allow 443/tcp",
        "sudo journalctl -u xray -n 30 --no-pager"
      ]
    }
  ]);

  // Reset the list per-server (demo seed for the demo server, empty for real ones --
  // see DEMO_INSTALLED_SERVICES above) whenever the selected server changes, then pull
  // real systemd status for real servers so displayed Active/Stopped badges reflect
  // what's actually running rather than stale state carried over from a previous server.
  useEffect(() => {
    setInstalledServices(server.isDemo ? DEMO_INSTALLED_SERVICES : []);
  }, [server.id, server.isDemo]);

  // Execute SSH Status check on load for real servers
  useEffect(() => {
    checkServerVpnStatus();
  }, [server]);

  // Live traffic/uptime/connections polling -- keeps a ref in sync with the latest
  // installedServices so the interval callback below always builds its probe from
  // current data without needing to tear down/recreate the interval on every render.
  const installedServicesRef = useRef<InstalledVPNService[]>(installedServices);
  useEffect(() => {
    installedServicesRef.current = installedServices;
  }, [installedServices]);

  const refreshLiveVpnMetrics = async () => {
    if (server.isDemo) return;
    const services = installedServicesRef.current;
    if (services.length === 0) return;

    try {
      const probe = buildLiveMetricsProbe(services);
      const res = await execCommand(server, probe);
      const sections = parseKeySections(res.stdout || "");

      // AmneziaWG: sum real per-peer transfer bytes; a peer counts as "active" if its
      // last handshake was within the last 3 minutes (WireGuard's own rekey cadence).
      let awgRxBytes = 0;
      let awgTxBytes = 0;
      let awgHasTransfer = false;
      const awgTransferRaw = (sections["AWG_TRANSFER"] || "").trim();
      if (awgTransferRaw && awgTransferRaw !== "NONE") {
        for (const line of awgTransferRaw.split("\n")) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            awgRxBytes += Number(parts[1]) || 0;
            awgTxBytes += Number(parts[2]) || 0;
            awgHasTransfer = true;
          }
        }
      }
      let awgActiveClients = 0;
      const awgHandshakesRaw = (sections["AWG_HANDSHAKES"] || "").trim();
      if (awgHandshakesRaw && awgHandshakesRaw !== "NONE") {
        const nowSec = Math.floor(Date.now() / 1000);
        for (const line of awgHandshakesRaw.split("\n")) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const hsEpoch = Number(parts[1]) || 0;
            if (hsEpoch > 0 && nowSec - hsEpoch < 180) awgActiveClients++;
          }
        }
      }

      setInstalledServices((prev) =>
        prev.map((s) => {
          let uptimeSec = -1;
          if (s.protocolId.includes("xray") || s.protocolId === "shadowsocks-2022") {
            uptimeSec = parseInt(sections["XRAY_UPTIME"] || "-1", 10);
          } else if (s.protocolId === "anytls") {
            uptimeSec = parseInt(sections["ANYTLS_UPTIME"] || "-1", 10);
          } else if (s.protocolId === "amnezia-wg") {
            uptimeSec = parseInt(sections["AWG_UPTIME"] || "-1", 10);
          }

          let trafficRxGb = s.trafficRxGb;
          let trafficTxGb = s.trafficTxGb;
          let activeClientsCount = s.activeClientsCount;

          if (s.protocolId === "amnezia-wg") {
            if (awgHasTransfer) {
              trafficRxGb = awgRxBytes / 1e9;
              trafficTxGb = awgTxBytes / 1e9;
            }
            activeClientsCount = awgActiveClients;
          } else {
            const port = Number(s.port);
            const bytesRaw = sections[`PORT_${port}_BYTES`] || "";
            const sentMatches = [...bytesRaw.matchAll(/bytes_sent:(\d+)/g)].map((m) => Number(m[1]));
            const recvMatches = [...bytesRaw.matchAll(/bytes_received:(\d+)/g)].map((m) => Number(m[1]));
            if (sentMatches.length || recvMatches.length) {
              trafficTxGb = sentMatches.reduce((a, b) => a + b, 0) / 1e9;
              trafficRxGb = recvMatches.reduce((a, b) => a + b, 0) / 1e9;
            }
            const connsNum = parseInt((sections[`PORT_${port}_CONNS`] || "").trim(), 10);
            if (!Number.isNaN(connsNum)) activeClientsCount = connsNum;
          }

          return {
            ...s,
            uptime: formatUptimeSeconds(uptimeSec),
            trafficRxGb,
            trafficTxGb,
            activeClientsCount,
          };
        })
      );
    } catch (e) {
      console.error("Failed to refresh live VPN metrics", e);
    }
  };

  useEffect(() => {
    if (server.isDemo || activeTab !== "installed") return;
    refreshLiveVpnMetrics();
    const interval = setInterval(refreshLiveVpnMetrics, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id, server.isDemo, activeTab, installedServices.length]);

  // 3X-UI Options Conflict Resolution
  useEffect(() => {
    // REALITY does not support WebSocket (per the official transport-compatibility table).
    // splithttp (XHTTP) IS explicitly REALITY-compatible -- 'XHTTP: Beyond REALITY' is even
    // the feature's own name upstream -- so it must NOT be force-switched away.
    if (xrayTransport === "ws" && xraySecurity === "reality") {
      setXraySecurity("tls");
    }
    // XTLS Vision Flow strictly requires TCP and TLS/REALITY
    if (xrayFlow !== "none") {
      if (xrayTransport !== "tcp") {
        setXrayFlow("none"); // Automatically disable flow if transport changes from TCP
      }
      if (xraySecurity === "none") {
        setXraySecurity("reality");
      }
    }
  }, [xrayTransport, xraySecurity, xrayFlow]);

  // Bugs fixed here (found while auditing Start/Stop + status display on user's request):
  // 1. The systemd unit name for AnyTLS was queried as "anytls.service" -- that unit
  //    doesn't exist. The real deploy pipeline installs AnyTLS as the "sing-box" service
  //    (see handleStartDeploy's serviceName assignment), so this always came back
  //    unknown/inactive for a genuinely-running AnyTLS service.
  // 2. `res.stdout.split("\\n")` was splitting on the literal two-character text
  //    backslash+n, NOT the real newline character systemctl actually separates each
  //    unit's status with. So multi-unit output like "active\ninactive\nactive" never
  //    split at all -- `statuses` ended up as a single one-element array containing the
  //    whole multi-line blob, which then never string-equalled "active" for ANY
  //    protocol. Net effect: every real, genuinely-running VPN service got flagged
  //    "inactive" here on every server switch / page load, regardless of its true state.
  // Replaced with distinct marker-tagged systemctl calls (one per unit) so parsing
  // doesn't depend on positional array order or newline-splitting at all.
  const checkServerVpnStatus = async () => {
    if (server.isDemo) return;

    try {
      const res = await execCommand(
        server,
        `echo "XRAY:$(systemctl is-active xray 2>/dev/null || echo inactive)"; ` +
        `echo "ANYTLS:$(systemctl is-active sing-box 2>/dev/null || echo inactive)"; ` +
        `echo "AWG:$(systemctl is-active awg-quick@awg0 2>/dev/null || echo inactive)"`
      );
      const stdout = res.stdout || "";
      const xrayActive = /XRAY:active/.test(stdout);
      const anytlsActive = /ANYTLS:active/.test(stdout);
      const awgActive = /AWG:active/.test(stdout);

      setInstalledServices(prev => prev.map(inst => {
        let realActive = false;
        if (inst.protocolId.includes("xray") || inst.protocolId === "shadowsocks-2022") {
          realActive = xrayActive;
        } else if (inst.protocolId === "anytls") {
          realActive = anytlsActive;
        } else if (inst.protocolId === "amnezia-wg") {
          realActive = awgActive;
        }
        return { ...inst, status: realActive ? "active" : "inactive" };
      }));
    } catch (e) {
      console.error(e);
    }
  };

  // Start Deploy Handler
  const handleStartDeploy = async () => {
    if (!selectedDeployProtocol) return;

    if (selectedDeployProtocol.id === "amnezia-wg" && awgParamIssues.length > 0) {
      toast.error("Некорректные параметры обфускации AmneziaWG", awgParamIssues[0]);
      return;
    }

    if (selectedDeployProtocol.id === "anytls" && anytlsPaddingIssues.length > 0) {
      toast.error("Некорректная padding_scheme для AnyTLS", anytlsPaddingIssues[0]);
      return;
    }

    if (xraySecurity === "reality" && realityIssues.length > 0) {
      toast.error("Некорректные параметры REALITY", realityIssues[0]);
      return;
    }

    if (xrayTransport === "splithttp" && xraySplitHttpPaddingEnabled) {
      const from = parseInt(xraySplitHttpPaddingFrom.trim(), 10);
      const to = parseInt(xraySplitHttpPaddingTo.trim(), 10);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < 0 || from > to) {
        toast.error("Некорректный диапазон xPaddingBytes", "'От' должно быть <= 'До', оба неотрицательные целые числа.");
        return;
      }
    }

    // Generate credentials
    const newUuid = window.crypto?.randomUUID ? window.crypto.randomUUID() : "a" + Math.random().toString(36).substring(2, 10) + "-4f12-9012-" + Math.random().toString(36).substring(2, 12);
    let newPub = "pbk_" + Math.random().toString(36).substring(2, 15);
    const hostName = server.isDemo ? "demo.server.com" : server.host;

    // Cryptographic key generation for specific protocols (delegates to the shared
    // module-level implementation also used by the add-client flow)
    const generateBase64Key = (bytes: number, urlSafe: boolean = false) => generateSecureBase64Key(bytes, urlSafe);

    const isSs2022 = selectedDeployProtocol.id === "shadowsocks-2022";
    const ss2022Bytes = xraySsCipher.includes("128") ? 16 : 32;
    const ss2022Password = isSs2022 ? generateBase64Key(ss2022Bytes) : newUuid;

    // AmneziaWG 2.0 adds S3 (Cookie prefix) and S4 (Data prefix) on top of 1.0's
    // Jc/Jmin/Jmax/S1/S2/H1-H4. Now real, user-configurable, generator-backed state
    // (awgS3/awgS4) instead of hardcoded constants -- selecting "1.0" still genuinely
    // omits them (the generator itself returns 0 for both when version !== "2.0").
    // AmneziaWG/WireGuard is a mutual-auth protocol: both server and client need a real
    // X25519 keypair, and each side needs the OTHER side's public key ahead of time (it's
    // not a bearer-token/UUID scheme like Xray). The real keypairs are generated on the
    // server itself via `awg genkey`/`awg pubkey` during SSH deploy (see bashScript below)
    // and the placeholder here is ONLY ever shown for the demo server, which never deploys.
    const awgDemoClientPriv = generateBase64Key(32);
    const awgDemoServerPub = generateBase64Key(32);
    // Client's own address is hardcoded to .2/32 here because this ALWAYS builds the
    // service's very first client during initial deploy -- subsequent clients (added later
    // via "add client") get their own allocated address from handleAddClient instead, via
    // the shared buildAwgClientConfShared() with a real, non-colliding address.
    const buildAwgClientConf = (clientPriv: string, serverPub: string) =>
      buildAwgClientConfShared({
        clientPriv, serverPub, clientAddress: "10.29.29.2/32",
        endpointHost: safeHost, endpointPort: deployPort, awgVersion,
        awgJc, awgJmin, awgJmax, awgS1, awgS2, awgS3, awgS4, awgH1, awgH2, awgH3, awgH4,
      });

    setIsDeploying(true);
    setDeployLogs([`[SSH] Подключение к серверу ${server.username}@${server.host}:${server.port}...`]);

    const preSteps = [
      `[APT] Обновление пакетов apt и установка зависимостей (curl, wget, jq, unzip)...`,
      `[DOWNLOAD] Загрузка бинарных файлов ${selectedDeployProtocol.name} (${selectedDeployProtocol.version})...`,
      `[KEYGEN] Генерация пар ключей и UUID пользователя...`,
      `[CONFIG] Создание конфигурации с маскировкой SNI: ${deploySni}...`,
      `[FIREWALL] Настройка UFW: открытие порта ${deployPort}/tcp...`,
      `[SYSTEMD] Регистрация юнита systemd и запуск службы...`,
    ];

    if (server.isDemo) {
      // Demo server: nothing real happens, this is a pure UI simulation.
      for (let i = 0; i < preSteps.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setDeployLogs((prev) => [...prev, preSteps[i]]);
      }
      setDeployLogs((prev) => [...prev, `[SUCCESS] Демо-деплой завершён (симуляция, реальные команды не выполнялись).`]);
    } else {
      // Real server: do NOT dump a fake "steps completed" log up front -- each phase below
      // is executed and verified against the actual server one at a time, and only the real
      // pipeline log lines (from runDeployPipeline) get appended from here on.
      setDeployLogs((prev) => [...prev, `[SSH] Запускаю пошаговый деплой ${selectedDeployProtocol.name} (может занять 1-3 минуты)...`]);
    }

    // Generate protocol specific standard link
    const actualFlow = xrayTransport === "tcp" ? xrayFlow : "none";
    // Xray-core's internal JSON `network` value is "splithttp", but the client share-link
    // ecosystem (v2rayN, NekoBox, Shadowrocket, sing-box clients, etc.) universally expects
    // `type=xhttp` in the URI for this transport -- they're the same wire protocol, just a
    // naming split between Xray-core's own config schema and the community link convention.
    const uriTransportType = (xrayTransport as string) === "splithttp" ? "xhttp" : xrayTransport;
    const safeHost = hostName.includes(":") ? `[${hostName}]` : hostName;
    // Server/client names are free text (can contain spaces, parens, cyrillic, etc.) --
    // URI fragments must be percent-encoded per RFC 3986, or strict client parsers
    // (mobile deep-link handlers, QR scanners) will choke on or truncate the link.
    const encName = (s: string) => encodeURIComponent(s);
    let link = "";
    if (selectedDeployProtocol.id === "anytls") {
      link = `anytls://${newUuid}@${safeHost}:${deployPort}?sni=${deploySni}&insecure=1#${encName(`${server.name}-AnyTLS-sing-box`)}`;
    } else if (selectedDeployProtocol.id === "amnezia-wg") {
      // Real clients (native AmneziaWG app, wg-quick, etc.) import a plain WireGuard-style
      // .conf file or a QR code of that same text -- there is no "awg://" URI scheme. This
      // placeholder (demo-key based) gets fully replaced with the real server-generated
      // keys once the real SSH deploy below reports back the actual keypairs.
      link = buildAwgClientConf(awgDemoClientPriv, awgDemoServerPub);
    } else if (selectedDeployProtocol.id === "shadowsocks-2022") {
      link = `ss://${btoa(xraySsCipher + ":" + ss2022Password)}@${safeHost}:${deployPort}#${encName(`${server.name}-${deployClientName}`)}`;
    } else if (selectedDeployProtocol.id === "xray-vmess-ws") {
      const vmessTls = xraySecurity === "none" ? "" : xraySecurity;
      link = `vmess://${btoa(JSON.stringify({ v: "2", ps: `${server.name}-${deployClientName}`, add: safeHost, port: deployPort, id: newUuid, aid: 0, net: uriTransportType, type: "none", host: xrayWsHost || deploySni, path: xrayWsPath, tls: vmessTls, sni: deploySni, ...(xrayTransport === "splithttp" ? { mode: xraySplitHttpMode } : {}) }))}`;
    } else if (selectedDeployProtocol.id === "xray-trojan-grpc") {
      let query = `type=${uriTransportType}&security=${xraySecurity}&sni=${deploySni}`;
      if (xrayTransport === "grpc") query += `&serviceName=${xrayGrpcServiceName}`;
      if (xrayTransport === "ws") query += `&path=${encodeURIComponent(xrayWsPath)}${xrayWsHost ? `&host=${encodeURIComponent(xrayWsHost)}` : ""}`;
      if (xrayTransport === "splithttp") query += `&path=${encodeURIComponent(xrayWsPath)}${xrayWsHost ? `&host=${encodeURIComponent(xrayWsHost)}` : ""}&mode=${xraySplitHttpMode}`;
      link = `trojan://${newUuid}@${safeHost}:${deployPort}?${query}#${encName(`${server.name}-${deployClientName}`)}`;
    } else {
      // VLESS REALITY / VLESS TLS
      let query = `type=${uriTransportType}&security=${xraySecurity}&fp=${utlsFingerprint}&sni=${deploySni}`;
      if (xraySecurity === "reality") {
        query += `&pbk=${xrayPublicKey || newPub}&sid=${xrayShortId}`;
      }
      if (actualFlow !== "none") {
        query += `&flow=${actualFlow}`;
      }
      if (xrayTransport === "grpc") {
        query += `&serviceName=${xrayGrpcServiceName}`;
      } else if (xrayTransport === "ws") {
        query += `&path=${encodeURIComponent(xrayWsPath)}${xrayWsHost ? `&host=${encodeURIComponent(xrayWsHost)}` : ""}`;
      } else if (xrayTransport === "splithttp") {
        query += `&path=${encodeURIComponent(xrayWsPath)}${xrayWsHost ? `&host=${encodeURIComponent(xrayWsHost)}` : ""}&mode=${xraySplitHttpMode}`;
      }
      link = `vless://${newUuid}@${safeHost}:${deployPort}?${query}#${encName(`${server.name}-${deployClientName}`)}`;
    }

    // Real SSH Execution if server is not Demo
    // Real SSH Execution if server is not Demo -- orchestrated as discrete, verified steps
    // (see src/utils/deployPipeline.ts) instead of one giant bash script whose only real
    // check used to be a single `systemctl is-active` at the very end. Each step here is
    // verified against actual server state, and if any step fails, everything already
    // applied (firewall rule, config file, etc.) is rolled back automatically.
    if (!server.isDemo) {
      const isXrayFamily = selectedDeployProtocol.id.includes("xray") || selectedDeployProtocol.id === "shadowsocks-2022";
      const isAnytls = selectedDeployProtocol.id === "anytls";
      const isAwg = selectedDeployProtocol.id === "amnezia-wg";
      const isRealityProtocol = selectedDeployProtocol.id === "xray-vless-reality";
      // Which L4 protocol(s) actually need a firewall hole. This was previously always a
      // single tcp/udp choice (isAwg ? "udp" : "tcp") -- which silently broke Shadowsocks-2022:
      // its own inbound settings explicitly declare `network: "tcp,udp"` (real UDP relay, used
      // for games/voice per its own catalog description), but the deploy pipeline only ever
      // opened the TCP port for it. Any UDP traffic through it was being dropped by ufw with
      // no error anywhere -- a real "looks deployed, partially doesn't work" bug.
      const isSsProtocol2 = selectedDeployProtocol.id === "shadowsocks-2022";
      const protosToOpen: ("tcp" | "udp")[] = isAwg ? ["udp"] : isSsProtocol2 ? ["tcp", "udp"] : ["tcp"];

      // Single source of truth (see getProtocolRuntimeInfo above) -- keeps this deploy
      // pipeline and the add/remove-client pipelines permanently in sync on paths/unit name.
      const runtimeInfo = getProtocolRuntimeInfo(selectedDeployProtocol.id);
      const serviceName: string = runtimeInfo.serviceName;
      const confPath = runtimeInfo.primaryConfigPath;
      const secondaryPath = runtimeInfo.secondaryConfigPath;

      // Populated by the "keygen" step's verify() below, read (by closure reference) later
      // by write_config -- so the config can embed REAL keys directly instead of writing a
      // placeholder that gets sed-patched afterwards.
      let realityServerPriv = "";
      let realityServerPub = "";
      let awgServerPriv = "";
      let awgServerPub = "";
      let awgClientPriv = "";
      let awgClientPub = "";
      let awgEgressIface = "eth0";
      // Default true = safest (never delete a rule we didn't add) -- one flag per proto in protosToOpen.
      let portRulesExisted: boolean[] = protosToOpen.map(() => true);
      let serviceRestartAttempted = false;

      const buildAwgServerConf = (serverPriv: string, clientPub: string, egressIface: string) => {
        const lines = [
          "[Interface]",
          "Address = 10.29.29.1/24",
          `ListenPort = ${deployPort}`,
          `PrivateKey = ${serverPriv}`,
          `Jc = ${awgJc}`,
          `Jmin = ${awgJmin}`,
          `Jmax = ${awgJmax}`,
          `S1 = ${awgS1}`,
          `S2 = ${awgS2}`,
        ];
        if (awgVersion === "2.0") {
          lines.push(`S3 = ${awgS3}`, `S4 = ${awgS4}`);
        }
        lines.push(
          `H1 = ${awgH1}`,
          `H2 = ${awgH2}`,
          `H3 = ${awgH3}`,
          `H4 = ${awgH4}`,
          `PostUp = iptables -A FORWARD -i awg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o ${egressIface} -j MASQUERADE`,
          `PostDown = iptables -D FORWARD -i awg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o ${egressIface} -j MASQUERADE`,
          "",
          "[Peer]",
          `PublicKey = ${clientPub}`,
          "AllowedIPs = 10.29.29.2/32"
        );
        return lines.join("\n");
      };

      const buildDeployConfigContent = (): string => {
        if (isAwg) {
          return buildAwgServerConf(awgServerPriv, awgClientPub, awgEgressIface);
        }
        if (isAnytls) {
          const tlsObj: any = {
            enabled: true,
            server_name: deploySni || "swdist.apple.com",
            certificate_path: "/etc/sing-box/cert.crt",
            key_path: "/etc/sing-box/cert.key"
          };
          // ALPN: purely a TLS-handshake-level camouflage knob (works even with the
          // self-signed cert + client-side insecure=1, since ALPN negotiation happens
          // before any certificate validation) -- makes the handshake look like it's
          // offering real HTTP/2, rather than a bare/unusual ALPN-less TLS server.
          const alpnList = anytlsAlpn.trim() ? anytlsAlpn.split(",").map((s) => s.trim()).filter(Boolean) : [];
          if (alpnList.length > 0) tlsObj.alpn = alpnList;
          // Pinning min_version === max_version forces exactly that TLS version --
          // "auto" leaves both unset (sing-box negotiates its own default range).
          if (anytlsTlsVersion !== "auto") {
            tlsObj.min_version = anytlsTlsVersion;
            tlsObj.max_version = anytlsTlsVersion;
          }

          const inboundObj: any = {
            type: "anytls",
            tag: "anytls-in",
            listen: "::",
            listen_port: deployPort,
            users: [{ name: deployClientName, password: newUuid }],
            tls: tlsObj
          };
          // Omitted entirely (not even an empty array) when mode is "default" -- per the
          // sing-box docs, an empty/unset padding_scheme falls back to its own built-in
          // default scheme, which is exactly what "default" mode is meant to mean.
          if (anytlsPaddingMode === "custom") {
            const paddingLines = anytlsPaddingScheme.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#"));
            if (paddingLines.length > 0) inboundObj.padding_scheme = paddingLines;
          }

          return JSON.stringify({
            log: { level: "info", timestamp: true },
            inbounds: [inboundObj],
            outbounds: [{ type: "direct", tag: "direct" }]
          }, null, 2);
        }

        // Full Xray Configuration Engine (VLESS/VMess/Trojan/Shadowsocks-2022)
        const destOverride: string[] = [];
        if (xraySniffingHttp) destOverride.push("http");
        if (xraySniffingTls) destOverride.push("tls");
        if (xraySniffingQuic) destOverride.push("quic");
        if (xraySniffingFakedns) destOverride.push("fakedns");

        let protoName = "vless";
        if (selectedDeployProtocol.id === "xray-vmess-ws") protoName = "vmess";
        else if (selectedDeployProtocol.id === "xray-trojan-grpc") protoName = "trojan";
        else if (selectedDeployProtocol.id === "shadowsocks-2022") protoName = "shadowsocks";

        const actualFlow2 = xrayTransport === "tcp" ? xrayFlow : "none";

        let inboundSettings: any = {};
        if (protoName === "vless") {
          inboundSettings = {
            clients: [{ id: newUuid, flow: actualFlow2 !== "none" ? actualFlow2 : undefined, email: `${deployClientName}@xray` }],
            decryption: "none"
          };
        } else if (protoName === "vmess") {
          inboundSettings = { clients: [{ id: newUuid, alterId: 0, email: `${deployClientName}@xray` }] };
        } else if (protoName === "trojan") {
          inboundSettings = { clients: [{ password: newUuid, email: `${deployClientName}@xray` }] };
        } else if (protoName === "shadowsocks") {
          inboundSettings = { method: xraySsCipher, password: ss2022Password, email: `${deployClientName}@xray`, network: "tcp,udp" };
        }

        let streamSettings: any = { network: xrayTransport, security: xraySecurity };
        if (xraySecurity === "reality") {
          streamSettings.realitySettings = {
            show: false,
            dest: xrayDest || `${deploySni}:443`,
            xver: 0,
            // Multiple serverNames/shortIds now genuinely wired (primary value first,
            // matching the client link's single-value fp/sid, plus any extras from the
            // advanced panel) -- previously always hardcoded to a single-element array.
            serverNames: realityServerNamesList.length > 0 ? realityServerNamesList : [deploySni],
            // Real server-generated key, obtained by the "keygen" step above -- no more
            // placeholder + sed-patch dance.
            privateKey: realityServerPriv || "MISSING_REALITY_KEY",
            shortIds: realityShortIdsList.length > 0 ? realityShortIdsList : [xrayShortId || "6ba7b810"],
            // NOTE: `fingerprint` was previously (incorrectly) set here. Per the official
            // docs (xtls.github.io/en/config/transports/reality.html), fingerprint is
            // explicitly an OUTBOUND/client-only field and has no effect in the inbound
            // (server) config -- removed. The client link already carries fp= correctly.
            ...(xrayMinClientVer.trim() ? { minClientVer: xrayMinClientVer.trim() } : {}),
            ...(xrayMaxClientVer.trim() ? { maxClientVer: xrayMaxClientVer.trim() } : {}),
            ...(xrayMaxTimeDiff.trim() ? { maxTimeDiff: parseInt(xrayMaxTimeDiff.trim(), 10) } : {}),
            ...(xrayMldsa65Seed.trim() ? { mldsa65Seed: xrayMldsa65Seed.trim() } : {}),
            ...(xrayFallbackLimitEnabled ? {
              limitFallbackUpload: {
                afterBytes: parseInt(xrayFallbackAfterBytes.trim() || "0", 10),
                bytesPerSec: parseInt(xrayFallbackBytesPerSec.trim() || "0", 10),
                burstBytesPerSec: parseInt(xrayFallbackBurstBytesPerSec.trim() || "0", 10)
              },
              limitFallbackDownload: {
                afterBytes: parseInt(xrayFallbackAfterBytes.trim() || "0", 10),
                bytesPerSec: parseInt(xrayFallbackBytesPerSec.trim() || "0", 10),
                burstBytesPerSec: parseInt(xrayFallbackBurstBytesPerSec.trim() || "0", 10)
              }
            } : {})
          };
        } else if (xraySecurity === "tls") {
          streamSettings.tlsSettings = {
            serverName: deploySni,
            alpn: xrayAlpn.split(",").map((s) => s.trim()),
            certificates: [{ certificateFile: "/etc/xray/cert.crt", keyFile: "/etc/xray/cert.key" }]
          };
        }
        if (xrayTransport === "grpc") {
          streamSettings.grpcSettings = {
            serviceName: xrayGrpcServiceName || "grpc-vless",
            multiMode: xrayGrpcMultiMode,
            ...(xrayGrpcIdleTimeout.trim() && /^\d+$/.test(xrayGrpcIdleTimeout.trim()) ? { idle_timeout: parseInt(xrayGrpcIdleTimeout.trim(), 10) } : {})
          };
        } else if (xrayTransport === "ws") {
          streamSettings.wsSettings = {
            path: xrayWsPath || "/ws",
            headers: xrayWsHost ? { Host: xrayWsHost } : {},
            ...(xrayWsHeartbeat.trim() && /^\d+$/.test(xrayWsHeartbeat.trim()) ? { heartbeatPeriod: parseInt(xrayWsHeartbeat.trim(), 10) } : {})
          };
        } else if (xrayTransport === "splithttp") {
          // network:"splithttp" is Xray-core's real internal name for what the ecosystem
          // (share-links, other panels) markets as "XHTTP" -- both host/path are shared with
          // the WS fields above (same concept, kept as one UI section) since XHTTP is HTTP-based
          // just like WS. mode defaults to "auto" (server negotiates); xPaddingBytes is a real,
          // documented random-padding-range knob, off by default so behavior is unsurprising.
          streamSettings.splithttpSettings = {
            path: xrayWsPath || "/xhttp",
            host: xrayWsHost || undefined,
            mode: xraySplitHttpMode,
            ...(xraySplitHttpPaddingEnabled && /^\d+$/.test(xraySplitHttpPaddingFrom.trim()) && /^\d+$/.test(xraySplitHttpPaddingTo.trim())
              ? { xPaddingBytes: { from: parseInt(xraySplitHttpPaddingFrom.trim(), 10), to: parseInt(xraySplitHttpPaddingTo.trim(), 10) } }
              : {})
          };
        }

        const routingRules: any[] = [];
        if (xrayBlockP2p) routingRules.push({ type: "field", protocol: ["bittorrent"], outboundTag: "block" });
        if (xrayBlockAds) routingRules.push({ type: "field", outboundTag: "block", domain: ["geosite:category-ads-all"] });
        if (xrayBlockPrivateIp) routingRules.push({ type: "field", outboundTag: "block", ip: ["geoip:private"] });

        return JSON.stringify({
          log: { loglevel: "warning" },
          inbounds: [
            {
              listen: "0.0.0.0",
              port: deployPort,
              protocol: protoName,
              settings: inboundSettings,
              streamSettings: streamSettings,
              sniffing: xraySniffing
                ? { enabled: true, destOverride: destOverride.length > 0 ? destOverride : ["http", "tls"], metadataOnly: false, routeOnly: xrayRouteOnly }
                : { enabled: false }
            }
          ],
          outbounds: [
            { protocol: "freedom", tag: "direct", settings: { domainStrategy: xrayPreferIpv4 ? "UseIPv4" : xrayDomainStrategy } },
            { protocol: "blackhole", tag: "block", settings: { response: { type: "none" } } }
          ],
          routing: { domainStrategy: xrayDomainStrategy, rules: routingRules }
        }, null, 2);
      };

      const steps: DeployStep[] = [];

      // --- Step 1: base packages + kernel tuning + firewall rule ---
      steps.push({
        key: "prep",
        label: "Установка базовых пакетов, настройка сети (BBR) и firewall",
        run: () => execCommand(server, `
          sudo apt-get update -y && sudo apt-get install -y curl wget jq unzip ufw software-properties-common openssl iptables
          ${enableBbr ? `
          sudo sysctl -w net.ipv4.ip_forward=1
          sudo sysctl -w net.core.default_qdisc=fq
          sudo sysctl -w net.ipv4.tcp_congestion_control=bbr
          sudo mkdir -p /etc/sysctl.d
          grep -q "net.ipv4.ip_forward=1" /etc/sysctl.d/99-vpn.conf 2>/dev/null || echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.d/99-vpn.conf >/dev/null
          grep -q "net.core.default_qdisc=fq" /etc/sysctl.d/99-vpn.conf 2>/dev/null || echo "net.core.default_qdisc=fq" | sudo tee -a /etc/sysctl.d/99-vpn.conf >/dev/null
          grep -q "net.ipv4.tcp_congestion_control=bbr" /etc/sysctl.d/99-vpn.conf 2>/dev/null || echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.d/99-vpn.conf >/dev/null
          sudo sysctl -p /etc/sysctl.d/99-vpn.conf 2>/dev/null || true
          ` : ""}
          ${protosToOpen.map((p) => `sudo ufw status | grep -q "${deployPort}/${p}" && echo "PORT_RULE_EXISTED_${p.toUpperCase()}:YES" || echo "PORT_RULE_EXISTED_${p.toUpperCase()}:NO"`).join("\n          ")}
          ${protosToOpen.map((p) => `sudo ufw allow ${deployPort}/${p} 2>/dev/null || true`).join("\n          ")}
          command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1 && command -v openssl >/dev/null 2>&1 && echo DEPS_OK || echo DEPS_MISSING
        `),
        verify: (res) => {
          portRulesExisted = protosToOpen.map((p) => res.stdout.includes(`PORT_RULE_EXISTED_${p.toUpperCase()}:YES`));
          if (!res.stdout.includes("DEPS_OK")) return `Не удалось установить базовые зависимости (curl/jq/openssl) -- проверь доступ apt на сервере.${res.stderr ? ` (${res.stderr.slice(-200)})` : ""}`;
          return null;
        },
        rollback: async () => {
          for (let i = 0; i < protosToOpen.length; i++) {
            if (!portRulesExisted[i]) {
              await execCommand(server, `sudo ufw delete allow ${deployPort}/${protosToOpen[i]} 2>/dev/null || true`);
            }
          }
        },
      });

      // --- Step 2: install protocol binary ---
      steps.push({
        key: "install_binary",
        label: `Установка ${selectedDeployProtocol.name}`,
        run: () => {
          if (isXrayFamily) {
            return execCommand(server, `
              bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install -u root
              sudo mkdir -p /etc/xray /usr/local/etc/xray
              if [ ! -f /etc/xray/cert.crt ]; then
                sudo openssl req -x509 -newkey rsa:2048 -nodes -keyout /etc/xray/cert.key -out /etc/xray/cert.crt -days 3650 -subj "/CN=${deploySni}" 2>/dev/null || true
              fi
              command -v xray >/dev/null 2>&1 && echo BIN_OK || echo BIN_MISSING
            `);
          }
          if (isAnytls) {
            return execCommand(server, `
              sudo mkdir -p /etc/sing-box /usr/local/bin
              if [ ! -f /etc/sing-box/cert.crt ]; then
                sudo openssl req -x509 -newkey rsa:2048 -nodes -keyout /etc/sing-box/cert.key -out /etc/sing-box/cert.crt -days 3650 -subj "/CN=${deploySni}" 2>/dev/null || true
              fi
              if ! command -v sing-box >/dev/null 2>&1; then
                curl -fsSL https://sing-box.app/install.sh | sh -s -- 2>/dev/null || {
                  SINGBOX_URL=$(curl -s https://api.github.com/repos/SagerNet/sing-box/releases/latest | jq -r '.assets[] | select(.name | contains("linux") and contains("amd64.tar.gz")) | .browser_download_url' 2>/dev/null | head -n 1)
                  if [ -n "$SINGBOX_URL" ] && [ "$SINGBOX_URL" != "null" ]; then
                    curl -sL "$SINGBOX_URL" -o /tmp/sing-box.tar.gz
                    tar -xzf /tmp/sing-box.tar.gz -C /tmp/ 2>/dev/null || true
                    sudo mv /tmp/sing-box-*/sing-box /usr/local/bin/sing-box 2>/dev/null || true
                    sudo chmod +x /usr/local/bin/sing-box 2>/dev/null || true
                    find /tmp -maxdepth 1 -name "sing-box*" -exec rm -r -f {} + 2>/dev/null || true
                  fi
                }
              fi
              if [ ! -f /etc/systemd/system/sing-box.service ]; then
                echo "[Unit]
Description=sing-box Service (AnyTLS Core)
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/sing-box run -c /etc/sing-box/config.json
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target" | sudo tee /etc/systemd/system/sing-box.service > /dev/null
              fi
              sudo systemctl daemon-reload
              command -v sing-box >/dev/null 2>&1 && echo BIN_OK || echo BIN_MISSING
            `);
          }
          // AmneziaWG
          return execCommand(server, `
            sudo add-apt-repository -y ppa:amnezia/ppa 2>/dev/null || true
            sudo apt-get update -y 2>/dev/null || true
            if sudo apt-get install -y amneziawg amneziawg-tools amneziawg-dkms 2>/dev/null; then
              echo "[AWG] Installed via official PPA"
            else
              echo "[AWG] PPA install failed -- falling back to prebuilt awg/awg-quick binaries"
              AWG_URL=$(curl -s https://api.github.com/repos/amnezia-vpn/amneziawg-tools/releases/latest | jq -r '.assets[] | select(.name | test("ubuntu")) | .browser_download_url' 2>/dev/null | head -n 1)
              if [ -n "$AWG_URL" ] && [ "$AWG_URL" != "null" ]; then
                curl -sL "$AWG_URL" -o /tmp/awgtools.zip
                mkdir -p /tmp/awgtools && (cd /tmp/awgtools && unzip -o /tmp/awgtools.zip >/dev/null 2>&1)
                AWG_BIN_F=$(find /tmp/awgtools -type f -name "awg" | head -n 1)
                AWGQ_BIN_F=$(find /tmp/awgtools -type f -name "awg-quick" | head -n 1)
                [ -n "$AWG_BIN_F" ] && sudo install -m 755 "$AWG_BIN_F" /usr/bin/awg
                [ -n "$AWGQ_BIN_F" ] && sudo install -m 755 "$AWGQ_BIN_F" /usr/bin/awg-quick
                find /tmp/awgtools -delete 2>/dev/null || true
                rm -f /tmp/awgtools.zip 2>/dev/null || true
              fi
              if [ ! -f /etc/systemd/system/awg-quick@.service ]; then
                echo "[Unit]
Description=AmneziaWG via awg-quick(8) for %I
After=network-online.target nss-lookup.target
Wants=network-online.target nss-lookup.target
Documentation=man:awg-quick(8)
Documentation=man:awg(8)

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/awg-quick up %i
ExecStop=/usr/bin/awg-quick down %i
ExecReload=/bin/bash -c 'exec /usr/bin/awg syncconf %i <(/usr/bin/awg-quick strip %i)'
Environment=WG_ENDPOINT_RESOLUTION_RETRIES=infinity

[Install]
WantedBy=multi-user.target" | sudo tee /etc/systemd/system/awg-quick@.service > /dev/null
                sudo systemctl daemon-reload 2>/dev/null || true
              fi
            fi
            sudo mkdir -p /etc/amnezia/amneziawg /etc/wireguard
            ( command -v awg || command -v wg ) >/dev/null 2>&1 && echo BIN_OK || echo BIN_MISSING
          `);
        },
        verify: (res) => {
          if (!res.stdout.includes("BIN_OK")) {
            return `Не удалось установить бинарный файл ${isXrayFamily ? "xray" : isAnytls ? "sing-box" : "awg/wg"} -- проверь интернет-доступ сервера к GitHub/офиц. репозиториям.${res.stderr ? ` (${res.stderr.slice(-200)})` : ""}`;
          }
          return null;
        },
      });

      // --- Step 3 (only reality / awg): generate real keys on the server ---
      if (isRealityProtocol) {
        steps.push({
          key: "keygen",
          label: "Генерация REALITY-ключей на сервере",
          run: () => execCommand(server, `
            XRAY_BIN=$(command -v xray || echo /usr/local/bin/xray)
            $XRAY_BIN x25519 > /tmp/xray_keys 2>/dev/null || true
            SERVER_PRIV=$(grep -iE "Private ?Key\\)?:" /tmp/xray_keys 2>/dev/null | awk -F': ' '{print $2}' | tr -d ' \\r')
            SERVER_PUB=$(grep -iE "Public ?Key\\)?:" /tmp/xray_keys 2>/dev/null | awk -F': ' '{print $2}' | tr -d ' \\r')
            rm -f /tmp/xray_keys 2>/dev/null || true
            if [ -n "$SERVER_PRIV" ] && [ -n "$SERVER_PUB" ]; then
              echo "XRAY_REALITY_PRIV:$SERVER_PRIV"
              echo "XRAY_REALITY_PUB:$SERVER_PUB"
            else
              echo "KEYGEN_FAILED"
            fi
          `),
          verify: (res) => {
            const privM = res.stdout.match(/XRAY_REALITY_PRIV:(\S+)/);
            const pubM = res.stdout.match(/XRAY_REALITY_PUB:(\S+)/);
            if (!privM || !pubM) return "Не удалось сгенерировать REALITY-ключи (xray x25519 не вернул ожидаемый вывод).";
            realityServerPriv = privM[1];
            realityServerPub = pubM[1];
            return null;
          },
        });
      } else if (isAwg) {
        steps.push({
          key: "keygen",
          label: "Генерация X25519-ключей AmneziaWG на сервере",
          run: () => execCommand(server, `
            AWG_BIN=$(command -v awg || command -v wg || echo /usr/bin/awg)
            AWG_SERVER_PRIV=$($AWG_BIN genkey 2>/dev/null)
            AWG_SERVER_PUB=$(echo "$AWG_SERVER_PRIV" | $AWG_BIN pubkey 2>/dev/null)
            AWG_CLIENT_PRIV=$($AWG_BIN genkey 2>/dev/null)
            AWG_CLIENT_PUB=$(echo "$AWG_CLIENT_PRIV" | $AWG_BIN pubkey 2>/dev/null)
            AWG_EGRESS_IFACE=$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')
            [ -z "$AWG_EGRESS_IFACE" ] && AWG_EGRESS_IFACE="eth0"
            if [ -n "$AWG_SERVER_PRIV" ] && [ -n "$AWG_SERVER_PUB" ] && [ -n "$AWG_CLIENT_PRIV" ] && [ -n "$AWG_CLIENT_PUB" ]; then
              echo "AWG_SERVER_PRIV:$AWG_SERVER_PRIV"
              echo "AWG_SERVER_PUB:$AWG_SERVER_PUB"
              echo "AWG_CLIENT_PRIV:$AWG_CLIENT_PRIV"
              echo "AWG_CLIENT_PUB:$AWG_CLIENT_PUB"
              echo "AWG_IFACE:$AWG_EGRESS_IFACE"
            else
              echo "KEYGEN_FAILED"
            fi
          `),
          verify: (res) => {
            const sp = res.stdout.match(/AWG_SERVER_PRIV:(\S+)/);
            const spub = res.stdout.match(/AWG_SERVER_PUB:(\S+)/);
            const cp = res.stdout.match(/AWG_CLIENT_PRIV:(\S+)/);
            const cpub = res.stdout.match(/AWG_CLIENT_PUB:(\S+)/);
            const iface = res.stdout.match(/AWG_IFACE:(\S+)/);
            if (!sp || !spub || !cp || !cpub) return "Не удалось сгенерировать ключи AmneziaWG (awg/wg genkey не сработал -- бинарник не найден или сломан).";
            awgServerPriv = sp[1];
            awgServerPub = spub[1];
            awgClientPriv = cp[1];
            awgClientPub = cpub[1];
            if (iface) awgEgressIface = iface[1];
            return null;
          },
        });
      }

      // --- Step 4: backup + write config ---
      steps.push({
        key: "write_config",
        label: "Резервное копирование и запись конфигурации",
        run: () => {
          const content = buildDeployConfigContent();
          const escaped = content.replace(/'/g, `'\\''`);
          return execCommand(server, `
            CONF_PATH="${confPath}"
            sudo mkdir -p "$(dirname "$CONF_PATH")"
            if [ -f "$CONF_PATH" ]; then sudo cp "$CONF_PATH" "$CONF_PATH.rollback.bak"; echo BACKED_UP; else echo NO_PRIOR; fi
            echo '${escaped}' | sudo tee "$CONF_PATH" > /dev/null
            ${secondaryPath ? `
            SEC_PATH="${secondaryPath}"
            sudo mkdir -p "$(dirname "$SEC_PATH")"
            [ -f "$SEC_PATH" ] && sudo cp "$SEC_PATH" "$SEC_PATH.rollback.bak" 2>/dev/null
            echo '${escaped}' | sudo tee "$SEC_PATH" > /dev/null 2>&1 || true
            ` : ""}
            ${isAwg ? `sudo chmod 600 "$CONF_PATH" ${secondaryPath ? `"${secondaryPath}"` : ""} 2>/dev/null || true` : ""}
            test -s "$CONF_PATH" && echo WRITE_OK || echo WRITE_FAIL
          `);
        },
        verify: (res) => {
          if (!res.stdout.includes("WRITE_OK")) return `Не удалось записать файл конфигурации на сервере (проверь права sudo и свободное место на диске).${res.stderr ? ` (${res.stderr.slice(-200)})` : ""}`;
          return null;
        },
        rollback: async () => {
          await execCommand(server, `
            CONF_PATH="${confPath}"
            if [ -f "$CONF_PATH.rollback.bak" ]; then sudo mv "$CONF_PATH.rollback.bak" "$CONF_PATH"; else sudo rm -f "$CONF_PATH"; fi
            ${secondaryPath ? `
            SEC_PATH="${secondaryPath}"
            if [ -f "$SEC_PATH.rollback.bak" ]; then sudo mv "$SEC_PATH.rollback.bak" "$SEC_PATH"; else sudo rm -f "$SEC_PATH" 2>/dev/null || true; fi
            ` : ""}
          `);
          if (serviceRestartAttempted) {
            // The service was already restarted with the config we just reverted away from --
            // bring it back up with the restored previous config instead of leaving it broken.
            await execCommand(server, `sudo systemctl restart ${serviceName} 2>/dev/null || true`);
          }
        },
      });

      // --- Step 5: validate config BEFORE ever touching the running service ---
      steps.push({
        key: "validate_config",
        label: "Валидация конфигурации перед запуском службы",
        run: () => {
          if (isXrayFamily) {
            return execCommand(server, `XRAY_BIN=$(command -v xray || echo /usr/local/bin/xray); $XRAY_BIN run -test -config "${confPath}" 2>&1; echo "VALIDATE_CODE:$?"`);
          }
          if (isAnytls) {
            return execCommand(server, `SB_BIN=$(command -v sing-box || echo /usr/local/bin/sing-box); $SB_BIN check -c "${confPath}" 2>&1; echo "VALIDATE_CODE:$?"`);
          }
          return execCommand(server, `grep -q "PrivateKey" "${confPath}" && grep -q "ListenPort" "${confPath}" && grep -q "\\[Peer\\]" "${confPath}" && echo "VALIDATE_CODE:0" || echo "VALIDATE_CODE:1"`);
        },
        verify: (res) => {
          const match = res.stdout.match(/VALIDATE_CODE:(\d+)/);
          if (!match || match[1] !== "0") {
            const tail = res.stdout.slice(-500);
            return `Конфигурация не прошла проверку синтаксиса -- служба НЕ была тронута. Вывод: ${tail}`;
          }
          return null;
        },
      });

      // --- Step 6: start + verify real systemd state ---
      steps.push({
        key: "start_service",
        label: "Запуск и проверка службы systemd",
        run: () => {
          serviceRestartAttempted = true;
          return execCommand(server, `
            sudo systemctl daemon-reload 2>/dev/null || true
            sudo systemctl enable ${serviceName} 2>/dev/null || true
            sudo systemctl restart ${serviceName} 2>/dev/null || true
            sleep 2
            for i in 1 2 3; do
              STATE=$(systemctl show ${serviceName} --property=ActiveState --value 2>/dev/null)
              [ "$STATE" = "active" ] && break
              sleep 2
            done
            echo "ACTIVE_STATE:$(systemctl show ${serviceName} --property=ActiveState --value 2>/dev/null)"
            echo "SUB_STATE:$(systemctl show ${serviceName} --property=SubState --value 2>/dev/null)"
          `);
        },
        verify: (res) => {
          const active = res.stdout.match(/ACTIVE_STATE:(\w+)/)?.[1];
          const sub = res.stdout.match(/SUB_STATE:(\w+)/)?.[1];
          if (active !== "active") {
            return `Служба ${serviceName} не поднялась (${active || "unknown"}/${sub || "unknown"}) -- см. journalctl -u ${serviceName}`;
          }
          return null;
        },
        rollback: async () => {
          await execCommand(server, `sudo systemctl stop ${serviceName} 2>/dev/null || true`);
        },
      });

      let outcome;
      try {
        outcome = await runDeployPipeline(steps, (line) => setDeployLogs((prev) => [...prev, line]));
      } catch (err: any) {
        setIsDeploying(false);
        setDeployLogs((prev) => [...prev, `[ERROR] Ошибка при подготовке деплоя: ${err?.message || "неизвестная ошибка"}`]);
        toast.error(`Деплой не удался: ${err?.message || "неизвестная ошибка"}`);
        return;
      }

      if (!outcome.success) {
        setIsDeploying(false);
        setDeployLogs((prev) => [...prev, `[FAILED] Деплой прерван на шаге "${outcome.failedStep}". Изменения на сервере откачены.`]);
        toast.error(`Деплой не удался на шаге "${outcome.failedStep}"`, (outcome.failureReason || "См. лог ниже").slice(0, 300));
        return;
      }

      setDeployLogs((prev) => [...prev, `[SUCCESS] Служба ${serviceName} активна и запущена на сервере.`]);

      if (isRealityProtocol && realityServerPub) {
        link = link.replace(/pbk=[^&#]+/, `pbk=${realityServerPub}`);
        // Persist the REAL derived public key -- was previously left as a Math.random
        // placeholder forever (never mattered for THIS client's link since the regex above
        // patches it directly into `link`, but it's needed as the source of truth for
        // later add-client operations, so fix it at the root).
        newPub = realityServerPub;
      }

      if (isAwg) {
        if (awgClientPriv && awgServerPub) {
          link = buildAwgClientConf(awgClientPriv, awgServerPub);
          // Same fix as above: the server's real WG public key, needed by add-client later
          // to build every subsequent peer's .conf with the correct [Peer] PublicKey.
          newPub = awgServerPub;
        } else {
          setIsDeploying(false);
          setDeployLogs((prev) => [...prev, `[ERROR] Не удалось получить ключи AmneziaWG с сервера -- служба поднялась, но конфиг клиента невозможно собрать корректно.`]);
          toast.error(`Деплой не удался: сервер не вернул сгенерированные ключи AmneziaWG.`);
          return;
        }
      }
    }

    const firstClient: VPNClientEntry = {
      id: "c-" + Date.now(),
      name: deployClientName,
      uuid: newUuid,
      clientLink: link,
      createdAt: new Date().toISOString(),
    };

    const newInst: InstalledVPNService = {
      id: "vpn-inst-" + Date.now(),
      protocolId: selectedDeployProtocol.id,
      name: selectedDeployProtocol.name,
      status: "active",
      port: deployPort,
      sni: deploySni,
      uuid: newUuid,
      publicKey: newPub,
      clientLink: link,
      clients: [firstClient],
      uptime: "Только что запущен",
      trafficRxGb: 0.1,
      trafficTxGb: 0.2,
      activeClientsCount: 1,
      installedAt: new Date().toISOString().split("T")[0],
      version: selectedDeployProtocol.version,
      // Real path this protocol's binary actually reads (was previously hardcoded/wrong --
      // see getProtocolRuntimeInfo).
      configPath: getProtocolRuntimeInfo(selectedDeployProtocol.id).primaryConfigPath,
    };

    setInstalledServices((prev) => [newInst, ...prev]);
    setDeploySuccessService(newInst);
    setIsDeploying(false);
  };

  // Toggle service status.
  // Bugs fixed here (found while auditing Start/Stop on user's request):
  // 1. AnyTLS used the wrong systemd unit name ("anytls" -- doesn't exist; the real
  //    deployed unit is "sing-box", per handleStartDeploy's serviceName). Every Start/Stop
  //    click on an AnyTLS service was silently failing on the server the whole time.
  // 2. There was NO verification at all -- not even an exit-code check, let alone the
  //    project's standing rule to confirm via real `systemctl is-active`. The UI just
  //    optimistically flipped status regardless of whether the SSH command actually
  //    succeeded, so a failed stop/start (wrong unit name, permissions, service crash-
  //    looping right back up, etc.) still showed as if it worked.
  // Now: after the action, we query the unit's REAL state and only reflect that in the
  // UI, with toast feedback either way -- consistent with the rest of the app.
  const handleToggleService = async (id: string) => {
    const srv = installedServices.find((s) => s.id === id);
    if (!srv) return;

    const wantActive = srv.status !== "active";
    const action = wantActive ? "start" : "stop";

    let systemdService = srv.protocolId;
    if (srv.protocolId.includes("xray") || srv.protocolId === "shadowsocks-2022") {
      systemdService = "xray";
    } else if (srv.protocolId === "anytls") {
      systemdService = "sing-box";
    } else if (srv.protocolId === "amnezia-wg") {
      systemdService = "awg-quick@awg0";
    }

    if (server.isDemo) {
      // Demo server has no real backing service -- keep the existing optimistic-toggle
      // behavior so the showcase still works, just with matching toast feedback.
      setInstalledServices((prev) => prev.map((s) => (s.id === id ? { ...s, status: wantActive ? "active" : "inactive" } : s)));
      toast.success(wantActive ? "Служба запущена" : "Служба остановлена", `${srv.name} (демо-режим)`);
      return;
    }

    try {
      const result = await execCommand(
        server,
        `sudo systemctl ${action} ${systemdService} 2>&1; echo "===STATE:$(systemctl is-active ${systemdService} 2>/dev/null || echo inactive)"`
      );
      const stateMatch = (result.stdout || "").match(/===STATE:(\w+)/);
      const realActive = stateMatch?.[1] === "active";
      const succeeded = realActive === wantActive;

      setInstalledServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: realActive ? "active" : "inactive" } : s))
      );

      if (succeeded) {
        toast.success(
          wantActive ? "Служба запущена" : "Служба остановлена",
          `${srv.name} — подтверждено через systemctl is-active`
        );
      } else {
        toast.error(
          `Не удалось ${wantActive ? "запустить" : "остановить"} службу`,
          `${srv.name}: реальный статус — ${stateMatch?.[1] || "неизвестен"}. ${(result.stdout || "").slice(-250)}`
        );
      }
    } catch (err: any) {
      console.error("Failed to toggle service", err);
      toast.error(`Ошибка переключения службы ${srv.name}`, err?.message || "Не удалось выполнить команду");
    }
  };

  // Copy helper
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ============================================================================================
  // MULTI-CLIENT MANAGEMENT (add / remove a client on an already-deployed service)
  //
  // Design principle driving every step below: NEVER trust locally-remembered deploy-time
  // settings for what's actually running -- always fetch and parse the REAL live config off
  // the server first, mutate only the client list inside it, validate the result BEFORE it
  // ever touches the live service, and roll back on any failure. This mirrors the same
  // verified step-by-step approach already used for the initial deploy pipeline.
  // ============================================================================================

  const openAddClientModal = (service: InstalledVPNService) => {
    setAddClientResult(null);
    setClientMutationLogs([]);
    setNewClientName(`Client-Device-${(service.clients?.length || 0) + 1}`);
    setAddClientTarget(service);
  };

  // Derives a client link purely from the REAL live server config (not from possibly-stale
  // local component state) -- so an added client's link always matches what's actually
  // running, even if the service's transport/security settings were tweaked by hand outside
  // the panel after the original deploy.
  const buildLinkFromLiveXrayConfig = (service: InstalledVPNService, cfg: any, uuid: string, name: string): string => {
    const hostName = server.isDemo ? "demo.server.com" : server.host;
    const safeHost = hostName.includes(":") ? `[${hostName}]` : hostName;
    const encName = (s: string) => encodeURIComponent(s);
    const inbound = cfg.inbounds?.[0] || {};
    const protoName = inbound.protocol;
    const stream = inbound.streamSettings || {};
    const transport = stream.network || "tcp";
    const security = stream.security || "none";

    if (service.protocolId === "anytls") {
      const sni = stream?.tlsSettings?.server_name || service.sni;
      return `anytls://${uuid}@${safeHost}:${service.port}?sni=${sni}&insecure=1#${encName(`${server.name}-AnyTLS-sing-box`)}`;
    }
    if (protoName === "trojan") {
      let query = `type=${transport}&security=${security}&sni=${stream?.tlsSettings?.serverName || service.sni}`;
      if (transport === "grpc") query += `&serviceName=${stream?.grpcSettings?.serviceName || ""}`;
      if (transport === "ws") {
        query += `&path=${encodeURIComponent(stream?.wsSettings?.path || "/ws")}`;
        const wsHost = stream?.wsSettings?.headers?.Host;
        if (wsHost) query += `&host=${encodeURIComponent(wsHost)}`;
      }
      return `trojan://${uuid}@${safeHost}:${service.port}?${query}#${encName(`${server.name}-${name}`)}`;
    }
    if (protoName === "vmess") {
      return `vmess://${btoa(JSON.stringify({
        v: "2", ps: `${server.name}-${name}`, add: safeHost, port: service.port, id: uuid, aid: 0,
        net: transport, type: "none",
        host: stream?.wsSettings?.headers?.Host || service.sni,
        path: stream?.wsSettings?.path || "/ws",
        tls: security === "none" ? "" : security,
        sni: service.sni,
      }))}`;
    }
    // vless (reality or tls)
    let query = `type=${transport}&security=${security}&sni=${service.sni}`;
    const fp = stream?.realitySettings?.fingerprint;
    if (fp) query += `&fp=${fp}`;
    if (security === "reality") {
      query += `&pbk=${service.publicKey || ""}&sid=${stream?.realitySettings?.shortIds?.[0] || ""}`;
    }
    const flow = inbound.settings?.clients?.[0]?.flow;
    if (flow) query += `&flow=${flow}`;
    if (transport === "grpc") query += `&serviceName=${stream?.grpcSettings?.serviceName || ""}`;
    else if (transport === "ws") {
      query += `&path=${encodeURIComponent(stream?.wsSettings?.path || "/ws")}`;
      const wsHost = stream?.wsSettings?.headers?.Host;
      if (wsHost) query += `&host=${encodeURIComponent(wsHost)}`;
    }
    return `vless://${uuid}@${safeHost}:${service.port}?${query}#${encName(`${server.name}-${name}`)}`;
  };

  // Adds or removes a client on a JSON-configured protocol (Xray family or AnyTLS/sing-box).
  const mutateJsonProtocolClients = async (
    service: InstalledVPNService,
    mode: "add" | "remove",
    opts: { newClientName?: string; removeClient?: VPNClientEntry }
  ): Promise<VPNClientEntry | null> => {
    const runtime = getProtocolRuntimeInfo(service.protocolId);
    const isAnytls = service.protocolId === "anytls";

    let resolvedPath = "";
    let parsedConfig: any = null;
    let tmpConfigPath = "";
    let backupPathUsed = "";
    let serviceRestartAttempted = false;
    let resultEntry: VPNClientEntry | null = null;

    const steps: DeployStep[] = [];

    steps.push({
      key: "preflight",
      label: "Проверка текущего состояния службы",
      run: () => execCommand(server, `systemctl is-active ${runtime.serviceName} 2>/dev/null || echo inactive`),
      verify: (res) => {
        const state = res.stdout.trim().split("\n")[0]?.trim();
        if (state !== "active") {
          return `Служба ${runtime.serviceName} сейчас не активна (${state || "unknown"}) -- изменять конфиг неработающей службы небезопасно. Сначала запустите/почините её.`;
        }
        return null;
      },
    });

    steps.push({
      key: "fetch_config",
      label: "Чтение текущего конфига с сервера",
      run: () => execCommand(server, `
        if [ -f "${runtime.primaryConfigPath}" ]; then CONF="${runtime.primaryConfigPath}";
        elif [ -f "${runtime.secondaryConfigPath}" ]; then CONF="${runtime.secondaryConfigPath}";
        else echo "CONF_NOT_FOUND"; exit 0; fi
        echo "CONF_PATH_USED:$CONF"
        echo "===CONF_START==="
        cat "$CONF"
        echo "===CONF_END==="
      `),
      verify: (res) => {
        if (res.stdout.includes("CONF_NOT_FOUND")) {
          return `Файл конфигурации не найден ни по одному из ожидаемых путей (${runtime.primaryConfigPath}${runtime.secondaryConfigPath ? " / " + runtime.secondaryConfigPath : ""}).`;
        }
        resolvedPath = res.stdout.match(/CONF_PATH_USED:(\S+)/)?.[1] || runtime.primaryConfigPath;
        const body = res.stdout.split("===CONF_START===")[1]?.split("===CONF_END===")[0];
        if (!body || !body.trim()) return "Не удалось прочитать содержимое конфигурационного файла.";
        try {
          parsedConfig = JSON.parse(body.trim());
        } catch (e: any) {
          return `Конфиг на сервере повреждён или не является валидным JSON (возможно, отредактирован вручную) -- отменяю, чтобы не рисковать: ${e?.message || ""}`;
        }
        const clientsArr = isAnytls ? parsedConfig?.inbounds?.[0]?.users : parsedConfig?.inbounds?.[0]?.settings?.clients;
        if (!Array.isArray(clientsArr)) return "Структура конфига не соответствует ожидаемой (не найден список клиентов) -- отменяю, чтобы не повредить рабочий конфиг.";
        return null;
      },
    });

    steps.push({
      key: "mutate_validate",
      label: mode === "add" ? "Добавление клиента и валидация нового конфига" : "Удаление клиента и валидация нового конфига",
      run: async () => {
        const clientsArr: any[] = isAnytls ? parsedConfig.inbounds[0].users : parsedConfig.inbounds[0].settings.clients;

        if (mode === "add") {
          const newUuid = window.crypto.randomUUID();
          const name = (opts.newClientName || `Client-${clientsArr.length + 1}`).trim();
          if (isAnytls) {
            clientsArr.push({ name, password: newUuid });
          } else {
            const protoName = parsedConfig.inbounds[0].protocol;
            if (protoName === "trojan") clientsArr.push({ password: newUuid, email: `${name}@xray` });
            else if (protoName === "vmess") clientsArr.push({ id: newUuid, alterId: 0, email: `${name}@xray` });
            else clientsArr.push({ id: newUuid, flow: clientsArr[0]?.flow || undefined, email: `${name}@xray` });
          }
          resultEntry = {
            id: "c-" + Date.now(),
            name,
            uuid: newUuid,
            clientLink: buildLinkFromLiveXrayConfig(service, parsedConfig, newUuid, name),
            createdAt: new Date().toISOString(),
          };
        } else {
          if (clientsArr.length <= 1) {
            throw new Error("Нельзя удалить последнего клиента -- остановите или удалите сервис целиком, если он больше не нужен.");
          }
          const target = opts.removeClient!;
          const idx = clientsArr.findIndex((c) => c.id === target.uuid || c.password === target.uuid || c.email === `${target.name}@xray`);
          if (idx === -1) {
            throw new Error("Указанный клиент не найден в текущем конфиге на сервере (возможно, уже удалён вручную).");
          }
          clientsArr.splice(idx, 1);
        }

        const newConfigText = JSON.stringify(parsedConfig, null, 2);
        tmpConfigPath = `${resolvedPath}.new-${Date.now()}`;
        const marker = `EOF_CONF_${Date.now()}`;
        const validateCmd = isAnytls
          ? `SB_BIN=$(command -v sing-box || echo /usr/local/bin/sing-box); $SB_BIN check -c "${tmpConfigPath}" 2>&1; echo "VALIDATE_CODE:$?"`
          : `XRAY_BIN=$(command -v xray || echo /usr/local/bin/xray); $XRAY_BIN run -test -config "${tmpConfigPath}" 2>&1; echo "VALIDATE_CODE:$?"`;
        return execCommand(server, `
cat > "${tmpConfigPath}" <<'${marker}'
${newConfigText}
${marker}
${validateCmd}
sudo rm -f "${tmpConfigPath}.leftover" 2>/dev/null || true
        `);
      },
      verify: (res) => {
        if (!/VALIDATE_CODE:0/.test(res.stdout)) {
          return `Новый конфиг НЕ прошёл валидацию ${isAnytls ? "sing-box check" : "xray run -test"} -- рабочий конфиг НЕ тронут. Вывод: ${res.stdout.slice(-400)}`;
        }
        return null;
      },
      rollback: async () => {
        if (tmpConfigPath) await execCommand(server, `sudo rm -f "${tmpConfigPath}" 2>/dev/null || true`);
      },
    });

    steps.push({
      key: "apply",
      label: "Применение конфига и перезапуск службы",
      run: async () => {
        const backupPath = `${resolvedPath}.bak-${Date.now()}`;
        serviceRestartAttempted = true;
        return execCommand(server, `
          sudo cp "${resolvedPath}" "${backupPath}"
          sudo cp "${tmpConfigPath}" "${resolvedPath}"
          sudo rm -f "${tmpConfigPath}"
          sudo systemctl restart ${runtime.serviceName}
          sleep 2
          echo "ACTIVE_STATE:$(systemctl show ${runtime.serviceName} --property=ActiveState --value 2>/dev/null)"
          echo "BACKUP_PATH:${backupPath}"
        `);
      },
      verify: (res) => {
        backupPathUsed = res.stdout.match(/BACKUP_PATH:(\S+)/)?.[1] || "";
        const active = res.stdout.match(/ACTIVE_STATE:(\w+)/)?.[1];
        if (active !== "active") {
          return `Служба ${runtime.serviceName} не поднялась после изменения конфига (${active || "unknown"}) -- откатываю на предыдущую рабочую версию.`;
        }
        return null;
      },
      rollback: async () => {
        if (backupPathUsed) {
          await execCommand(server, `sudo cp "${backupPathUsed}" "${resolvedPath}" 2>/dev/null; sudo systemctl restart ${runtime.serviceName} 2>/dev/null || true`);
        } else if (serviceRestartAttempted) {
          await execCommand(server, `sudo systemctl restart ${runtime.serviceName} 2>/dev/null || true`);
        }
      },
    });

    const outcome = await runDeployPipeline(steps, (line) => setClientMutationLogs((prev) => [...prev, line]));
    if (!outcome.success) {
      throw new Error(outcome.failureReason || `Не удалось выполнить операцию на шаге "${outcome.failedStep}"`);
    }
    return resultEntry;
  };

  // Adds or removes a client (peer) on AmneziaWG -- INI format, real X25519 keys generated
  // server-side, IP allocation computed from the actually-used addresses in the live conf.
  const mutateAwgClients = async (
    service: InstalledVPNService,
    mode: "add" | "remove",
    opts: { removeClient?: VPNClientEntry }
  ): Promise<VPNClientEntry | null> => {
    const runtime = getProtocolRuntimeInfo("amnezia-wg");
    let resolvedPaths: string[] = [];
    let confText = "";
    let interfaceParams: Record<string, string> = {};
    let usedIps: number[] = [];
    let backupSuffix = "";
    let serviceRestartAttempted = false;
    let resultEntry: VPNClientEntry | null = null;

    const steps: DeployStep[] = [];

    steps.push({
      key: "preflight",
      label: "Проверка текущего состояния службы",
      run: () => execCommand(server, `systemctl is-active ${runtime.serviceName} 2>/dev/null || echo inactive`),
      verify: (res) => {
        const state = res.stdout.trim().split("\n")[0]?.trim();
        if (state !== "active") return `Служба ${runtime.serviceName} сейчас не активна (${state || "unknown"}) -- изменять конфиг небезопасно.`;
        return null;
      },
    });

    steps.push({
      key: "fetch_config",
      label: "Чтение текущего конфига AmneziaWG",
      run: () => execCommand(server, `
        for P in "${runtime.primaryConfigPath}" "${runtime.secondaryConfigPath}"; do
          if [ -f "$P" ]; then echo "CONF_PATH_FOUND:$P"; fi
        done
        CONF="${runtime.primaryConfigPath}"
        [ -f "$CONF" ] || CONF="${runtime.secondaryConfigPath}"
        if [ ! -f "$CONF" ]; then echo "CONF_NOT_FOUND"; exit 0; fi
        echo "===CONF_START==="
        cat "$CONF"
        echo "===CONF_END==="
      `),
      verify: (res) => {
        if (res.stdout.includes("CONF_NOT_FOUND")) return "Файл конфигурации AmneziaWG не найден ни по одному из ожидаемых путей.";
        resolvedPaths = [...res.stdout.matchAll(/CONF_PATH_FOUND:(\S+)/g)].map((m) => m[1]);
        if (resolvedPaths.length === 0) resolvedPaths = [runtime.primaryConfigPath];
        const body = res.stdout.split("===CONF_START===")[1]?.split("===CONF_END===")[0];
        if (!body || !body.includes("[Interface]")) return "Не удалось прочитать/распознать конфиг AmneziaWG (нет секции [Interface]).";
        confText = body.trim();
        const ifaceBlock = confText.split(/\n\[Peer\]/)[0];
        for (const key of ["Jc", "Jmin", "Jmax", "S1", "S2", "S3", "S4", "H1", "H2", "H3", "H4"]) {
          const m = ifaceBlock.match(new RegExp(`${key}\\s*=\\s*(\\S+)`));
          if (m) interfaceParams[key] = m[1];
        }
        usedIps = [...confText.matchAll(/AllowedIPs\s*=\s*10\.29\.29\.(\d+)\/32/g)].map((m) => parseInt(m[1], 10));
        const peerCount = (confText.match(/\[Peer\]/g) || []).length;
        if (peerCount === 0) return "В конфиге не найдено ни одного [Peer] -- структура не соответствует ожидаемой, отменяю.";
        return null;
      },
    });

    let newClientPriv = "";
    let newClientPub = "";
    let newIp = 0;

    steps.push({
      key: "mutate",
      label: mode === "add" ? "Генерация ключей нового клиента и обновление конфига" : "Удаление пира из конфига",
      run: async () => {
        let newConfText = "";
        if (mode === "add") {
          newIp = 2;
          while (usedIps.includes(newIp) && newIp < 254) newIp++;
          if (newIp >= 254) throw new Error("Пул IP-адресов AmneziaWG исчерпан (лимит ~250 клиентов на интерфейс).");
          const keyRes = await execCommand(server, `
            AWG_BIN=$(command -v awg || command -v wg)
            CPRIV=$($AWG_BIN genkey)
            CPUB=$(echo "$CPRIV" | $AWG_BIN pubkey)
            echo "CLIENT_PRIV:$CPRIV"
            echo "CLIENT_PUB:$CPUB"
          `);
          newClientPriv = keyRes.stdout.match(/CLIENT_PRIV:(\S+)/)?.[1] || "";
          newClientPub = keyRes.stdout.match(/CLIENT_PUB:(\S+)/)?.[1] || "";
          if (!newClientPriv || !newClientPub) throw new Error("Не удалось сгенерировать ключевую пару клиента на сервере (awg/wg genkey недоступен?).");
          newConfText = `${confText}\n\n[Peer]\nPublicKey = ${newClientPub}\nAllowedIPs = 10.29.29.${newIp}/32\n`;
        } else {
          const target = opts.removeClient!;
          const peerBlocks = confText.split(/\n(?=\[Peer\])/);
          const idx = peerBlocks.findIndex((b) => b.includes(`PublicKey = ${target.uuid}`));
          if (idx === -1) throw new Error("Указанный клиент (peer) не найден в текущем конфиге на сервере.");
          const peerBlockCount = peerBlocks.filter((b) => b.trim().startsWith("[Peer]")).length;
          if (peerBlockCount <= 1) throw new Error("Нельзя удалить последнего клиента -- остановите или удалите сервис целиком.");
          peerBlocks.splice(idx, 1);
          newConfText = peerBlocks.join("\n");
        }

        const marker = `EOF_AWG_${Date.now()}`;
        const backupTs = Date.now();
        backupSuffix = `.bak-${backupTs}`;
        serviceRestartAttempted = true;
        const writeCmds = resolvedPaths
          .map(
            (p) => `
sudo cp "${p}" "${p}${backupSuffix}" 2>/dev/null || true
cat > /tmp/awg_new_conf_${backupTs}.conf <<'${marker}'
${newConfText}
${marker}
sudo cp /tmp/awg_new_conf_${backupTs}.conf "${p}"
`
          )
          .join("\n");
        return execCommand(server, `
          ${writeCmds}
          rm -f /tmp/awg_new_conf_${backupTs}.conf
          sudo systemctl restart ${runtime.serviceName}
          sleep 2
          echo "ACTIVE_STATE:$(systemctl show ${runtime.serviceName} --property=ActiveState --value 2>/dev/null)"
          AWG_BIN=$(command -v awg || command -v wg)
          echo "===PEERS==="
          sudo $AWG_BIN show awg0 allowed-ips 2>/dev/null
          echo "===END_PEERS==="
        `);
      },
      verify: (res) => {
        const active = res.stdout.match(/ACTIVE_STATE:(\w+)/)?.[1];
        if (active !== "active") return `Служба ${runtime.serviceName} не поднялась после изменения конфига (${active || "unknown"}) -- откатываю.`;
        const peersOutput = res.stdout.split("===PEERS===")[1]?.split("===END_PEERS===")[0] || "";
        if (mode === "add") {
          if (!peersOutput.includes(newClientPub)) {
            return `Служба поднялась, но новый пир не обнаружен в реальном выводе '${"awg/wg show"}' -- откатываю на всякий случай.`;
          }
          resultEntry = {
            id: "c-" + Date.now(),
            name: "", // filled in by caller (name isn't stored server-side for WG peers)
            uuid: newClientPub,
            clientLink: buildAwgClientConfShared({
              clientPriv: newClientPriv,
              serverPub: service.publicKey || "",
              clientAddress: `10.29.29.${newIp}/32`,
              endpointHost: server.isDemo ? "demo.server.com" : server.host,
              endpointPort: service.port,
              awgVersion: (interfaceParams.S3 !== undefined ? "2.0" : "1.0"),
              awgJc: interfaceParams.Jc ?? 4, awgJmin: interfaceParams.Jmin ?? 40, awgJmax: interfaceParams.Jmax ?? 70,
              awgS1: interfaceParams.S1 ?? 15, awgS2: interfaceParams.S2 ?? 20,
              awgS3: interfaceParams.S3 ?? 0, awgS4: interfaceParams.S4 ?? 0,
              awgH1: interfaceParams.H1 ?? 1, awgH2: interfaceParams.H2 ?? 2, awgH3: interfaceParams.H3 ?? 3, awgH4: interfaceParams.H4 ?? 4,
            }),
            createdAt: new Date().toISOString(),
          };
        } else {
          if (peersOutput.includes(opts.removeClient!.uuid)) {
            return "Служба поднялась, но удаляемый пир всё ещё виден в реальном выводе 'awg/wg show' -- откатываю на всякий случай.";
          }
        }
        return null;
      },
      rollback: async () => {
        if (!backupSuffix) return;
        const restoreCmds = resolvedPaths.map((p) => `sudo cp "${p}${backupSuffix}" "${p}" 2>/dev/null || true`).join("\n");
        await execCommand(server, `${restoreCmds}\nsudo systemctl restart ${runtime.serviceName} 2>/dev/null || true`);
      },
    });

    const outcome = await runDeployPipeline(steps, (line) => setClientMutationLogs((prev) => [...prev, line]));
    if (!outcome.success) {
      throw new Error(outcome.failureReason || `Не удалось выполнить операцию на шаге "${outcome.failedStep}"`);
    }
    return resultEntry;
  };

  const handleConfirmAddClient = async () => {
    const service = addClientTarget;
    if (!service) return;
    const name = newClientName.trim() || `Client-${(service.clients?.length || 0) + 1}`;

    setIsMutatingClients(true);
    setClientMutationLogs([`[CHECK] Подключение к серверу ${server.username}@${server.host} для добавления клиента "${name}"...`]);

    try {
      if (server.isDemo) {
        await new Promise((r) => setTimeout(r, 900));
        const fakeUuid = window.crypto.randomUUID();
        const entry: VPNClientEntry = {
          id: "c-" + Date.now(),
          name,
          uuid: fakeUuid,
          clientLink: service.protocolId === "amnezia-wg"
            ? `[Interface]\nPrivateKey = (демо, симуляция)\nAddress = 10.29.29.${(service.clients?.length || 0) + 2}/32\n\n[Peer]\nPublicKey = ${service.publicKey || "demo_pub"}\nEndpoint = demo.server.com:${service.port}\nAllowedIPs = 0.0.0.0/0, ::/0`
            : `${service.clientLink.split("#")[0]}#${encodeURIComponent(`${server.name}-${name}`)}`,
          createdAt: new Date().toISOString(),
        };
        setClientMutationLogs((prev) => [...prev, `[SUCCESS] Демо-клиент "${name}" добавлен (симуляция, реальные команды не выполнялись).`]);
        setInstalledServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, clients: [...(s.clients || []), entry], activeClientsCount: (s.clients?.length || 0) + 1 } : s)));
        setAddClientResult(entry);
        setIsMutatingClients(false);
        return;
      }

      let entry: VPNClientEntry | null;
      if (service.protocolId === "amnezia-wg") {
        entry = await mutateAwgClients(service, "add", {});
        if (entry) entry.name = name;
      } else {
        entry = await mutateJsonProtocolClients(service, "add", { newClientName: name });
      }

      if (!entry) throw new Error("Операция завершилась без результата.");

      setClientMutationLogs((prev) => [...prev, `[SUCCESS] Клиент "${name}" добавлен, служба перезапущена и подтверждена активной.`]);
      setInstalledServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, clients: [...(s.clients || []), entry as VPNClientEntry], activeClientsCount: (s.clients?.length || 0) + 1 } : s))
      );
      setAddClientResult(entry);
      toast.success(`Клиент "${name}" успешно добавлен`);
    } catch (err: any) {
      setClientMutationLogs((prev) => [...prev, `[FAILED] ${err?.message || "неизвестная ошибка"}`]);
      toast.error(`Не удалось добавить клиента`, (err?.message || "См. лог").slice(0, 300));
    } finally {
      setIsMutatingClients(false);
    }
  };

  const handleConfirmRemoveClient = async () => {
    if (!removingClient) return;
    const { service, client } = removingClient;
    setIsMutatingClients(true);
    setClientMutationLogs([`[CHECK] Подключение к серверу для удаления клиента "${client.name}"...`]);

    try {
      if (server.isDemo) {
        await new Promise((r) => setTimeout(r, 700));
        setInstalledServices((prev) =>
          prev.map((s) => (s.id === service.id ? { ...s, clients: (s.clients || []).filter((c) => c.id !== client.id), activeClientsCount: Math.max(1, (s.clients?.length || 1) - 1) } : s))
        );
        setClientMutationLogs((prev) => [...prev, `[SUCCESS] Демо-клиент "${client.name}" удалён (симуляция).`]);
        setRemovingClient(null);
        setIsMutatingClients(false);
        return;
      }

      if (service.protocolId === "amnezia-wg") {
        await mutateAwgClients(service, "remove", { removeClient: client });
      } else {
        await mutateJsonProtocolClients(service, "remove", { removeClient: client });
      }

      setInstalledServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, clients: (s.clients || []).filter((c) => c.id !== client.id), activeClientsCount: Math.max(1, (s.clients?.length || 1) - 1) } : s))
      );
      toast.success(`Клиент "${client.name}" удалён`);
      setRemovingClient(null);
    } catch (err: any) {
      setClientMutationLogs((prev) => [...prev, `[FAILED] ${err?.message || "неизвестная ошибка"}`]);
      toast.error(`Не удалось удалить клиента`, (err?.message || "См. лог").slice(0, 300));
    } finally {
      setIsMutatingClients(false);
    }
  };

  // AI Assistant Query Handler
  const handleSendAiPrompt = async (customPrompt?: string) => {
    const promptToSend = customPrompt || aiPrompt;
    if (!promptToSend.trim()) return;

    const userMsg: VPNAssistantMessage = {
      id: "user-" + Date.now(),
      sender: "user",
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setAiPrompt("");
    setAiLoading(true);

    try {
      const res = await authFetch("/api/ai/vpn-expert", {
        method: "POST",
        body: JSON.stringify({
          prompt: promptToSend,
          serverInfo: server,
          currentVpns: installedServices,
        }),
      });

      const data = await res.json();
      const aiReply: VPNAssistantMessage = {
        id: "ai-" + Date.now(),
        sender: "ai",
        text: data.reply || "Диагностика выполнена успешно.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        severity: data.severity || "INFO",
        suggestedFixes: data.suggestedFixes || [],
      };

      setAiMessages((prev) => [...prev, aiReply]);
    } catch (err: any) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "ai",
          text: "⚠️ Произошла ошибка связи с ИИ Консультантом. Проверьте параметры подключения.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          severity: "WARNING",
          suggestedFixes: ["sudo systemctl restart xray", "sudo ufw allow 443/tcp"],
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Execute AI Suggested Fix on Server via SSH
  const handleExecuteFix = async (cmd: string) => {
    const res = await execCommand(server, cmd);
    if (res.code === 0) {
      toast.success("Команда выполнена", (res.stdout || "Успешно, без вывода").slice(0, 300));
    } else {
      toast.error("Ошибка выполнения", (res.stderr || "Команда завершилась с ошибкой").slice(0, 300));
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header & Active Status Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-[#0c1427] to-slate-950 border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
        {/* Glow ambient meshes */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/30 text-violet-400 shadow-lg shadow-violet-500/10 shrink-0">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-2xl font-black text-white tracking-tight">
                    ВПН Менеджер
                  </h1>
                  <span className="text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Anti-DPI Node
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Управление протоколами VLESS, AnyTLS, AmneziaWG и автоматическая AI-диагностика
                </p>
              </div>
            </div>
          </div>

          {/* Quick Status Bar & AI Trigger */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl px-3 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2.5 shrink-0 shadow-inner">
              <div className="relative flex items-center justify-center">
                <Radio className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-400" />
              </div>
              <div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Активно на сервере</div>
                <div className="text-[11px] sm:text-xs font-bold text-violet-300 font-mono">
                  {installedServices.filter((s) => s.status === "active").length} / {installedServices.length} нод
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("ai-expert")}
              className="bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/40 rounded-2xl px-3 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2 text-xs font-bold text-purple-200 transition shrink-0 active:scale-95 shadow-md shadow-purple-900/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-bounce" />
              <span className="text-[11px] sm:text-xs">ИИ Помощник</span>
            </button>
          </div>
        </div>

        {/* Mobile-optimized Segmented Navigation Tabs */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="bg-slate-950/80 p-1.5 rounded-2xl grid grid-cols-3 gap-1 border border-slate-800/90 shadow-inner">
            <button
              onClick={() => setActiveTab("catalog")}
              className={`py-2.5 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 ${
                activeTab === "catalog"
                  ? "bg-violet-500 text-slate-950 shadow-md shadow-violet-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Каталог Протоколов</span>
              <span className="sm:hidden text-[11px]">Каталог</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono hidden xs:inline-block ${activeTab === "catalog" ? "bg-slate-950/25 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                {VPN_PROTOCOLS.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("installed")}
              className={`py-2.5 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 ${
                activeTab === "installed"
                  ? "bg-slate-800 text-white shadow-md border-b border-slate-700"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Server className={`w-4 h-4 shrink-0 ${activeTab === "installed" ? "text-violet-400" : ""}`} />
              <span className="hidden sm:inline">Установленные ВПН</span>
              <span className="sm:hidden text-[11px]">Мои ВПН</span>
              {installedServices.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono ${activeTab === "installed" ? "bg-violet-500/20 text-violet-400" : "bg-slate-800 text-slate-400"}`}>
                  {installedServices.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("ai-expert")}
              className={`py-2.5 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 ${
                activeTab === "ai-expert"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-purple-300 hover:bg-slate-800/60"
              }`}
            >
              <Bot className={`w-4 h-4 shrink-0 ${activeTab === "ai-expert" ? "text-purple-200" : "text-purple-400"}`} />
              <span className="hidden sm:inline">Мастер ВПН (ИИ)</span>
              <span className="sm:hidden text-[11px]">ИИ Мастер</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: PROTOCOLS CATALOG */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2 tracking-wide uppercase">
              <Zap className="w-4 h-4 text-violet-400" />
              <span>Каталог протоколов авто-деплоя</span>
            </h2>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">1-Click установка</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VPN_PROTOCOLS.map((protocol) => (
              <div
                key={protocol.id}
                className={`group relative bg-slate-900/60 backdrop-blur-xl border rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between overflow-hidden shadow-xl ${
                  protocol.isPopular
                    ? "border-violet-500/40 hover:border-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.12)]"
                    : "border-slate-800/80 hover:border-slate-700 shadow-slate-950/50"
                }`}
              >
                <div className={`absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br ${protocol.gradient} rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition duration-500 pointer-events-none`} />

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[9px] sm:text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-xl border ${
                      protocol.isPopular 
                        ? "bg-violet-500/10 text-violet-400 border-violet-500/30" 
                        : "bg-slate-800/60 text-slate-300 border-slate-700/60"
                    }`}>
                      {protocol.badge}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800/80 px-2 py-0.5 rounded-lg font-mono">
                      {protocol.version}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition">
                      {protocol.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {protocol.description}
                    </p>
                  </div>

                  {/* Features list */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-800/60">
                    {protocol.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recommended client apps */}
                  <div className="pt-2">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Клиенты:</div>
                    <div className="flex flex-wrap gap-1">
                      {protocol.recommendedApps.map((app, i) => (
                        <span key={i} className="text-[9px] font-mono bg-slate-950/80 text-slate-400 border border-slate-800/80 px-1.5 py-0.5 rounded-md">
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer specs & deploy trigger */}
                <div className="pt-4 mt-4 border-t border-slate-800/60 space-y-3 relative z-10">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1"><Server className="w-3 h-3" /> Порт: <strong className="text-white bg-slate-950 px-1.5 py-0.5 rounded-md border border-slate-800">{protocol.defaultPort}</strong></span>
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-fuchsia-400" /> SNI: <strong className="text-slate-200 truncate max-w-[100px]">{protocol.defaultSni}</strong></span>
                  </div>

                  {/* L4 transport badge -- real, verified against what the deploy pipeline actually
                      opens on the firewall + what the service listens on (not decorative): TCP-only
                      services silently drop UDP traffic (games/voice) and vice versa if a client
                      assumes the wrong one, so this is worth being explicit and visually distinct about. */}
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-lg border ${
                      protocol.transportLayer === "UDP"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : protocol.transportLayer === "TCP+UDP"
                        ? "bg-gradient-to-r from-sky-500/10 to-amber-500/10 text-sky-300 border-sky-500/30"
                        : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                    }`}>
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      {protocol.transportLayer}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {protocol.transportLayer === "UDP" && "чистый UDP-туннель"}
                      {protocol.transportLayer === "TCP+UDP" && "TCP управление + UDP relay (игры/голос)"}
                      {protocol.transportLayer === "TCP" && "поверх TCP (маскировка под HTTPS)"}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDeployProtocol(protocol);
                      setDeployPort(protocol.defaultPort);
                      setDeploySni(protocol.defaultSni);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-xs shadow-[0_4px_15px_rgba(139,92,246,0.25)] hover:shadow-[0_4px_25px_rgba(139,92,246,0.4)] transition-all active:scale-95"
                  >
                    <Rocket className="w-4 h-4" />
                    <span>Установить в 1 клик</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INSTALLED SERVICES MONITOR */}
      {activeTab === "installed" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="space-y-0.5">
              <h2 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2 uppercase tracking-wide">
                <Server className="w-4 h-4 text-violet-400" />
                <span>Активные ВПН службы</span>
              </h2>
              <p className="text-[11px] text-slate-400">Мониторинг и управление активными нодами на сервере</p>
            </div>
            <button
              onClick={() => {
                checkServerVpnStatus();
                refreshLiveVpnMetrics();
              }}
              className="group text-xs text-slate-400 hover:text-violet-300 flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900 border border-slate-800 hover:border-violet-500/30 rounded-xl transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
              <span className="hidden sm:inline">Синхронизировать</span>
            </button>
          </div>

          <div className="space-y-4">
            {installedServices.map((service) => (
              <div
                key={service.id}
                className="relative bg-slate-900/70 backdrop-blur-xl border border-slate-800 hover:border-slate-700/80 rounded-3xl p-4 sm:p-5 overflow-hidden shadow-xl transition group space-y-4"
              >
                {/* Subtle top indicator line */}
                <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent ${service.status === "active" ? "via-violet-500" : "via-rose-500"} to-transparent`} />

                {/* Main service header & control block */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-11 h-11 bg-slate-950 border border-slate-800 rounded-2xl shrink-0">
                      <ShieldCheck className={`w-5 h-5 ${service.status === "active" ? "text-violet-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]" : "text-slate-500"}`} />
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-slate-900 rounded-full ${service.status === "active" ? "bg-violet-500 animate-pulse" : "bg-rose-500"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">{service.name}</h3>
                        <span className="text-[9px] font-mono bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded-md">
                          {service.version}
                        </span>
                        {(() => {
                          const proto = VPN_PROTOCOLS.find((p) => p.id === service.protocolId);
                          if (!proto) return null;
                          return (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-md border ${
                              proto.transportLayer === "UDP"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : proto.transportLayer === "TCP+UDP"
                                ? "bg-gradient-to-r from-sky-500/10 to-amber-500/10 text-sky-300 border-sky-500/30"
                                : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            }`}>
                              <ArrowLeftRight className="w-2.5 h-2.5" />
                              {proto.transportLayer}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                        <span className="text-slate-300 font-bold">Порт: {service.port}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-purple-300 truncate max-w-[140px]">SNI: {service.sni}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleToggleService(service.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        service.status === "active"
                          ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                          : "bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20"
                      }`}
                    >
                      {service.status === "active" ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Остановить</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Запустить</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const primary = service.clients?.[0];
                        setQrModalService(primary ? { name: primary.name, uuid: primary.uuid, clientLink: primary.clientLink } : { name: service.name, uuid: service.uuid, clientLink: service.clientLink });
                      }}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-white text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <QrCode className="w-3.5 h-3.5 text-fuchsia-700" />
                      <span>Ключ / QR</span>
                    </button>
                  </div>
                </div>

                {/* Mobile-first 2x2 / 4-column metrics block */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3 shadow-inner">
                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Статус</div>
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${service.status === "active" ? "bg-violet-400 animate-pulse" : "bg-rose-500"}`} />
                      <span className={service.status === "active" ? "text-violet-400" : "text-rose-400"}>
                        {service.status === "active" ? "Активен" : "Остановлен"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                      Трафик
                      {!server.isDemo && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" title="Живые данные с сервера" />}
                    </div>
                    <div className="text-xs font-mono font-bold text-amber-300">
                      {(service.trafficRxGb + service.trafficTxGb).toFixed(2)} GB
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                      Подключ.
                      {!server.isDemo && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" title="Живые данные с сервера" />}
                    </div>
                    <div className="text-xs font-mono font-bold text-fuchsia-300">
                      {service.activeClientsCount} {service.protocolId === "amnezia-wg" ? "онлайн" : "актив."}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                      Аптайм
                      {!server.isDemo && <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" title="Живые данные с сервера" />}
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-300 truncate">
                      {service.uptime}
                    </div>
                  </div>
                </div>

                {/* Clients list (multi-client) */}
                <div className="pt-2 border-t border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      Конфиг: <span className="text-slate-300">{service.configPath}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {service.clients?.length || 0} клиент(ов)
                      </span>
                      {service.protocolId === "shadowsocks-2022" ? (
                        <span
                          title={SS2022_NO_MULTI_CLIENT_REASON}
                          className="text-[10px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-600 cursor-help"
                        >
                          Мультиклиент недоступен
                        </span>
                      ) : (
                        <button
                          onClick={() => openAddClientModal(service)}
                          className="px-2.5 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[10px] font-bold flex items-center gap-1 transition"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Добавить клиента</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {(service.clients || []).map((client) => (
                      <div key={client.id} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-white font-semibold truncate">{client.name}</div>
                          <div className="text-[9px] text-slate-500 font-mono truncate">{client.clientLink}</div>
                        </div>
                        <button
                          onClick={() => handleCopyText(client.clientLink)}
                          title="Копировать"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
                        >
                          {copiedLink ? <Check className="w-3 h-3 text-violet-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => setQrModalService({ name: client.name, uuid: client.uuid, clientLink: client.clientLink })}
                          title="QR-код"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
                        >
                          <QrCode className="w-3 h-3" />
                        </button>
                        {(service.clients?.length || 0) > 1 && (
                          <button
                            onClick={() => setRemovingClient({ service, client })}
                            title="Удалить клиента"
                            className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 transition shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AI VPN EXPERT ASSISTANT ("МАСТЕР В СФЕРЕ ВПН") */}
      {activeTab === "ai-expert" && (
        <div className="bg-slate-900/90 border border-purple-500/20 rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/40">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>МАСТЕР В СФЕРЕ ВПН</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-extrabold">
                    GEMINI AI POWERED
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Анализ логов, настройка правил обхода ТСПУ/DPI и устранение любых ошибок VPN
                </p>
              </div>
            </div>

            <button
              onClick={() => setAiMessages([aiMessages[0]])}
              className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700"
            >
              Очистить диалог
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Популярные вопросы и проверки:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSendAiPrompt("Почему у меня блокируется VLESS REALITY на провайдере МТС и как починить?")}
                className="text-xs bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/30 text-slate-300 hover:text-purple-200 px-3 py-1.5 rounded-xl transition text-left"
              >
                ⚡ Блокировка VLESS REALITY на мобильном интернете
              </button>
              <button
                onClick={() => handleSendAiPrompt("Какой маскировочный SNI домен лучше выбрать для Google и Apple CDN?")}
                className="text-xs bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/30 text-slate-300 hover:text-purple-200 px-3 py-1.5 rounded-xl transition text-left"
              >
                🌐 Как правильно подобрать SNI домен
              </button>
              <button
                onClick={() => handleSendAiPrompt("Проверь логи Xray и AnyTLS на сервере на предмет ошибок и сбоев.")}
                className="text-xs bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/30 text-slate-300 hover:text-purple-200 px-3 py-1.5 rounded-xl transition text-left"
              >
                🔍 Проанализировать логи Xray и AnyTLS на сервере
              </button>
              <button
                onClick={() => handleSendAiPrompt("Как включить TCP BBR ускорение ядра Linux для VPN?")}
                className="text-xs bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/30 text-slate-300 hover:text-purple-200 px-3 py-1.5 rounded-xl transition text-left"
              >
                🚀 Как включить ускорение TCP BBR
              </button>
            </div>
          </div>

          {/* Messages Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 max-h-[500px] overflow-y-auto space-y-4 scrollbar-thin">
            {aiMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "ai" && (
                  <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 space-y-3 text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-purple-600 text-white font-medium shadow-lg"
                      : "bg-slate-900 border border-slate-800 text-slate-200 shadow-xl"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {/* AI Suggested Fix Commands */}
                  {msg.suggestedFixes && msg.suggestedFixes.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Рекомендуемые bash-команды для выполнения на сервере:</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.suggestedFixes.map((cmd, i) => (
                          <div
                            key={i}
                            className="bg-slate-950 border border-slate-800/90 rounded-xl p-2.5 flex items-center justify-between gap-2 font-mono text-[11px] text-violet-300"
                          >
                            <span className="truncate">{cmd}</span>
                            <button
                              onClick={() => handleExecuteFix(cmd)}
                              className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-slate-950 font-extrabold text-[10px] rounded-lg transition shrink-0"
                            >
                              Выполнить SSH
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 text-right">{msg.timestamp}</div>
                </div>
              </div>
            ))}

            {aiLoading && (
              <div className="flex items-center gap-3 text-purple-300 text-xs font-semibold py-2">
                <div className="w-8 h-8 rounded-2xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center animate-spin">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <span>Мастер ВПН анализирует топологию и конфигурацию сервера...</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Задайте вопрос Мастеру ВПН (например: Как сменить порт в Xray?)..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendAiPrompt()}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={() => handleSendAiPrompt()}
              disabled={aiLoading}
              className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl transition flex items-center gap-2 shadow-lg shadow-purple-950/50 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Отправить</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: PROTOCOL DEPLOYMENT CONFIGURATION & PROGRESS */}
      {selectedDeployProtocol &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
                    <RocketIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                      <span>Авто-деплой: {selectedDeployProtocol.name}</span>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-lg border ${
                        selectedDeployProtocol.transportLayer === "UDP"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : selectedDeployProtocol.transportLayer === "TCP+UDP"
                          ? "bg-gradient-to-r from-sky-500/10 to-amber-500/10 text-sky-300 border-sky-500/30"
                          : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                      }`}>
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                        {selectedDeployProtocol.transportLayer}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Настройка параметров запуска на сервере {server.name}
                    </p>
                  </div>
                </div>

                {!isDeploying && (
                  <button
                    onClick={() => {
                      setSelectedDeployProtocol(null);
                      setDeploySuccessService(null);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {!deploySuccessService && !isDeploying && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold mb-1 block">Имя клиентского профиля</label>
                    <input
                      type="text"
                      value={deployClientName}
                      onChange={(e) => setDeployClientName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-semibold mb-1 block">Внешний Порт</label>
                      <input
                        type="number"
                        value={deployPort}
                        onChange={(e) => setDeployPort(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-semibold mb-1 block">SNI Маскировка</label>
                      <input
                        type="text"
                        value={deploySni}
                        onChange={(e) => setDeploySni(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {/* SNI Presets chips */}
                  <div>
                    <span className="text-[11px] text-slate-400 mb-1 block">Готовые безопасные SNI домены:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {SNI_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setDeploySni(preset)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono transition ${
                            deploySni === preset
                              ? "bg-violet-500/20 text-violet-300 border-violet-500/50"
                              : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AnyTLS advanced settings: padding_scheme, ALPN, TLS version pinning */}
                  {selectedDeployProtocol.id === "anytls" && (
                    <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-3.5 space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Тонкая настройка AnyTLS (sing-box):</span>
                        </div>
                        <a
                          href="https://sing-box.sagernet.org/configuration/inbound/anytls/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-cyan-400 hover:underline font-mono bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md flex items-center gap-1"
                        >
                          <span>sing-box docs</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      {/* Padding scheme */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Padding Scheme (маскировка размеров пакетов):
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAnytlsPaddingMode("default")}
                            className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold transition text-center ${
                              anytlsPaddingMode === "default"
                                ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300"
                                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/40"
                            }`}
                          >
                            По умолчанию (sing-box built-in)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnytlsPaddingMode("custom")}
                            className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold transition text-center ${
                              anytlsPaddingMode === "custom"
                                ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300"
                                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/40"
                            }`}
                          >
                            Своя схема
                          </button>
                        </div>
                        {anytlsPaddingMode === "custom" && (
                          <>
                            <textarea
                              value={anytlsPaddingScheme}
                              onChange={(e) => setAnytlsPaddingScheme(e.target.value)}
                              rows={9}
                              spellCheck={false}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white font-mono text-[10px] leading-relaxed focus:outline-none focus:border-cyan-500"
                            />
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] text-slate-500">
                                Формат: "stop=N" или "&lt;номер пакета&gt;=min-max[,c][,min-max...]" (пакет 0 -- только один диапазон, без "c"). См. protocol.md проекта anytls-go.
                              </p>
                              <button
                                type="button"
                                onClick={() => setAnytlsPaddingScheme(ANYTLS_DEFAULT_PADDING_SCHEME.join("\n"))}
                                className="text-[9px] px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 shrink-0 ml-2"
                              >
                                Сбросить к дефолту
                              </button>
                            </div>
                            {anytlsPaddingIssues.length > 0 && (
                              <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 space-y-1">
                                <div className="flex items-center gap-1.5 text-rose-300 text-[10px] font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Некорректная padding_scheme -- деплой заблокирован:</span>
                                </div>
                                {anytlsPaddingIssues.map((issue, i) => (
                                  <div key={i} className="text-[10px] text-rose-300/90 pl-5">-- {issue}</div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* ALPN + TLS version */}
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <label className="text-slate-400 font-semibold mb-0.5 block">ALPN (через запятую, необязательно)</label>
                          <input
                            type="text"
                            value={anytlsAlpn}
                            onChange={(e) => setAnytlsAlpn(e.target.value)}
                            placeholder="h2,http/1.1"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 font-semibold mb-0.5 block">Версия TLS</label>
                          <select
                            value={anytlsTlsVersion}
                            onChange={(e: any) => setAnytlsTlsVersion(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-cyan-500"
                          >
                            <option value="auto">Авто (сервер сам согласует)</option>
                            <option value="1.3">Только TLS 1.3</option>
                            <option value="1.2">Только TLS 1.2</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500">
                        ALPN и версия TLS -- часть общего TLS-конфига sing-box, а не AnyTLS-специфичные поля; влияют только на форму TLS-handshake (работает даже с self-signed сертификатом и insecure=1 у клиента).
                      </p>
                    </div>
                  )}

                  {/* AmneziaWG Specific Fine-Tuning Obfuscation Panel */}
                  {selectedDeployProtocol.id === "amnezia-wg" && (
                    <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-3.5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Тонкая настройка обфускации AmneziaWG 2.0:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/40 px-2 py-0.5 rounded-md">
                            AmneziaWG 2.0 Engine
                          </span>
                          <a
                            href="https://github.com/amnezia-vpn/amneziawg-tools"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-amber-400 hover:underline font-mono bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1"
                          >
                            <span>github.com/amnezia-vpn</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>

                      {/* Engine Version Selection */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold mb-1 block">Версия протокола AmneziaWG:</label>
                          <select
                            value={awgVersion}
                            onChange={(e: any) => setAwgVersion(e.target.value)}
                            className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-2 py-1 text-amber-300 font-mono text-[11px] font-bold focus:outline-none"
                          >
                            <option value="2.0">v2.0 — AmneziaWG 2.0 (ТСПУ 2.0 Bypass)</option>
                            <option value="1.0">v1.0 — Legacy AmneziaWG</option>
                          </select>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center">
                          {awgVersion === "2.0" ? (
                            <span className="text-violet-400 font-semibold leading-tight">
                              ✓ Включена двойная обфускация handshake-пакетов v2.0 и защита от систем фильтрации 2026 года.
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold leading-tight">
                              ⚠️ Режим совместимости v1.0 для старых клиентов WireGuard.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Presets -- all three now pull S1-S4/H1-H4 from the real generator
                          (generateAwgObfuscationParams) instead of hardcoded/reused values.
                          Only Jc/Jmin/Jmax (junk volume/size, which genuinely trade off
                          stealth vs. throughput) differ between presets; H-range placement
                          and S-padding have no such tradeoff, so they're always freshly
                          randomized and validated regardless of which preset is picked. */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-semibold block">Готовые пресеты маскировки AmneziaWG:</span>
                          <button
                            type="button"
                            onClick={() => applyGeneratedAwgParams(awgVersion)}
                            title="Сгенерировать новый случайный набор параметров (сохраняя текущую версию протокола)"
                            className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-300 font-bold flex items-center gap-1 transition"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Сгенерировать заново</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAwgVersion("2.0");
                              const p = generateAwgObfuscationParams("2.0");
                              setAwgJc(p.awgJc); setAwgJmin(p.awgJmin); setAwgJmax(p.awgJmax);
                              setAwgS1(p.awgS1); setAwgS2(p.awgS2); setAwgS3(p.awgS3); setAwgS4(p.awgS4);
                              setAwgH1(p.awgH1); setAwgH2(p.awgH2); setAwgH3(p.awgH3); setAwgH4(p.awgH4);
                            }}
                            className="px-2 py-1.5 rounded-lg border bg-amber-950/40 border-amber-500/50 text-amber-300 text-[10px] font-bold transition text-center hover:bg-amber-900/50"
                          >
                            🛡️ ТСПУ 2.0 Stealth (v2.0)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAwgVersion("2.0");
                              const p = generateAwgObfuscationParams("2.0");
                              // Heavier junk volume/size than the default generator range --
                              // more decoy traffic, at the cost of some throughput. Jmax is
                              // derived FROM the same jmin value (not a second independent
                              // random draw) so Jmax > Jmin is guaranteed by construction.
                              const heavyJmin = randInt(100, 150);
                              setAwgJc(randInt(7, 10)); setAwgJmin(heavyJmin); setAwgJmax(heavyJmin + randInt(100, 300));
                              setAwgS1(p.awgS1); setAwgS2(p.awgS2); setAwgS3(p.awgS3); setAwgS4(p.awgS4);
                              setAwgH1(p.awgH1); setAwgH2(p.awgH2); setAwgH3(p.awgH3); setAwgH4(p.awgH4);
                            }}
                            className="px-2 py-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/40 hover:text-amber-300 text-[10px] font-bold transition text-center"
                          >
                            🔒 Усиленный 2.0 (Max Junk)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAwgVersion("2.0");
                              const p = generateAwgObfuscationParams("2.0");
                              // Lighter junk volume/size than the default generator range --
                              // less decoy overhead, favors throughput over max stealth. Same
                              // fix as the preset above: derive jmax from the same jmin draw.
                              const lightJmin = randInt(10, 30);
                              setAwgJc(randInt(1, 3)); setAwgJmin(lightJmin); setAwgJmax(lightJmin + randInt(15, 40));
                              setAwgS1(p.awgS1); setAwgS2(p.awgS2); setAwgS3(p.awgS3); setAwgS4(p.awgS4);
                              setAwgH1(p.awgH1); setAwgH2(p.awgH2); setAwgH3(p.awgH3); setAwgH4(p.awgH4);
                            }}
                            className="px-2 py-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/40 hover:text-amber-300 text-[10px] font-bold transition text-center"
                          >
                            ⚡ Высокая скорость v2.0
                          </button>
                        </div>
                      </div>

                      {awgParamIssues.length > 0 && (
                        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5 text-rose-300 text-[10px] font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Некорректные параметры обфускации -- деплой заблокирован:</span>
                          </div>
                          {awgParamIssues.map((issue, i) => (
                            <div key={i} className="text-[10px] text-rose-300/90 pl-5">-- {issue}</div>
                          ))}
                        </div>
                      )}

                      {/* Obfuscation inputs grid */}
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div>
                          <label className="text-slate-400 font-semibold mb-0.5 block">Jc (Мусорные пакеты)</label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={awgJc}
                            onChange={(e) => setAwgJc(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 font-semibold mb-0.5 block">Jmin (Мин. байт)</label>
                          <input
                            type="number"
                            value={awgJmin}
                            onChange={(e) => setAwgJmin(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 font-semibold mb-0.5 block">Jmax (Макс. байт)</label>
                          <input
                            type="number"
                            value={awgJmax}
                            onChange={(e) => setAwgJmax(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className={awgVersion === "2.0" ? "grid grid-cols-4 gap-2 text-[10px]" : "grid grid-cols-2 gap-2 text-[10px]"}>
                        <div>
                          <label className="text-slate-400 font-semibold mb-0.5 block">S1 (Init Packet Junk)</label>
                          <input
                            type="number"
                            value={awgS1}
                            onChange={(e) => setAwgS1(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 font-semibold mb-0.5 block">S2 (Response Packet Junk)</label>
                          <input
                            type="number"
                            value={awgS2}
                            onChange={(e) => setAwgS2(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {awgVersion === "2.0" && (
                          <>
                            <div>
                              <label className="text-slate-400 font-semibold mb-0.5 block">S3 (Cookie Packet Junk)</label>
                              <input
                                type="number"
                                value={awgS3}
                                onChange={(e) => setAwgS3(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-semibold mb-0.5 block">S4 (Data Packet Junk)</label>
                              <input
                                type="number"
                                value={awgS4}
                                onChange={(e) => setAwgS4(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                          Magic Headers (H1-H4 -- подмена заголовков Handshake{awgVersion === "2.0" ? ", формат диапазона: min-max" : ", целое число >= 5"}):
                        </span>
                        <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                          <div>
                            <span className="text-[9px] text-slate-500 block">H1 (Init)</span>
                            <input
                              type="text"
                              value={awgH1}
                              onChange={(e) => setAwgH1(e.target.value)}
                              placeholder={awgVersion === "2.0" ? "min-max" : "уник. число"}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-center text-[9px] focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">H2 (Resp)</span>
                            <input
                              type="text"
                              value={awgH2}
                              onChange={(e) => setAwgH2(e.target.value)}
                              placeholder={awgVersion === "2.0" ? "min-max" : "уник. число"}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-center text-[9px] focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">H3 (Cookie)</span>
                            <input
                              type="text"
                              value={awgH3}
                              onChange={(e) => setAwgH3(e.target.value)}
                              placeholder={awgVersion === "2.0" ? "min-max" : "уник. число"}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-center text-[9px] focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">H4 (Data)</span>
                            <input
                              type="text"
                              value={awgH4}
                              onChange={(e) => setAwgH4(e.target.value)}
                              placeholder={awgVersion === "2.0" ? "min-max" : "уник. число"}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-center text-[9px] focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-1">H1-H4 обязаны быть непересекающимися и не входить в 1-4 (зарезервировано WireGuard) -- используй "Сгенерировать заново" выше, если правил не помнишь наизусть.</p>
                      </div>
                    </div>
                  )}

                  {/* 3X-UI FULL XRAY CONTROL PANEL */}
                  {(selectedDeployProtocol.id.startsWith("xray-") || selectedDeployProtocol.id === "shadowsocks-2022") && (
                    <div className="bg-slate-950 border border-violet-500/30 rounded-2xl p-3.5 space-y-3.5 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="text-[11px] font-bold text-violet-400 flex items-center gap-1.5">
                          <Sliders className="w-4 h-4" />
                          <span>Панель управления Xray (3X-UI Panel):</span>
                        </div>
                        <span className="text-[9px] bg-violet-500/20 text-violet-300 font-mono font-bold border border-violet-500/40 px-2 py-0.5 rounded-md">
                          Xray-core v1.8.24
                        </span>
                      </div>

                      {/* Sub-tabs selector */}
                      <div className="grid grid-cols-4 gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-[10px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setXrayPanelSubTab("stream")}
                          className={`py-1 rounded-lg transition ${
                            xrayPanelSubTab === "stream"
                              ? "bg-violet-500 text-slate-950 font-bold"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          🌐 Транспорт
                        </button>
                        <button
                          type="button"
                          onClick={() => setXrayPanelSubTab("limits")}
                          className={`py-1 rounded-lg transition ${
                            xrayPanelSubTab === "limits"
                              ? "bg-violet-500 text-slate-950 font-bold"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          👤 Клиент
                        </button>
                        <button
                          type="button"
                          onClick={() => setXrayPanelSubTab("sniffing")}
                          className={`py-1 rounded-lg transition ${
                            xrayPanelSubTab === "sniffing"
                              ? "bg-violet-500 text-slate-950 font-bold"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          🕵️ Сниффинг
                        </button>
                        <button
                          type="button"
                          onClick={() => setXrayPanelSubTab("routing")}
                          className={`py-1 rounded-lg transition ${
                            xrayPanelSubTab === "routing"
                              ? "bg-violet-500 text-slate-950 font-bold"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          🛡️ Фильтры
                        </button>
                      </div>

                      {/* SUB-TAB 1: STREAM & REALITY SETTINGS */}
                      {xrayPanelSubTab === "stream" && (
                        <div className="space-y-3 text-[11px]">
                          {/* Quick Presets */}
                          <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 space-y-1.5">
                            <span className="text-[10px] text-violet-400 font-bold block">Быстрые пресеты конфигураций 3X-UI:</span>
                            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                              <button
                                type="button"
                                onClick={() => {
                                  setXrayTransport("grpc");
                                  setXraySecurity("reality");
                                  setXrayFlow("none");
                                  setXrayGrpcServiceName("grpc-vless");
                                  setUtlsFingerprint("chrome");
                                }}
                                className="bg-slate-950 hover:bg-violet-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-violet-500/40 transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-white">🛡️ REALITY + gRPC</div>
                                  <div className="text-slate-400">Обход ТСПУ & DPI</div>
                                </div>
                                <span className="text-violet-400 text-[8px] bg-violet-500/10 px-1 py-0.5 rounded">Recom</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setXrayTransport("tcp");
                                  setXraySecurity("reality");
                                  setXrayFlow("xtls-rprx-vision");
                                  setUtlsFingerprint("chrome");
                                }}
                                className="bg-slate-950 hover:bg-violet-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-violet-500/40 transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-white">⚡ REALITY + TCP Vision</div>
                                  <div className="text-slate-400">Максимальная скорость</div>
                                </div>
                                <span className="text-fuchsia-400 text-[8px] bg-fuchsia-500/10 px-1 py-0.5 rounded">Fast</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setXrayTransport("ws");
                                  setXraySecurity("tls");
                                  setXrayWsPath("/ws");
                                  setXrayWsHost("");
                                }}
                                className="bg-slate-950 hover:bg-violet-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-violet-500/40 transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-white">☁️ VMess + WS CDN</div>
                                  <div className="text-slate-400">Совместим с Cloudflare</div>
                                </div>
                                <span className="text-amber-400 text-[8px] bg-amber-500/10 px-1 py-0.5 rounded">CDN</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setXrayTransport("grpc");
                                  setXraySecurity("tls");
                                  setXrayGrpcServiceName("trojan-grpc");
                                }}
                                className="bg-slate-950 hover:bg-violet-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-violet-500/40 transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-white">🔑 Trojan + gRPC</div>
                                  <div className="text-slate-400">TLS Шифрование</div>
                                </div>
                                <span className="text-indigo-400 text-[8px] bg-indigo-500/10 px-1 py-0.5 rounded">TLS</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setXrayTransport("splithttp");
                                  setXraySecurity("reality");
                                  setXrayWsPath("/xhttp");
                                  setXraySplitHttpMode("auto");
                                }}
                                className="bg-slate-950 hover:bg-violet-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-violet-500/40 transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-white">🌐 XHTTP + REALITY</div>
                                  <div className="text-slate-400">HTTP/2+3, новейший транспорт</div>
                                </div>
                                <span className="text-emerald-400 text-[8px] bg-emerald-500/10 px-1 py-0.5 rounded">New</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-slate-400 font-semibold mb-1 block">Транспорт (Network)</label>
                              <select
                                value={xrayTransport}
                                onChange={(e: any) => setXrayTransport(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-violet-500 text-[11px]"
                              >
                                <option value="grpc">gRPC (Ultra stealth stream)</option>
                                <option value="tcp">TCP / RAW (Standard Direct)</option>
                                <option value="ws">WebSocket (Cloudflare CDN support)</option>
                                <option value="splithttp">XHTTP / SplitHTTP (HTTP/2+3, REALITY-совместим)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-slate-400 font-semibold mb-1 block">Шифрование (Security)</label>
                              <select
                                value={xraySecurity}
                                onChange={(e: any) => setXraySecurity(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-violet-500 text-[11px]"
                              >
                                <option value="reality">REALITY (Маскировка под чужой SNI)</option>
                                <option value="tls">Standard TLS (Сертификат)</option>
                                <option value="none">None (Без шифрования)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-slate-400 font-semibold mb-1 block">Vision Flow</label>
                              <select
                                value={xrayFlow}
                                onChange={(e: any) => setXrayFlow(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-violet-500 text-[11px]"
                              >
                                <option value="xtls-rprx-vision">xtls-rprx-vision (Защита от DPI)</option>
                                <option value="xtls-rprx-vision-udp-443">xtls-rprx-vision-udp-443</option>
                                <option value="none">None (Без потока Vision)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-slate-400 font-semibold mb-1 block">uTLS Fingerprint</label>
                              <select
                                value={utlsFingerprint}
                                onChange={(e: any) => setUtlsFingerprint(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-violet-500 text-[11px]"
                              >
                                <option value="chrome">Chrome Desktop</option>
                                <option value="safari">Safari iOS</option>
                                <option value="firefox">Firefox</option>
                              </select>
                            </div>
                          </div>

                          {xraySecurity === "reality" && (
                            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-violet-400 font-semibold">Параметры REALITY TLS:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newShort = Math.random().toString(16).substring(2, 10);
                                    setXrayShortId(newShort);
                                  }}
                                  className="text-amber-300 font-bold hover:underline flex items-center gap-1"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Новый Short ID</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <label className="text-slate-400 block mb-0.5">Target Dest Host:Port</label>
                                  <input
                                    type="text"
                                    value={xrayDest}
                                    onChange={(e) => setXrayDest(e.target.value)}
                                    placeholder="dl.google.com:443"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-400 block mb-0.5">Short ID (Hex)</label>
                                  <input
                                    type="text"
                                    value={xrayShortId}
                                    onChange={(e) => setXrayShortId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-violet-300 font-mono"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                                <div>
                                  <label className="text-slate-400 block mb-0.5">Public Key (pbk)</label>
                                  <input
                                    type="text"
                                    value={xrayPublicKey}
                                    onChange={(e) => setXrayPublicKey(e.target.value)}
                                    placeholder="pbk_..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-400 block mb-0.5">Private Key</label>
                                  <input
                                    type="text"
                                    value={xrayPrivateKey}
                                    onChange={(e) => setXrayPrivateKey(e.target.value)}
                                    placeholder="Server Private Key..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-400 font-mono"
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setXrayRealityAdvancedOpen((v) => !v)}
                                className="w-full flex items-center justify-between text-[10px] text-violet-400 font-semibold pt-1 border-t border-slate-800 mt-1"
                              >
                                <span>Расширенные параметры REALITY (multi-SNI, версии клиента, PQ-подпись, anti-scan)</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${xrayRealityAdvancedOpen ? "rotate-180" : ""}`} />
                              </button>

                              {xrayRealityAdvancedOpen && (
                                <div className="space-y-2 pt-1">
                                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div>
                                      <label className="text-slate-400 block mb-0.5">Доп. Server Names (через запятую)</label>
                                      <input
                                        type="text"
                                        value={xrayExtraServerNames}
                                        onChange={(e) => setXrayExtraServerNames(e.target.value)}
                                        placeholder="www.google.com, encrypted-tbn0.gstatic.com"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-400 block mb-0.5">Доп. Short IDs (через запятую)</label>
                                      <input
                                        type="text"
                                        value={xrayExtraShortIds}
                                        onChange={(e) => setXrayExtraShortIds(e.target.value)}
                                        placeholder="ab12, cd34ef56"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                                    <div>
                                      <label className="text-slate-400 block mb-0.5">Min Client Ver</label>
                                      <input
                                        type="text"
                                        value={xrayMinClientVer}
                                        onChange={(e) => setXrayMinClientVer(e.target.value)}
                                        placeholder="x.y.z"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-400 block mb-0.5">Max Client Ver</label>
                                      <input
                                        type="text"
                                        value={xrayMaxClientVer}
                                        onChange={(e) => setXrayMaxClientVer(e.target.value)}
                                        placeholder="x.y.z"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-400 block mb-0.5">Max Time Diff (мс)</label>
                                      <input
                                        type="text"
                                        value={xrayMaxTimeDiff}
                                        onChange={(e) => setXrayMaxTimeDiff(e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-slate-400 block mb-0.5 text-[10px]">ML-DSA-65 Seed (пост-квантовая подпись сертификата, необязательно)</label>
                                    <input
                                      type="text"
                                      value={xrayMldsa65Seed}
                                      onChange={(e) => setXrayMldsa65Seed(e.target.value)}
                                      placeholder="оставь пустым, чтобы отключить -- сгенерировать: xray mldsa65"
                                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-[10px]"
                                    />
                                    <p className="text-[9px] text-slate-500 mt-0.5">Важно: после включения target-сертификат должен быть больше 3500 байт (иначе сама подпись станет фингерпринтом). Проверка: xray tls ping &lt;target&gt;.</p>
                                  </div>

                                  <div className="bg-slate-950/80 border border-amber-500/20 rounded-lg p-2 space-y-1.5">
                                    <label className="flex items-center gap-2 text-[10px] text-amber-300 font-semibold cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={xrayFallbackLimitEnabled}
                                        onChange={(e) => setXrayFallbackLimitEnabled(e.target.checked)}
                                        className="accent-amber-500"
                                      />
                                      <span>Ограничить скорость fallback-соединений (anti-scan)</span>
                                    </label>
                                    <p className="text-[9px] text-slate-500">
                                      Официальная документация REALITY прямо предупреждает: само ограничение скорости -- тоже фингерпринт, и в большинстве случаев эта опция не нужна (лучше использовать сертификат из того же ASN, что и target). Включай только если осознанно занимаешь чужой /free CDN-домен как target.
                                    </p>
                                    {xrayFallbackLimitEnabled && (
                                      <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
                                        <div>
                                          <label className="text-slate-400 block mb-0.5">After Bytes</label>
                                          <input
                                            type="text"
                                            value={xrayFallbackAfterBytes}
                                            onChange={(e) => setXrayFallbackAfterBytes(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-slate-400 block mb-0.5">Bytes/Sec</label>
                                          <input
                                            type="text"
                                            value={xrayFallbackBytesPerSec}
                                            onChange={(e) => setXrayFallbackBytesPerSec(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-slate-400 block mb-0.5">Burst Bytes/Sec</label>
                                          <input
                                            type="text"
                                            value={xrayFallbackBurstBytesPerSec}
                                            onChange={(e) => setXrayFallbackBurstBytesPerSec(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {realityIssues.length > 0 && (
                                    <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 space-y-1">
                                      <div className="flex items-center gap-1.5 text-rose-300 text-[10px] font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span>Некорректные параметры REALITY -- деплой заблокирован:</span>
                                      </div>
                                      {realityIssues.map((issue, i) => (
                                        <div key={i} className="text-[10px] text-rose-300/90 pl-5">-- {issue}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {xrayTransport === "grpc" && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-slate-400 font-semibold mb-1 block">gRPC Service Name</label>
                                <input
                                  type="text"
                                  value={xrayGrpcServiceName}
                                  onChange={(e) => setXrayGrpcServiceName(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 font-semibold mb-1 block">Idle Timeout (сек, необяз.)</label>
                                <input
                                  type="text"
                                  value={xrayGrpcIdleTimeout}
                                  onChange={(e) => setXrayGrpcIdleTimeout(e.target.value)}
                                  placeholder="60"
                                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          )}

                          {(xrayTransport === "ws" || xrayTransport === "splithttp") && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-slate-400 font-semibold mb-1 block">{xrayTransport === "ws" ? "WebSocket Path" : "XHTTP Path"}</label>
                                  <input
                                    type="text"
                                    value={xrayWsPath}
                                    onChange={(e) => setXrayWsPath(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-400 font-semibold mb-1 block">{xrayTransport === "ws" ? "WS Host Header" : "XHTTP Host Header"}</label>
                                  <input
                                    type="text"
                                    value={xrayWsHost}
                                    onChange={(e) => setXrayWsHost(e.target.value)}
                                    placeholder="cloudflare.com"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                                  />
                                </div>
                              </div>

                              {xrayTransport === "ws" && (
                                <div>
                                  <label className="text-slate-400 font-semibold mb-1 block">Heartbeat Period (сек, необяз. -- keepalive для мобильных сетей)</label>
                                  <input
                                    type="text"
                                    value={xrayWsHeartbeat}
                                    onChange={(e) => setXrayWsHeartbeat(e.target.value)}
                                    placeholder="0 = выключено"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                                  />
                                </div>
                              )}

                              {xrayTransport === "splithttp" && (
                                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-2">
                                  <div>
                                    <label className="text-slate-400 font-semibold mb-1 block text-[10px]">Mode</label>
                                    <select
                                      value={xraySplitHttpMode}
                                      onChange={(e: any) => setXraySplitHttpMode(e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                                    >
                                      <option value="auto">auto (сервер сам согласует)</option>
                                      <option value="packet-up">packet-up (каждый пакет -- отдельный POST)</option>
                                      <option value="stream-up">stream-up (один долгий POST)</option>
                                      <option value="stream-one">stream-one (один TCP-коннект на оба направления)</option>
                                    </select>
                                  </div>
                                  <label className="flex items-center gap-2 text-[10px] text-slate-300 font-semibold cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={xraySplitHttpPaddingEnabled}
                                      onChange={(e) => setXraySplitHttpPaddingEnabled(e.target.checked)}
                                      className="accent-violet-500"
                                    />
                                    <span>xPaddingBytes -- случайный паддинг запроса (от/до байт)</span>
                                  </label>
                                  {xraySplitHttpPaddingEnabled && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-slate-400 block mb-0.5 text-[10px]">От (байт)</label>
                                        <input
                                          type="text"
                                          value={xraySplitHttpPaddingFrom}
                                          onChange={(e) => setXraySplitHttpPaddingFrom(e.target.value)}
                                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-slate-400 block mb-0.5 text-[10px]">До (байт)</label>
                                        <input
                                          type="text"
                                          value={xraySplitHttpPaddingTo}
                                          onChange={(e) => setXraySplitHttpPaddingTo(e.target.value)}
                                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {selectedDeployProtocol.id === "shadowsocks-2022" && (
                            <div>
                              <label className="text-slate-400 font-semibold mb-1 block">Shadowsocks 2022 Cipher Method</label>
                              <select
                                value={xraySsCipher}
                                onChange={(e: any) => setXraySsCipher(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-amber-300 font-mono text-[11px]"
                              >
                                <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305 (Ultra Fast)</option>
                                <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm (Hardware AES-NI)</option>
                                <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm (Max AES)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUB-TAB 2: CLIENT IDENTIFIER */}
                      {xrayPanelSubTab === "limits" && (
                        <div className="space-y-3 text-[11px]">
                          <div>
                            <label className="text-slate-400 font-semibold mb-1 block">Клиентский Tag / Email identifier</label>
                            <input
                              type="text"
                              value={deployClientName}
                              onChange={(e) => setDeployClientName(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                            />
                            <span className="text-[10px] text-slate-500 block mt-1">
                              Используется как email/tag клиента в конфиге. Лимиты трафика/срока/IP убраны --
                              ванильный Xray-core их не поддерживает без отдельной панели со своим API-демоном (3X-UI).
                            </span>
                          </div>
                        </div>
                      )}

                      {/* SUB-TAB 3: TRAFFIC SNIFFING */}
                      {xrayPanelSubTab === "sniffing" && (
                        <div className="space-y-3 text-[11px]">
                          <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                            <div>
                              <span className="text-white font-bold block">Включить Sniffing в Xray</span>
                              <span className="text-[10px] text-slate-400 block">Перехват SNI доменов для умной маршрутизации</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={xraySniffing}
                              onChange={(e) => setXraySniffing(e.target.checked)}
                              className="rounded border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-950 w-4 h-4"
                            />
                          </div>

                          {xraySniffing && (
                            <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                              <span className="text-[10px] text-slate-400 font-semibold block">Протоколы сниффинга:</span>
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={xraySniffingTls}
                                    onChange={(e) => setXraySniffingTls(e.target.checked)}
                                    className="rounded border-slate-700 text-violet-500 bg-slate-950"
                                  />
                                  <span>TLS / HTTPS</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={xraySniffingHttp}
                                    onChange={(e) => setXraySniffingHttp(e.target.checked)}
                                    className="rounded border-slate-700 text-violet-500 bg-slate-950"
                                  />
                                  <span>HTTP</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={xraySniffingQuic}
                                    onChange={(e) => setXraySniffingQuic(e.target.checked)}
                                    className="rounded border-slate-700 text-violet-500 bg-slate-950"
                                  />
                                  <span>QUIC (HTTP/3)</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={xraySniffingFakedns}
                                    onChange={(e) => setXraySniffingFakedns(e.target.checked)}
                                    className="rounded border-slate-700 text-violet-500 bg-slate-950"
                                  />
                                  <span>FakeDNS</span>
                                </label>
                              </div>

                              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                                <span className="text-slate-400">RouteOnly (Маршрутизация без MiTM):</span>
                                <input
                                  type="checkbox"
                                  checked={xrayRouteOnly}
                                  onChange={(e) => setXrayRouteOnly(e.target.checked)}
                                  className="rounded border-slate-700 text-violet-500 bg-slate-950 cursor-pointer"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUB-TAB 4: ROUTING & SECURITY FILTERS */}
                      {xrayPanelSubTab === "routing" && (
                        <div className="space-y-3 text-[11px]">
                          <div>
                            <label className="text-slate-400 font-semibold mb-1 block">Domain Strategy (Разрешение DNS)</label>
                            <select
                              value={xrayDomainStrategy}
                              onChange={(e: any) => setXrayDomainStrategy(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                            >
                              <option value="IPIfNonMatch">IPIfNonMatch (Рекомендуемо 3X-UI)</option>
                              <option value="UseIPv4">UseIPv4 Only (Только IPv4)</option>
                              <option value="UseIPv6">UseIPv6 Only</option>
                              <option value="AsIs">AsIs (Без резолвинга)</option>
                            </select>
                          </div>

                          <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-[10px]">
                            <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                              <span>🚫 Блокировка BitTorrent / P2P трафика</span>
                              <input
                                type="checkbox"
                                checked={xrayBlockP2p}
                                onChange={(e) => setXrayBlockP2p(e.target.checked)}
                                className="rounded border-slate-700 text-violet-500 bg-slate-950"
                              />
                            </label>

                            <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                              <span>🛡️ Блокировать рекламные домены (geosite:ads)</span>
                              <input
                                type="checkbox"
                                checked={xrayBlockAds}
                                onChange={(e) => setXrayBlockAds(e.target.checked)}
                                className="rounded border-slate-700 text-violet-500 bg-slate-950"
                              />
                            </label>

                            <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                              <span>🔒 Блокировка приватных IP сетей (SSRF Shield)</span>
                              <input
                                type="checkbox"
                                checked={xrayBlockPrivateIp}
                                onChange={(e) => setXrayBlockPrivateIp(e.target.checked)}
                                className="rounded border-slate-700 text-violet-500 bg-slate-950"
                              />
                            </label>

                            <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                              <span>⚡ IPv4 Приоритет для стриминга (Netflix / YT)</span>
                              <input
                                type="checkbox"
                                checked={xrayPreferIpv4}
                                onChange={(e) => setXrayPreferIpv4(e.target.checked)}
                                className="rounded border-slate-700 text-violet-500 bg-slate-950"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <input
                      type="checkbox"
                      id="bbr-chk"
                      checked={enableBbr}
                      onChange={(e) => setEnableBbr(e.target.checked)}
                      className="rounded border-slate-700 text-violet-500 focus:ring-violet-500 bg-slate-950"
                    />
                    <label htmlFor="bbr-chk" className="text-slate-300 font-semibold cursor-pointer">
                      Включить ускорение TCP BBR в ядре Linux
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => setSelectedDeployProtocol(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleStartDeploy}
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold rounded-xl shadow-lg transition"
                    >
                      Начать автоматический деплой
                    </button>
                  </div>
                </div>
              )}

              {/* Progress Terminal Logger */}
              {isDeploying && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-violet-400 font-bold text-xs">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Выполнение установки на SSH сервере...</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] text-violet-400 space-y-2 max-h-64 overflow-y-auto">
                    {deployLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed border-b border-slate-900/60 pb-1">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deployment Success & Generated Link */}
              {deploySuccessService && !isDeploying && (
                <div className="space-y-4 text-xs">
                  <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-4 space-y-2 text-center">
                    <CheckCircle2 className="w-8 h-8 text-violet-400 mx-auto animate-bounce" />
                    <h4 className="font-extrabold text-violet-300 text-sm">
                      ВПН сервер успешно развернут и активен!
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Все ключи сгенерированы. Протокол работает на порту {deploySuccessService.port}
                    </p>
                  </div>

                  <div className="flex justify-center py-2">
                    <QRCodeSVG value={deploySuccessService.clientLink} size={180} />
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">Готовая клиентская ссылка:</span>
                      <button
                        onClick={() => handleCopyText(deploySuccessService.clientLink)}
                        className="text-violet-400 font-bold flex items-center gap-1"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? "Скопировано!" : "Скопировать"}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={deploySuccessService.clientLink}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono select-all focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setSelectedDeployProtocol(null);
                        setDeploySuccessService(null);
                        setActiveTab("installed");
                      }}
                      className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition text-center"
                    >
                      Перейти к установленным ВПН
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 2: QR CODE & DETAILED KEYS */}
      {qrModalService &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto opacity-100 animate-in fade-in duration-300">
            <div className="relative bg-slate-900 border border-slate-700/80 rounded-[2rem] w-full max-w-sm p-6 space-y-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] my-auto text-center transform animate-in zoom-in-95 duration-300">
              {/* Decorative glows */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent" />
              
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <div className="p-2 bg-fuchsia-500/10 rounded-xl">
                    <QrCode className="w-4 h-4 text-fuchsia-400" />
                  </div>
                  <span>Подключение</span>
                </h3>
                <button
                  onClick={() => setQrModalService(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-center py-4 bg-white/5 rounded-3xl border border-white/5 shadow-inner">
                <QRCodeSVG value={qrModalService.clientLink} size={220} />
              </div>

              <div className="text-left space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Профиль</span>
                  <span className="text-white font-medium">{qrModalService.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">UUID</span>
                  <span className="text-violet-400 font-mono text-[11px] truncate max-w-[150px]">{qrModalService.uuid}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleCopyText(qrModalService.clientLink)}
                  className="w-full py-3.5 bg-gradient-to-r from-fuchsia-600 to-blue-600 hover:from-fuchsia-500 hover:to-blue-500 text-white font-bold text-xs rounded-2xl transition-all shadow-[0_4px_20px_rgba(217,70,239,0.3)] active:scale-95 flex items-center justify-center gap-2"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? "Скопировано!" : "Скопировать ключ доступа"}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 3: ADD CLIENT */}
      {addClientTarget &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[90vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Добавить клиента</h3>
                    <p className="text-[11px] text-slate-400">{addClientTarget.name}</p>
                  </div>
                </div>
                {!isMutatingClients && (
                  <button
                    onClick={() => { setAddClientTarget(null); setAddClientResult(null); setClientMutationLogs([]); }}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {!addClientResult && !isMutatingClients && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold mb-1 block">Имя клиента</label>
                    <input
                      type="text"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed">
                    Перед изменением я проверю, что служба сейчас реально активна, прочитаю
                    актуальный конфиг с сервера, соберу и провалидирую новую версию во
                    временном файле {addClientTarget.protocolId !== "amnezia-wg" && `(${addClientTarget.protocolId === "anytls" ? "sing-box check" : "xray run -test"})`}
                    и только потом применю её. Если что-то пойдёт не так -- автоматически
                    откачу рабочий конфиг обратно и перезапущу службу с ним.
                  </div>
                  <button
                    onClick={handleConfirmAddClient}
                    className="w-full py-3 bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2"
                  >
                    <Rocket className="w-4 h-4" />
                    <span>Проверить и добавить</span>
                  </button>
                </div>
              )}

              {isMutatingClients && (
                <div className="space-y-2 text-[10px] font-mono bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-64 overflow-y-auto">
                  {clientMutationLogs.map((line, i) => (
                    <div key={i} className={line.startsWith("[FAILED]") ? "text-rose-400" : line.startsWith("[SUCCESS]") ? "text-violet-400" : "text-slate-400"}>
                      {line}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-slate-500 pt-1">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    <span>Выполняется...</span>
                  </div>
                </div>
              )}

              {addClientResult && !isMutatingClients && (
                <div className="space-y-4 text-xs">
                  <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-3 flex items-center gap-2 text-violet-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Клиент "{addClientResult.name}" добавлен и служба подтверждена активной.</span>
                  </div>
                  <div className="flex justify-center py-3 bg-white/5 rounded-2xl border border-white/5">
                    <QRCodeSVG value={addClientResult.clientLink} size={180} />
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      readOnly
                      value={addClientResult.clientLink}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-24 py-2 text-[10px] text-violet-300 font-mono truncate"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => handleCopyText(addClientResult.clientLink)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-slate-700"
                    >
                      {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? "Скопировано" : "Копировать"}</span>
                    </button>
                  </div>
                  <button
                    onClick={() => { setAddClientTarget(null); setAddClientResult(null); setClientMutationLogs([]); }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl transition"
                  >
                    Готово
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 4: REMOVE CLIENT CONFIRM */}
      {removingClient &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-5 sm:p-6 space-y-4 shadow-2xl my-auto">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Удалить клиента?</h3>
                  <p className="text-[11px] text-slate-400">{removingClient.client.name} -- {removingClient.service.name}</p>
                </div>
              </div>

              {!isMutatingClients ? (
                <>
                  <p className="text-[11px] text-slate-400">
                    Конфиг клиента перестанет работать сразу после применения. Служба будет
                    перезапущена (проверю активность до и после) -- при сбое изменения
                    откатятся автоматически.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setRemovingClient(null)}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl transition"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleConfirmRemoveClient}
                      className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs rounded-2xl transition"
                    >
                      Удалить
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2 text-[10px] font-mono bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-64 overflow-y-auto">
                  {clientMutationLogs.map((line, i) => (
                    <div key={i} className={line.startsWith("[FAILED]") ? "text-rose-400" : line.startsWith("[SUCCESS]") ? "text-violet-400" : "text-slate-400"}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.71.79-1.81.79-2.72L4.5 16.5z" />
      <path d="M15 11l-3 3" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L13 14l-4-4 9.5-9.5z" />
    </svg>
  );
}

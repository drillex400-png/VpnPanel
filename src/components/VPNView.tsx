import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SSHConfig, VPNProtocolCatalog, InstalledVPNService, VPNAssistantMessage } from "../types";
import { execCommand, authFetch } from "../services/api";
import { useToast } from "../contexts/ToastContext";
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
  Download,
  FileText,
  X,
  CheckCircle2,
  Clock,
  Activity,
  Sliders,
  RefreshCw,
  Rocket
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
    features: [
      "Обход блокировок по протоколу и SNI",
      "Маскировка под Google / Apple CDN",
      "Не требуется личный домен или SSL сертификат",
      "Поддержка gRPC и X-TLS Vision flow"
    ],
    recommendedApps: ["v2rayNG", "Happ", "Streisand", "NekoBox", "Amnezia"],
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
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
    features: [
      "Работает на официальном ядре sing-box (SagerNet)",
      "Официальный inbound протокол type: anytls",
      "Автоматический фоллбэк при сканировании портов",
      "Защита от активного зондирования ТСПУ"
    ],
    recommendedApps: ["sing-box", "v2rayNG", "Shadowrocket", "NekoBox"],
    gradient: "from-cyan-500/20 via-blue-500/10 to-transparent",
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
    features: [
      "AmneziaWG 2.0 Next-Gen Obfuscation",
      "Работа на уровне ядра Linux (Kernel dkms)",
      "Защита от активного зондирования и блокировок ТСПУ 2.0",
      "Минимальное энергопотребление на смартфоне"
    ],
    recommendedApps: ["Amnezia VPN Client (v2.0+)", "AmneziaWG App"],
    gradient: "from-emerald-500/20 via-lime-500/10 to-transparent",
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

export const VPNView: React.FC<VPNViewProps> = ({ server }) => {
  const toast = useToast();
  // Installed VPNs State
  const [installedServices, setInstalledServices] = useState<InstalledVPNService[]>([
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
      configPath: "/etc/xray/config.json",
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
    },
  ]);

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
  const [awgJc, setAwgJc] = useState<number>(4);
  const [awgJmin, setAwgJmin] = useState<number>(40);
  const [awgJmax, setAwgJmax] = useState<number>(70);
  const [awgS1, setAwgS1] = useState<number>(15);
  const [awgS2, setAwgS2] = useState<number>(20);
  const [awgH1, setAwgH1] = useState<number>(1);
  const [awgH2, setAwgH2] = useState<number>(2);
  const [awgH3, setAwgH3] = useState<number>(3);
  const [awgH4, setAwgH4] = useState<number>(4);

  // 3X-UI Full Xray Panel Fine-Tuning Parameters
  const [xrayTransport, setXrayTransport] = useState<"grpc" | "tcp" | "ws" | "http" | "quic">("grpc");
  const [xraySecurity, setXraySecurity] = useState<"reality" | "tls" | "none">("reality");
  const [xrayFlow, setXrayFlow] = useState<"xtls-rprx-vision" | "xtls-rprx-vision-udp-443" | "none">("xtls-rprx-vision");
  const [xrayDest, setXrayDest] = useState<string>("dl.google.com:443");
  const [xrayShortId, setXrayShortId] = useState<string>("6ba7b810");
  const [xrayPrivateKey, setXrayPrivateKey] = useState<string>("x8F2k9L1mN3pQ5rT7vW9xZ2aC4eG6iI8kM0oQ2sU4wY");
  const [xrayPublicKey, setXrayPublicKey] = useState<string>("p1K9mL2nQ4rT6vW8xZ0aC3eG5iH7kJ9mL1oP3sU5wX0");
  const [xrayAlpn, setXrayAlpn] = useState<string>("h2,http/1.1");
  const [xrayGrpcServiceName, setXrayGrpcServiceName] = useState<string>("grpc-vless");
  const [xrayGrpcMultiMode, setXrayGrpcMultiMode] = useState<boolean>(false);
  const [xrayWsPath, setXrayWsPath] = useState<string>("/ws");
  const [xrayWsHost, setXrayWsHost] = useState<string>("");
  const [xraySsCipher, setXraySsCipher] = useState<"2022-blake3-chacha20-poly1305" | "2022-blake3-aes-128-gcm" | "2022-blake3-aes-256-gcm">("2022-blake3-chacha20-poly1305");

  // 3X-UI Traffic Sniffing
  const [xraySniffing, setXraySniffing] = useState<boolean>(true);
  const [xraySniffingHttp, setXraySniffingHttp] = useState<boolean>(true);
  const [xraySniffingTls, setXraySniffingTls] = useState<boolean>(true);
  const [xraySniffingQuic, setXraySniffingQuic] = useState<boolean>(true);
  const [xraySniffingFakedns, setXraySniffingFakedns] = useState<boolean>(true);
  const [xrayRouteOnly, setXrayRouteOnly] = useState<boolean>(true);

  // 3X-UI Client Quotas & Expiry Limits
  const [xrayTotalGb, setXrayTotalGb] = useState<number>(0);
  const [xrayExpiryDays, setXrayExpiryDays] = useState<number>(0);
  const [xrayIpLimit, setXrayIpLimit] = useState<number>(0);

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

  // QR Code & Copy link Modal
  const [qrModalService, setQrModalService] = useState<InstalledVPNService | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

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

  // Execute SSH Status check on load for real servers
  useEffect(() => {
    checkServerVpnStatus();
  }, [server]);

  // 3X-UI Options Conflict Resolution
  useEffect(() => {
    // REALITY does not support WebSocket or QUIC
    if ((xrayTransport === "ws" || xrayTransport === "quic") && xraySecurity === "reality") {
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

  const checkServerVpnStatus = async () => {
    if (server.isDemo) return;

    try {
      const res = await execCommand(server, "systemctl is-active xray anytls.service awg-quick@awg0.service 2>/dev/null");
      if (res.stdout) {
        const statuses = res.stdout.split("\\n").map(s => s.trim());
        setInstalledServices(prev => prev.map(inst => {
          let expectedStatus = "inactive";
          if (inst.protocolId.includes("xray") || inst.protocolId === "shadowsocks-2022") {
            expectedStatus = statuses[0];
          } else if (inst.protocolId === "anytls") {
            expectedStatus = statuses[1];
          } else if (inst.protocolId === "amnezia-wg") {
            expectedStatus = statuses[2];
          }
          return {
            ...inst,
            status: expectedStatus === "active" ? "active" : "inactive"
          };
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Start Deploy Handler
  const handleStartDeploy = async () => {
    if (!selectedDeployProtocol) return;

    // Generate credentials
    const newUuid = window.crypto?.randomUUID ? window.crypto.randomUUID() : "a" + Math.random().toString(36).substring(2, 10) + "-4f12-9012-" + Math.random().toString(36).substring(2, 12);
    const newPub = "pbk_" + Math.random().toString(36).substring(2, 15);
    const hostName = server.isDemo ? "demo.server.com" : server.host;

    // Cryptographic key generation for specific protocols
    const generateBase64Key = (bytes: number, urlSafe: boolean = false) => {
      const array = new Uint8Array(bytes);
      window.crypto.getRandomValues(array);
      let binary = "";
      for (let i = 0; i < array.byteLength; i++) {
        binary += String.fromCharCode(array[i]);
      }
      let b64 = btoa(binary);
      if (urlSafe) {
        b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
      return b64;
    };

    const isSs2022 = selectedDeployProtocol.id === "shadowsocks-2022";
    const ss2022Bytes = xraySsCipher.includes("128") ? 16 : 32;
    const ss2022Password = isSs2022 ? generateBase64Key(ss2022Bytes) : newUuid;
    const awgPrivateKey = selectedDeployProtocol.id === "amnezia-wg" ? generateBase64Key(32) : newUuid;

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
      // Real server: show what we're about to do, but do NOT claim success --
      // that only happens after the actual SSH script runs and we verify the
      // service is really active on the target machine.
      setDeployLogs((prev) => [...prev, ...preSteps, `[SSH] Выполнение установочного скрипта на сервере (может занять 1-3 минуты)...`]);
    }

    // Generate protocol specific standard link
    const actualFlow = xrayTransport === "tcp" ? xrayFlow : "none";
    const safeHost = hostName.includes(":") ? `[${hostName}]` : hostName;
    // Server/client names are free text (can contain spaces, parens, cyrillic, etc.) --
    // URI fragments must be percent-encoded per RFC 3986, or strict client parsers
    // (mobile deep-link handlers, QR scanners) will choke on or truncate the link.
    const encName = (s: string) => encodeURIComponent(s);
    let link = "";
    if (selectedDeployProtocol.id === "anytls") {
      link = `anytls://${newUuid}@${safeHost}:${deployPort}?sni=${deploySni}&insecure=1#${encName(`${server.name}-AnyTLS-sing-box`)}`;
    } else if (selectedDeployProtocol.id === "amnezia-wg") {
      link = `awg://${btoa(JSON.stringify({ v: awgVersion, host: safeHost, port: deployPort, uuid: awgPrivateKey, jc: awgJc, jmin: awgJmin, jmax: awgJmax, s1: awgS1, s2: awgS2, h1: awgH1, h2: awgH2, h3: awgH3, h4: awgH4 }))}#${encName(`${server.name}-AmneziaWG-v${awgVersion}`)}`;
    } else if (selectedDeployProtocol.id === "shadowsocks-2022") {
      link = `ss://${btoa(xraySsCipher + ":" + ss2022Password)}@${safeHost}:${deployPort}#${encName(`${server.name}-${deployClientName}`)}`;
    } else if (selectedDeployProtocol.id === "xray-vmess-ws") {
      const vmessTls = xraySecurity === "none" ? "" : xraySecurity;
      link = `vmess://${btoa(JSON.stringify({ v: "2", ps: `${server.name}-${deployClientName}`, add: safeHost, port: deployPort, id: newUuid, aid: 0, net: xrayTransport, type: "none", host: xrayWsHost || deploySni, path: xrayWsPath, tls: vmessTls, sni: deploySni }))}`;
    } else if (selectedDeployProtocol.id === "xray-trojan-grpc") {
      let query = `type=${xrayTransport}&security=${xraySecurity}&sni=${deploySni}`;
      if (xrayTransport === "grpc") query += `&serviceName=${xrayGrpcServiceName}`;
      if (xrayTransport === "ws") query += `&path=${encodeURIComponent(xrayWsPath)}${xrayWsHost ? `&host=${encodeURIComponent(xrayWsHost)}` : ""}`;
      link = `trojan://${newUuid}@${safeHost}:${deployPort}?${query}#${encName(`${server.name}-${deployClientName}`)}`;
    } else {
      // VLESS REALITY / VLESS TLS
      let query = `type=${xrayTransport}&security=${xraySecurity}&fp=${utlsFingerprint}&sni=${deploySni}`;
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
      }
      link = `vless://${newUuid}@${safeHost}:${deployPort}?${query}#${encName(`${server.name}-${deployClientName}`)}`;
    }

    // Real SSH Execution if server is not Demo
    if (!server.isDemo) {
      try {
        let configJson = "";
        if (selectedDeployProtocol.id === "anytls") {
          configJson = JSON.stringify({
            log: {
              level: "info",
              timestamp: true
            },
            inbounds: [
              {
                type: "anytls",
                tag: "anytls-in",
                listen: "::",
                listen_port: deployPort,
                users: [
                  {
                    name: deployClientName,
                    password: newUuid
                  }
                ],
                tls: {
                  enabled: true,
                  server_name: deploySni || "swdist.apple.com",
                  certificate_path: "/etc/sing-box/cert.crt",
                  key_path: "/etc/sing-box/cert.key"
                }
              }
            ],
            outbounds: [
              {
                type: "direct",
                tag: "direct"
              }
            ]
          }, null, 2);
        } else if (selectedDeployProtocol.id === "amnezia-wg") {
          configJson = JSON.stringify({
            Interface: {
              Address: "10.8.0.1/24",
              ListenPort: deployPort,
              PrivateKey: awgPrivateKey,
              ProtocolVersion: awgVersion,
              Jc: awgJc,
              Jmin: awgJmin,
              Jmax: awgJmax,
              S1: awgS1,
              S2: awgS2,
              H1: awgH1,
              H2: awgH2,
              H3: awgH3,
              H4: awgH4
            }
          }, null, 2);
        } else {
          // Full 3X-UI Xray Configuration Engine
          const expiryMs = xrayExpiryDays > 0 ? Date.now() + xrayExpiryDays * 24 * 60 * 60 * 1000 : 0;

          const destOverride: string[] = [];
          if (xraySniffingHttp) destOverride.push("http");
          if (xraySniffingTls) destOverride.push("tls");
          if (xraySniffingQuic) destOverride.push("quic");
          if (xraySniffingFakedns) destOverride.push("fakedns");

          let protoName = "vless";
          if (selectedDeployProtocol.id === "xray-vmess-ws") protoName = "vmess";
          else if (selectedDeployProtocol.id === "xray-trojan-grpc") protoName = "trojan";
          else if (selectedDeployProtocol.id === "shadowsocks-2022") protoName = "shadowsocks";

          let inboundSettings: any = {};
          if (protoName === "vless") {
            inboundSettings = {
              clients: [
                {
                  id: newUuid,
                  flow: actualFlow !== "none" ? actualFlow : undefined,
                  email: `${deployClientName}@3x-ui`,
                  limitIp: xrayIpLimit > 0 ? xrayIpLimit : 0,
                  totalGb: xrayTotalGb > 0 ? xrayTotalGb : 0,
                  expiryTime: expiryMs
                }
              ],
              decryption: "none"
            };
          } else if (protoName === "vmess") {
            inboundSettings = {
              clients: [
                {
                  id: newUuid,
                  alterId: 0,
                  email: `${deployClientName}@3x-ui`,
                  limitIp: xrayIpLimit > 0 ? xrayIpLimit : 0,
                  totalGb: xrayTotalGb > 0 ? xrayTotalGb : 0,
                  expiryTime: expiryMs
                }
              ]
            };
          } else if (protoName === "trojan") {
            inboundSettings = {
              clients: [
                {
                  password: newUuid,
                  email: `${deployClientName}@3x-ui`,
                  limitIp: xrayIpLimit > 0 ? xrayIpLimit : 0,
                  totalGb: xrayTotalGb > 0 ? xrayTotalGb : 0,
                  expiryTime: expiryMs
                }
              ]
            };
          } else if (protoName === "shadowsocks") {
            // Single-user mode: password lives at the top level (no clients[] wrapper).
            // Multi-user SS-2022 mode restricts ciphers to blake3-aes-*-gcm only on current
            // Xray-core, which would silently break the chacha20-poly1305 option -- and this
            // panel only ever provisions one client per install anyway.
            inboundSettings = {
              method: xraySsCipher,
              password: ss2022Password,
              email: `${deployClientName}@3x-ui`,
              network: "tcp,udp"
            };
          }

          let streamSettings: any = {
            network: xrayTransport,
            security: xraySecurity
          };

          if (xraySecurity === "reality") {
            streamSettings.realitySettings = {
              show: false,
              dest: xrayDest || `${deploySni}:443`,
              xver: 0,
              serverNames: [deploySni],
              privateKey: "PRIVATE_KEY_PLACEHOLDER", // Will be replaced by bash script
              shortIds: [xrayShortId || "6ba7b810"],
              fingerprint: utlsFingerprint
            };
          } else if (xraySecurity === "tls") {
            streamSettings.tlsSettings = {
              serverName: deploySni,
              alpn: xrayAlpn.split(",").map((s) => s.trim()),
              certificates: [
                {
                  certificateFile: "/etc/xray/cert.crt",
                  keyFile: "/etc/xray/cert.key"
                }
              ]
            };
          }

          if (xrayTransport === "grpc") {
            streamSettings.grpcSettings = {
              serviceName: xrayGrpcServiceName || "grpc-vless",
              multiMode: xrayGrpcMultiMode
            };
          } else if (xrayTransport === "ws") {
            streamSettings.wsSettings = {
              path: xrayWsPath || "/ws",
              headers: xrayWsHost ? { Host: xrayWsHost } : {}
            };
          }

          const routingRules: any[] = [];
          if (xrayBlockP2p) {
            routingRules.push({
              type: "field",
              protocol: ["bittorrent"],
              outboundTag: "block"
            });
          }
          if (xrayBlockAds) {
            routingRules.push({
              type: "field",
              outboundTag: "block",
              domain: ["geosite:category-ads-all"]
            });
          }
          if (xrayBlockPrivateIp) {
            routingRules.push({
              type: "field",
              outboundTag: "block",
              ip: ["geoip:private"]
            });
          }

          configJson = JSON.stringify({
            log: { loglevel: "warning" },
            inbounds: [
              {
                listen: "0.0.0.0",
                port: deployPort,
                protocol: protoName,
                settings: inboundSettings,
                streamSettings: streamSettings,
                sniffing: xraySniffing ? {
                  enabled: true,
                  destOverride: destOverride.length > 0 ? destOverride : ["http", "tls"],
                  metadataOnly: false,
                  routeOnly: xrayRouteOnly
                } : { enabled: false }
              }
            ],
            outbounds: [
              {
                protocol: "freedom",
                tag: "direct",
                settings: {
                  domainStrategy: xrayPreferIpv4 ? "UseIPv4" : xrayDomainStrategy
                }
              },
              {
                protocol: "blackhole",
                tag: "block",
                settings: { response: { type: "none" } }
              }
            ],
            routing: {
              domainStrategy: xrayDomainStrategy,
              rules: routingRules
            }
          }, null, 2);
        }

        const isUdp = selectedDeployProtocol.id === "amnezia-wg";
        let configPathPrefix = "/etc";
        let serviceDir = selectedDeployProtocol.id;
        let serviceName = selectedDeployProtocol.id;
        let configFile = "config.json";

        if (selectedDeployProtocol.id.includes("xray") || selectedDeployProtocol.id === "shadowsocks-2022") {
          configPathPrefix = "/usr/local/etc";
          serviceDir = "xray";
          serviceName = "xray";
        } else if (selectedDeployProtocol.id === "anytls") {
          configPathPrefix = "/etc";
          serviceDir = "sing-box";
          serviceName = "sing-box";
          configFile = "config.json";
        } else if (selectedDeployProtocol.id === "amnezia-wg") {
          serviceDir = "amnezia/amneziawg"; // Standard for awg-quick
          serviceName = "awg-quick@awg0";
          configFile = "awg0.conf";
        }

        const bashScript = `
          # Base packages setup
          sudo apt-get update -y && sudo apt-get install -y curl wget jq unzip ufw software-properties-common openssl iptables
          
          # Kernel & Network Tuning: IP Forwarding + BBR Congestion Control
          sudo sysctl -w net.ipv4.ip_forward=1
          sudo sysctl -w net.core.default_qdisc=fq
          sudo sysctl -w net.ipv4.tcp_congestion_control=bbr
          sudo mkdir -p /etc/sysctl.d
          echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.d/99-vpn.conf >/dev/null
          echo "net.core.default_qdisc=fq" | sudo tee -a /etc/sysctl.d/99-vpn.conf >/dev/null
          echo "net.ipv4.tcp_congestion_control=bbr" | sudo tee -a /etc/sysctl.d/99-vpn.conf >/dev/null
          sudo sysctl -p /etc/sysctl.d/99-vpn.conf 2>/dev/null || true

          # Firewall UFW rule
          sudo ufw allow ${deployPort}/${isUdp ? "udp" : "tcp"} 2>/dev/null || true

          ${selectedDeployProtocol.id.includes("xray") || selectedDeployProtocol.id === "shadowsocks-2022" ? `
          # Install official Xray-core release (XTLS/Xray-install)
          bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install -u root
          
          # Ensure directories and fallback self-signed SSL cert for TLS modes
          sudo mkdir -p /etc/xray /usr/local/etc/xray
          if [ ! -f /etc/xray/cert.crt ]; then
            sudo openssl req -x509 -newkey rsa:2048 -nodes -keyout /etc/xray/cert.key -out /etc/xray/cert.crt -days 3650 -subj "/CN=${deploySni}" 2>/dev/null || true
          fi
          ` : ""}

          ${selectedDeployProtocol.id === "anytls" ? `
          # Install official sing-box Core for AnyTLS from official SagerNet repository
          echo "[sing-box] Installing latest official sing-box core for AnyTLS..."
          sudo mkdir -p /etc/sing-box /usr/local/bin

          # AnyTLS is always TLS-wrapped on the wire (tls is a required inbound field) --
          # generate a self-signed cert if we don't already have one, same as the xray path.
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
                rm -rf /tmp/sing-box*
              fi
            }
          fi

          # Systemd unit for sing-box AnyTLS
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
          ` : ""}

          ${selectedDeployProtocol.id === "amnezia-wg" ? `
          # Install AmneziaWG 2.0 -- primary: official PPA (kernel module via DKMS + tools)
          echo "[AWG] Installing via official ppa:amnezia/ppa ..."
          sudo add-apt-repository -y ppa:amnezia/ppa 2>/dev/null || true
          sudo apt-get update -y 2>/dev/null || true
          if sudo apt-get install -y amneziawg amneziawg-tools amneziawg-dkms 2>/dev/null; then
            echo "[AWG] Installed via official PPA (kernel module + tools + systemd unit)"
          else
            echo "[AWG] PPA install failed on this distro -- falling back to prebuilt awg/awg-quick binaries from amnezia-vpn/amneziawg-tools releases"
            AWG_URL=$(curl -s https://api.github.com/repos/amnezia-vpn/amneziawg-tools/releases/latest | jq -r '.assets[] | select(.name | test("ubuntu")) | .browser_download_url' 2>/dev/null | head -n 1)
            if [ -n "$AWG_URL" ] && [ "$AWG_URL" != "null" ]; then
              curl -sL "$AWG_URL" -o /tmp/awgtools.zip
              mkdir -p /tmp/awgtools && (cd /tmp/awgtools && unzip -o /tmp/awgtools.zip >/dev/null 2>&1)
              AWG_BIN=$(find /tmp/awgtools -type f -name "awg" | head -n 1)
              AWGQ_BIN=$(find /tmp/awgtools -type f -name "awg-quick" | head -n 1)
              [ -n "$AWG_BIN" ] && sudo install -m 755 "$AWG_BIN" /usr/bin/awg
              [ -n "$AWGQ_BIN" ] && sudo install -m 755 "$AWGQ_BIN" /usr/bin/awg-quick
              find /tmp/awgtools -delete 2>/dev/null || true
              find /tmp/awgtools.zip -delete 2>/dev/null || true
              echo "[AWG] WARNING: fallback tools installed, but the kernel module (DKMS) was NOT installed since the PPA step failed -- awg-quick needs it (or an amneziawg-go userspace daemon, which currently has no official prebuilt release). The service may not come up on unsupported distros."
            else
              echo "[AWG] ERROR: could not fetch fallback binaries either -- no PPA package and no matching GitHub release asset."
            fi
            # The apt package normally ships this template unit -- write it ourselves for the fallback path
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
          ` : ""}

          # Write protocol configuration
          sudo mkdir -p ${configPathPrefix}/${serviceDir}
          echo '${configJson}' | sudo tee ${configPathPrefix}/${serviceDir}/${configFile} > /dev/null
          if [ "${serviceDir}" = "xray" ]; then
            echo '${configJson}' | sudo tee /etc/xray/config.json > /dev/null 2>&1 || true
          fi
          
          ${selectedDeployProtocol.id === "xray-vless-reality" ? `
          # Generate valid REALITY keypair on the server
          XRAY_BIN=$(which xray 2>/dev/null || echo "/usr/local/bin/xray")
          $XRAY_BIN x25519 > /tmp/xray_keys 2>/dev/null || true
          # Current Xray-core prints "PrivateKey: ..." / "Password (PublicKey): ..." (no space,
          # different label than older releases which used "Private key:" / "Public key:").
          # Match both formats robustly instead of relying on a fixed column/label.
          SERVER_PRIV=$(grep -iE "Private ?Key\\)?:" /tmp/xray_keys 2>/dev/null | awk -F': ' '{print $2}' | tr -d ' \\r')
          SERVER_PUB=$(grep -iE "Public ?Key\\)?:" /tmp/xray_keys 2>/dev/null | awk -F': ' '{print $2}' | tr -d ' \\r')
          if [ -n "$SERVER_PRIV" ]; then
            sudo sed -i "s/PRIVATE_KEY_PLACEHOLDER/$SERVER_PRIV/g" ${configPathPrefix}/${serviceDir}/${configFile}
            sudo sed -i "s/PRIVATE_KEY_PLACEHOLDER/$SERVER_PRIV/g" /etc/xray/config.json 2>/dev/null || true
            echo "XRAY_REALITY_PUB:$SERVER_PUB"
          fi
          ` : ""}

          sudo systemctl daemon-reload 2>/dev/null || true
          sudo systemctl enable ${serviceName} 2>/dev/null || true
          sudo systemctl restart ${serviceName} 2>/dev/null || true

          sleep 2
          echo "SERVICE_STATUS:$(sudo systemctl is-active ${serviceName} 2>/dev/null || echo inactive)"
        `;

        let res;
        try {
          res = await execCommand(server, bashScript);
        } catch (err: any) {
          setIsDeploying(false);
          setDeployLogs((prev) => [...prev, `[ERROR] Не удалось выполнить SSH-соединение: ${err?.message || "неизвестная ошибка"}`]);
          toast.error(`Деплой не удался: ${err?.message || "ошибка SSH-соединения"}`);
          return;
        }

        const statusMatch = res.stdout?.match(/SERVICE_STATUS:(\w+)/);
        const serviceIsActive = !!statusMatch && statusMatch[1] === "active";

        if (!serviceIsActive) {
          setIsDeploying(false);
          const tail = (res.stderr || res.stdout || "Нет вывода").slice(-1000);
          setDeployLogs((prev) => [...prev, `[ERROR] Служба ${serviceName} не запустилась после установки.`, tail]);
          toast.error(`Деплой не удался: служба ${serviceName} не активна. Проверьте вывод в логе установки.`);
          return;
        }

        setDeployLogs((prev) => [...prev, `[SUCCESS] Служба ${serviceName} активна и запущена на сервере.`]);

        if (res.stdout && res.stdout.includes("XRAY_REALITY_PUB:")) {
          const match = res.stdout.match(/XRAY_REALITY_PUB:([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            link = link.replace(/pbk=[^&#]+/, `pbk=${match[1]}`);
          }
        }
      } catch (err: any) {
        setIsDeploying(false);
        setDeployLogs((prev) => [...prev, `[ERROR] Ошибка при подготовке деплоя: ${err?.message || "неизвестная ошибка"}`]);
        toast.error(`Деплой не удался: ${err?.message || "неизвестная ошибка"}`);
        return;
      }
    }

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
      uptime: "Только что запущен",
      trafficRxGb: 0.1,
      trafficTxGb: 0.2,
      activeClientsCount: 1,
      installedAt: new Date().toISOString().split("T")[0],
      version: selectedDeployProtocol.version,
      configPath: `/etc/${selectedDeployProtocol.id}/config.json`,
    };

    setInstalledServices((prev) => [newInst, ...prev]);
    setDeploySuccessService(newInst);
    setIsDeploying(false);
  };

  // Toggle service status
  const handleToggleService = async (id: string) => {
    const srv = installedServices.find((s) => s.id === id);
    if (!srv) return;

    const nextStatus = srv.status === "active" ? "inactive" : "active";
    const action = nextStatus === "active" ? "start" : "stop";

    if (!server.isDemo) {
      try {
        let systemdService = srv.protocolId;
        if (srv.protocolId.includes("xray") || srv.protocolId === "shadowsocks-2022") {
          systemdService = "xray";
        } else if (srv.protocolId === "anytls") {
          systemdService = "anytls";
        } else if (srv.protocolId === "amnezia-wg") {
          systemdService = "awg-quick@awg0";
        }
        await execCommand(server, `sudo systemctl ${action} ${systemdService}`);
      } catch (err) {
        console.error("Failed to toggle service", err);
      }
    }

    setInstalledServices((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return { ...s, status: nextStatus };
        }
        return s;
      })
    );
  };

  // Copy helper
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10 shrink-0">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-2xl font-black text-white tracking-tight">
                    ВПН Менеджер
                  </h1>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
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
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Активно на сервере</div>
                <div className="text-[11px] sm:text-xs font-bold text-emerald-300 font-mono">
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
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
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
              <Server className={`w-4 h-4 shrink-0 ${activeTab === "installed" ? "text-emerald-400" : ""}`} />
              <span className="hidden sm:inline">Установленные ВПН</span>
              <span className="sm:hidden text-[11px]">Мои ВПН</span>
              {installedServices.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono ${activeTab === "installed" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
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
              <Zap className="w-4 h-4 text-emerald-400" />
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
                    ? "border-emerald-500/40 hover:border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.12)]"
                    : "border-slate-800/80 hover:border-slate-700 shadow-slate-950/50"
                }`}
              >
                <div className={`absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br ${protocol.gradient} rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition duration-500 pointer-events-none`} />

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[9px] sm:text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-xl border ${
                      protocol.isPopular 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                        : "bg-slate-800/60 text-slate-300 border-slate-700/60"
                    }`}>
                      {protocol.badge}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800/80 px-2 py-0.5 rounded-lg font-mono">
                      {protocol.version}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
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
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-cyan-400" /> SNI: <strong className="text-slate-200 truncate max-w-[100px]">{protocol.defaultSni}</strong></span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDeployProtocol(protocol);
                      setDeployPort(protocol.defaultPort);
                      setDeploySni(protocol.defaultSni);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-[0_4px_15px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.4)] transition-all active:scale-95"
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
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Активные ВПН службы</span>
              </h2>
              <p className="text-[11px] text-slate-400">Мониторинг и управление активными нодами на сервере</p>
            </div>
            <button
              onClick={checkServerVpnStatus}
              className="group text-xs text-slate-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-xl transition-all"
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
                <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent ${service.status === "active" ? "via-emerald-500" : "via-rose-500"} to-transparent`} />

                {/* Main service header & control block */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-11 h-11 bg-slate-950 border border-slate-800 rounded-2xl shrink-0">
                      <ShieldCheck className={`w-5 h-5 ${service.status === "active" ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "text-slate-500"}`} />
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-slate-900 rounded-full ${service.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">{service.name}</h3>
                        <span className="text-[9px] font-mono bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded-md">
                          {service.version}
                        </span>
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
                          : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
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
                      onClick={() => setQrModalService(service)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-white text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <QrCode className="w-3.5 h-3.5 text-cyan-700" />
                      <span>Ключ / QR</span>
                    </button>
                  </div>
                </div>

                {/* Mobile-first 2x2 / 4-column metrics block */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3 shadow-inner">
                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Статус</div>
                    <div className="text-xs font-bold flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${service.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                      <span className={service.status === "active" ? "text-emerald-400" : "text-rose-400"}>
                        {service.status === "active" ? "Активен" : "Остановлен"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Трафик</div>
                    <div className="text-xs font-mono font-bold text-amber-300">
                      {(service.trafficRxGb + service.trafficTxGb).toFixed(1)} GB
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Клиенты</div>
                    <div className="text-xs font-mono font-bold text-cyan-300">
                      {service.activeClientsCount} активн.
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Аптайм</div>
                    <div className="text-xs font-mono font-bold text-slate-300 truncate">
                      {service.uptime}
                    </div>
                  </div>
                </div>

                {/* Client Link Row */}
                <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    Конфиг: <span className="text-slate-300">{service.configPath}</span>
                  </div>
                  
                  <div className="relative flex items-center w-full sm:max-w-md">
                    <input
                      type="text"
                      readOnly
                      value={service.clientLink}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-24 py-2 text-[10px] text-emerald-300 font-mono truncate focus:outline-none focus:border-slate-700"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => handleCopyText(service.clientLink)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition text-[10px] font-bold flex items-center gap-1 border border-slate-700"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? "Скопировано" : "Копировать"}</span>
                    </button>
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
                      <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Рекомендуемые bash-команды для выполнения на сервере:</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.suggestedFixes.map((cmd, i) => (
                          <div
                            key={i}
                            className="bg-slate-950 border border-slate-800/90 rounded-xl p-2.5 flex items-center justify-between gap-2 font-mono text-[11px] text-emerald-300"
                          >
                            <span className="truncate">{cmd}</span>
                            <button
                              onClick={() => handleExecuteFix(cmd)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-[10px] rounded-lg transition shrink-0"
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
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <RocketIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Авто-деплой: {selectedDeployProtocol.name}
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-semibold mb-1 block">Внешний Порт</label>
                      <input
                        type="number"
                        value={deployPort}
                        onChange={(e) => setDeployPort(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-semibold mb-1 block">SNI Маскировка</label>
                      <input
                        type="text"
                        value={deploySni}
                        onChange={(e) => setDeploySni(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
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
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                              : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AnyTLS Protocol doesn't require extra UI options for its reference implementation */}

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
                            <span className="text-emerald-400 font-semibold leading-tight">
                              ✓ Включена двойная обфускация handshake-пакетов v2.0 и защита от систем фильтрации 2026 года.
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold leading-tight">
                              ⚠️ Режим совместимости v1.0 для старых клиентов WireGuard.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Presets */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold block">Готовые пресеты маскировки AmneziaWG:</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAwgVersion("2.0");
                              setAwgJc(5); setAwgJmin(50); setAwgJmax(90);
                              setAwgS1(20); setAwgS2(25);
                              setAwgH1(1); setAwgH2(2); setAwgH3(3); setAwgH4(4);
                            }}
                            className="px-2 py-1.5 rounded-lg border bg-amber-950/40 border-amber-500/50 text-amber-300 text-[10px] font-bold transition text-center hover:bg-amber-900/50"
                          >
                            🛡️ ТСПУ 2.0 Stealth (v2.0)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAwgVersion("2.0");
                              setAwgJc(9); setAwgJmin(140); setAwgJmax(280);
                              setAwgS1(40); setAwgS2(50);
                              setAwgH1(18); setAwgH2(32); setAwgH3(41); setAwgH4(55);
                            }}
                            className="px-2 py-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/40 hover:text-amber-300 text-[10px] font-bold transition text-center"
                          >
                            🔒 Усиленный 2.0 (Max Junk)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAwgVersion("2.0");
                              setAwgJc(2); setAwgJmin(15); setAwgJmax(30);
                              setAwgS1(8); setAwgS2(8);
                              setAwgH1(1); setAwgH2(2); setAwgH3(3); setAwgH4(4);
                            }}
                            className="px-2 py-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/40 hover:text-amber-300 text-[10px] font-bold transition text-center"
                          >
                            ⚡ Высокая скорость v2.0
                          </button>
                        </div>
                      </div>

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

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
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
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                          Magic Headers (H1, H2, H3, H4 - подмена заголовков Handshake):
                        </span>
                        <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                          <div>
                            <span className="text-[9px] text-slate-500 block">H1 (Init)</span>
                            <input
                              type="number"
                              value={awgH1}
                              onChange={(e) => setAwgH1(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">H2 (Resp)</span>
                            <input
                              type="number"
                              value={awgH2}
                              onChange={(e) => setAwgH2(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">H3 (Cookie)</span>
                            <input
                              type="number"
                              value={awgH3}
                              onChange={(e) => setAwgH3(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">H4 (Data)</span>
                            <input
                              type="number"
                              value={awgH4}
                              onChange={(e) => setAwgH4(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-1 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3X-UI FULL XRAY CONTROL PANEL */}
                  {(selectedDeployProtocol.id.startsWith("xray-") || selectedDeployProtocol.id === "shadowsocks-2022") && (
                    <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-3.5 space-y-3.5 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                          <Sliders className="w-4 h-4" />
                          <span>Панель управления Xray (3X-UI Panel):</span>
                        </div>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40 px-2 py-0.5 rounded-md">
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
                              ? "bg-emerald-500 text-slate-950 font-bold"
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
                              ? "bg-emerald-500 text-slate-950 font-bold"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          👤 Лимиты
                        </button>
                        <button
                          type="button"
                          onClick={() => setXrayPanelSubTab("sniffing")}
                          className={`py-1 rounded-lg transition ${
                            xrayPanelSubTab === "sniffing"
                              ? "bg-emerald-500 text-slate-950 font-bold"
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
                              ? "bg-emerald-500 text-slate-950 font-bold"
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
                            <span className="text-[10px] text-emerald-400 font-bold block">Быстрые пресеты конфигураций 3X-UI:</span>
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
                                className="bg-slate-950 hover:bg-emerald-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-emerald-500/40 transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-white">🛡️ REALITY + gRPC</div>
                                  <div className="text-slate-400">Обход ТСПУ & DPI</div>
                                </div>
                                <span className="text-emerald-400 text-[8px] bg-emerald-500/10 px-1 py-0.5 rounded">Recom</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setXrayTransport("tcp");
                                  setXraySecurity("reality");
                                  setXrayFlow("xtls-rprx-vision");
                                  setUtlsFingerprint("chrome");
                                }}
                                className="bg-slate-950 hover:bg-emerald-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-emerald-500/40 transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-white">⚡ REALITY + TCP Vision</div>
                                  <div className="text-slate-400">Максимальная скорость</div>
                                </div>
                                <span className="text-cyan-400 text-[8px] bg-cyan-500/10 px-1 py-0.5 rounded">Fast</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setXrayTransport("ws");
                                  setXraySecurity("tls");
                                  setXrayWsPath("/ws");
                                  setXrayWsHost("");
                                }}
                                className="bg-slate-950 hover:bg-emerald-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-emerald-500/40 transition flex items-center justify-between"
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
                                className="bg-slate-950 hover:bg-emerald-950/40 text-left p-1.5 rounded-lg border border-slate-800 hover:border-emerald-500/40 transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-white">🔑 Trojan + gRPC</div>
                                  <div className="text-slate-400">TLS Шифрование</div>
                                </div>
                                <span className="text-indigo-400 text-[8px] bg-indigo-500/10 px-1 py-0.5 rounded">TLS</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-slate-400 font-semibold mb-1 block">Транспорт (Network)</label>
                              <select
                                value={xrayTransport}
                                onChange={(e: any) => setXrayTransport(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500 text-[11px]"
                              >
                                <option value="grpc">gRPC (Ultra stealth stream)</option>
                                <option value="tcp">TCP (Standard Direct)</option>
                                <option value="ws">WebSocket (Cloudflare CDN support)</option>
                                <option value="http">HTTP/2 (H2 Multiplex)</option>
                                <option value="quic">QUIC (UDP Stream)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-slate-400 font-semibold mb-1 block">Шифрование (Security)</label>
                              <select
                                value={xraySecurity}
                                onChange={(e: any) => setXraySecurity(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500 text-[11px]"
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
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500 text-[11px]"
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
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500 text-[11px]"
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
                                <span className="text-emerald-400 font-semibold">Параметры REALITY TLS:</span>
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
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-emerald-300 font-mono"
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
                            </div>
                          )}

                          {xrayTransport === "grpc" && (
                            <div>
                              <label className="text-slate-400 font-semibold mb-1 block">gRPC Service Name</label>
                              <input
                                type="text"
                                value={xrayGrpcServiceName}
                                onChange={(e) => setXrayGrpcServiceName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                              />
                            </div>
                          )}

                          {xrayTransport === "ws" && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-slate-400 font-semibold mb-1 block">WebSocket Path</label>
                                <input
                                  type="text"
                                  value={xrayWsPath}
                                  onChange={(e) => setXrayWsPath(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="text-slate-400 font-semibold mb-1 block">WS Host Header</label>
                                <input
                                  type="text"
                                  value={xrayWsHost}
                                  onChange={(e) => setXrayWsHost(e.target.value)}
                                  placeholder="cloudflare.com"
                                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
                                />
                              </div>
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

                      {/* SUB-TAB 2: CLIENT LIMITS & QUOTAS */}
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
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                              <label className="text-slate-400 block mb-0.5 font-semibold">Лимит трафика (GB)</label>
                              <input
                                type="number"
                                min={0}
                                value={xrayTotalGb}
                                onChange={(e) => setXrayTotalGb(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                              />
                              <span className="text-[9px] text-slate-500">0 = Безлимит</span>
                            </div>

                            <div>
                              <label className="text-slate-400 block mb-0.5 font-semibold">Срок действия (Дни)</label>
                              <input
                                type="number"
                                min={0}
                                value={xrayExpiryDays}
                                onChange={(e) => setXrayExpiryDays(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                              />
                              <span className="text-[9px] text-slate-500">0 = Бессрочно</span>
                            </div>

                            <div>
                              <label className="text-slate-400 block mb-0.5 font-semibold">Лимит IP подключений</label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                value={xrayIpLimit}
                                onChange={(e) => setXrayIpLimit(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                              />
                              <span className="text-[9px] text-slate-500">0 = Без ограничений</span>
                            </div>
                          </div>

                          <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-2.5 text-[10px] text-amber-300 leading-relaxed">
                            ⚠️ Эти лимиты пишутся в конфиг, но <strong>не применяются</strong> ванильным Xray-core (устанавливается официальным install-release.sh) —
                            он их просто игнорирует. Реальный учёт трафика/срока/IP требует панели 3X-UI с собственным API-демоном,
                            либо отдельного сервиса на этом сервере, который читает статистику Xray и сам отключает клиента. Сейчас это не реализовано.
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
                              className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
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
                                    className="rounded border-slate-700 text-emerald-500 bg-slate-950"
                                  />
                                  <span>TLS / HTTPS</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={xraySniffingHttp}
                                    onChange={(e) => setXraySniffingHttp(e.target.checked)}
                                    className="rounded border-slate-700 text-emerald-500 bg-slate-950"
                                  />
                                  <span>HTTP</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={xraySniffingQuic}
                                    onChange={(e) => setXraySniffingQuic(e.target.checked)}
                                    className="rounded border-slate-700 text-emerald-500 bg-slate-950"
                                  />
                                  <span>QUIC (HTTP/3)</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={xraySniffingFakedns}
                                    onChange={(e) => setXraySniffingFakedns(e.target.checked)}
                                    className="rounded border-slate-700 text-emerald-500 bg-slate-950"
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
                                  className="rounded border-slate-700 text-emerald-500 bg-slate-950 cursor-pointer"
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
                                className="rounded border-slate-700 text-emerald-500 bg-slate-950"
                              />
                            </label>

                            <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                              <span>🛡️ Блокировать рекламные домены (geosite:ads)</span>
                              <input
                                type="checkbox"
                                checked={xrayBlockAds}
                                onChange={(e) => setXrayBlockAds(e.target.checked)}
                                className="rounded border-slate-700 text-emerald-500 bg-slate-950"
                              />
                            </label>

                            <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                              <span>🔒 Блокировка приватных IP сетей (SSRF Shield)</span>
                              <input
                                type="checkbox"
                                checked={xrayBlockPrivateIp}
                                onChange={(e) => setXrayBlockPrivateIp(e.target.checked)}
                                className="rounded border-slate-700 text-emerald-500 bg-slate-950"
                              />
                            </label>

                            <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                              <span>⚡ IPv4 Приоритет для стриминга (Netflix / YT)</span>
                              <input
                                type="checkbox"
                                checked={xrayPreferIpv4}
                                onChange={(e) => setXrayPreferIpv4(e.target.checked)}
                                className="rounded border-slate-700 text-emerald-500 bg-slate-950"
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
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950"
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
                      className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition"
                    >
                      Начать автоматический деплой
                    </button>
                  </div>
                </div>
              )}

              {/* Progress Terminal Logger */}
              {isDeploying && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Выполнение установки на SSH сервере...</span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 space-y-2 max-h-64 overflow-y-auto">
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
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto animate-bounce" />
                    <h4 className="font-extrabold text-emerald-300 text-sm">
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
                        className="text-emerald-400 font-bold flex items-center gap-1"
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
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-center"
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
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
              
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <div className="p-2 bg-cyan-500/10 rounded-xl">
                    <QrCode className="w-4 h-4 text-cyan-400" />
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
                  <span className="text-emerald-400 font-mono text-[11px] truncate max-w-[150px]">{qrModalService.uuid}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleCopyText(qrModalService.clientLink)}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-2xl transition-all shadow-[0_4px_20px_rgba(6,182,212,0.3)] active:scale-95 flex items-center justify-center gap-2"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? "Скопировано!" : "Скопировать ключ доступа"}</span>
                </button>
              </div>
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

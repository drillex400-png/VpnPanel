export interface SSHConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  privateKey?: string;
  color?: string;
  isDemo?: boolean;
  tags?: string[];
  lastConnected?: string;
}

export interface SystemMetrics {
  timestamp: string;
  connectionError?: string;
  os: {
    hostname: string;
    distro: string;
    kernel: string;
    arch: string;
    uptime: string;
  };
  cpu: {
    usagePct: number;
    cores: number;
    model: string;
    loadAvg: [number, number, number];
  };
  memory: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
    cachedMb: number;
    swapTotalMb: number;
    swapUsedMb: number;
  };
  disk: {
    filesystem: string;
    mount: string;
    sizeGb: number;
    usedGb: number;
    availGb: number;
    usePct: number;
  }[];
  network: {
    rxKbps: number;
    txKbps: number;
    activeConnections: number;
  };
}

export interface ProcessItem {
  pid: number;
  user: string;
  cpuPct: number;
  memPct: number;
  vsz: string;
  rss: string;
  tty: string;
  stat: string;
  start: string;
  time: string;
  command: string;
}

export interface ServiceItem {
  name: string;
  unit: string;
  load: string;
  active: "active" | "inactive" | "failed" | "activating" | string;
  sub: string;
  description: string;
}

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: string;
  permissions: string;
  owner: string;
  group: string;
  modified: string;
  extension?: string;
}

export interface FirewallRule {
  id: string;
  port: string;
  protocol: "tcp" | "udp" | "any";
  action: "ALLOW" | "DENY" | "REJECT";
  from: string;
  comment?: string;
}

export interface CronJob {
  id: string;
  schedule: string;
  minute: string;
  hour: string;
  dayMonth: string;
  month: string;
  dayWeek: string;
  command: string;
  user: string;
  enabled: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  level: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
}

export interface UserAccount {
  username: string;
  uid: number;
  gid: number;
  comment: string;
  homeDir: string;
  shell: string;
  isSudoer: boolean;
}

export interface SoftwarePackageStatus {
  installed: boolean;
  version: string | null;
  active: boolean; // systemctl is-active === "active" (n/a for CLI-only tools like the docker client)
  extra?: string | null; // secondary version info, e.g. Docker Compose version
}

export type VPNProtocolId =
  | "xray-vless-reality"
  | "anytls"
  | "xray-vmess-ws"
  | "xray-trojan-grpc"
  | "shadowsocks-2022"
  | "amnezia-wg";

export interface VPNProtocolCatalog {
  id: VPNProtocolId;
  name: string;
  badge: string;
  version: string;
  description: string;
  defaultPort: number;
  defaultSni: string;
  securityRating: "ЭЛИТНЫЙ" | "ВЫСОКИЙ" | "СЕДНИЙ";
  obfuscationLevel: "DPI Proof" | "TLS Proxy" | "CDN Fast" | "AEAD 2022" | "UDP Stealth";
  features: string[];
  recommendedApps: string[];
  gradient: string;
  isPopular?: boolean;
}

export interface InstalledVPNService {
  id: string;
  protocolId: VPNProtocolId;
  name: string;
  status: "active" | "inactive" | "error" | "deploying";
  port: number;
  sni: string;
  uuid: string;
  publicKey?: string;
  clientLink: string;
  uptime: string;
  trafficRxGb: number;
  trafficTxGb: number;
  activeClientsCount: number;
  installedAt: string;
  version: string;
  configPath: string;
}

export interface VPNAssistantMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  severity?: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
  suggestedFixes?: string[];
  codeSnippet?: string;
}

export type TabType = 
  | "dashboard" 
  | "vpn"
  | "files" 
  | "processes" 
  | "services" 
  | "firewall" 
  | "logs" 
  | "terminal" 
  | "tools";

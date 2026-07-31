import React, { useState, useEffect, Suspense, lazy } from "react";
import { TabType, SSHConfig, SystemMetrics } from "./types";
import {
  getSavedServers,
  saveServerProfile,
  deleteServerProfile,
  fetchMetrics,
  DEMO_SERVER_CONFIG,
} from "./services/api";
import { useLiveMetrics } from "./hooks/useLiveMetrics";
import { useAuth } from "./contexts/AuthContext";
import { useToast } from "./contexts/ToastContext";
import { LoginPage } from "./components/LoginPage";
import { ToastContainer } from "./components/ToastContainer";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
// Dashboard is the tab every user lands on first, so it stays eagerly bundled -- no point
// showing a loading flash for the very first thing they see. Every other tab is fetched on
// demand via React.lazy(), so opening the app no longer downloads the VPN protocol engine,
// the file manager, the terminal, etc. before the user has even picked a tab.
import { DashboardView } from "./components/DashboardView";
import { ServerConnectModal } from "./components/ServerConnectModal";
import { Loader2 } from "lucide-react";

const VPNView = lazy(() => import("./components/VPNView").then((m) => ({ default: m.VPNView })));
const FileManagerView = lazy(() => import("./components/FileManagerView").then((m) => ({ default: m.FileManagerView })));
const ProcessesView = lazy(() => import("./components/ProcessesView").then((m) => ({ default: m.ProcessesView })));
const ServicesView = lazy(() => import("./components/ServicesView").then((m) => ({ default: m.ServicesView })));
const FirewallView = lazy(() => import("./components/FirewallView").then((m) => ({ default: m.FirewallView })));
const LogsView = lazy(() => import("./components/LogsView").then((m) => ({ default: m.LogsView })));
const TerminalView = lazy(() => import("./components/TerminalView").then((m) => ({ default: m.TerminalView })));
const ToolsView = lazy(() => import("./components/ToolsView").then((m) => ({ default: m.ToolsView })));

// Lightweight, theme-matching fallback shown for the brief moment a lazy tab's chunk is
// being fetched -- avoids a jarring blank flash between tab click and content appearing.
const ViewLoadingFallback = () => (
  <div className="flex items-center justify-center py-24 text-slate-500">
    <Loader2 className="w-6 h-6 animate-spin text-emerald-400/70" />
  </div>
);

function Dashboard() {
  const toast = useToast();
  const { user, logout } = useAuth();

  const [servers, setServers] = useState<SSHConfig[]>([DEMO_SERVER_CONFIG]);
  const [serversLoaded, setServersLoaded] = useState(false);
  const [currentServer, setCurrentServer] = useState<SSHConfig>(DEMO_SERVER_CONFIG);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Load server profiles from the backend once on mount
  useEffect(() => {
    (async () => {
      const loaded = await getSavedServers();
      setServers(loaded);
      setCurrentServer(loaded[0] || DEMO_SERVER_CONFIG);
      setServersLoaded(true);
    })();
  }, []);

  // Real-time metrics -- streamed live over WebSocket (one pooled SSH connection per server on
  // the backend) instead of the previous 4s HTTP poll. See src/hooks/useLiveMetrics.ts.
  const DEFAULT_METRICS: SystemMetrics = {
    timestamp: "Just now",
    os: {
      hostname: "ubuntu-prod-srv01",
      distro: "Ubuntu 24.04.1 LTS",
      kernel: "6.5.0-28-generic",
      arch: "x86_64",
      uptime: "14 days, 6 hours, 30 mins",
    },
    cpu: {
      usagePct: 24,
      cores: 8,
      model: "AMD EPYC 7763 64-Core Processor",
      loadAvg: [0.42, 0.38, 0.35],
    },
    memory: {
      totalMb: 16384,
      usedMb: 6240,
      freeMb: 10144,
      cachedMb: 4120,
      swapTotalMb: 4096,
      swapUsedMb: 124,
    },
    disk: [
      { filesystem: "/dev/sda1", mount: "/", sizeGb: 100, usedGb: 42, availGb: 58, usePct: 42 },
      { filesystem: "/dev/sda2", mount: "/var/data", sizeGb: 500, usedGb: 180, availGb: 320, usePct: 36 },
      { filesystem: "/dev/nvme0n1p1", mount: "/home", sizeGb: 1000, usedGb: 310, availGb: 690, usePct: 31 },
    ],
    network: {
      rxKbps: 240,
      txKbps: 680,
      activeConnections: 24,
    },
  };

  const { metrics: liveMetrics, connectionError, latencyMs } = useLiveMetrics(currentServer);
  const metrics = liveMetrics || DEFAULT_METRICS;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastWarnedError = React.useRef<string | undefined>(undefined);

  useEffect(() => {
    if (connectionError && connectionError !== lastWarnedError.current) {
      toast.warning("Проблема с подключением", connectionError);
      lastWarnedError.current = connectionError;
    }
    if (!connectionError) lastWarnedError.current = undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionError]);

  // Manual "refresh" button: the WS stream already pushes every 4s, so this just forces one
  // extra one-off fetch for instant user-visible feedback without waiting for the next tick.
  const loadLiveMetrics = async () => {
    setIsRefreshing(true);
    await fetchMetrics(currentServer);
    setIsRefreshing(false);
  };

  const handleSaveServer = async (newServer: SSHConfig) => {
    try {
      const updated = await saveServerProfile(newServer);
      setServers(updated);
      // The backend assigns the real id on create — pick the most recently touched matching profile
      const saved = updated.find((s) => s.host === newServer.host && s.username === newServer.username) || updated[0];
      setCurrentServer(saved);
      toast.success("Сервер сохранён", `«${newServer.name}» добавлен в список подключений`);
    } catch (e: any) {
      toast.error("Не удалось сохранить сервер", e?.message);
    }
  };

  const handleDeleteServer = async (id: string) => {
    try {
      const updated = await deleteServerProfile(id);
      setServers(updated);
      if (currentServer.id === id) {
        setCurrentServer(updated[0] || DEMO_SERVER_CONFIG);
      }
      toast.success("Сервер удалён");
    } catch (e: any) {
      toast.error("Не удалось удалить сервер", e?.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] bg-radial-glow text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black relative">
      <ToastContainer />

      {/* Top App Header */}
      <Header
        currentServer={currentServer}
        servers={servers}
        onSelectServer={(srv) => setCurrentServer(srv)}
        onOpenConnectModal={() => setShowConnectModal(true)}
        onDeleteServer={handleDeleteServer}
        isRefreshing={isRefreshing}
        onManualRefresh={loadLiveMetrics}
        latencyMs={latencyMs}
        currentUser={user}
        onLogout={logout}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Navigation Bar (Desktop Sidebar & Mobile Bottom Tabs) */}
        <Navigation
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          failedServicesCount={1}
          criticalLogsCount={1}
        />

        {/* Viewport Canvas */}
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto pb-24 lg:pb-8">
          {activeTab === "dashboard" && (
            <DashboardView
              metrics={metrics}
              server={currentServer}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onRefresh={loadLiveMetrics}
            />
          )}

          <Suspense fallback={<ViewLoadingFallback />}>
            {activeTab === "vpn" && <VPNView server={currentServer} />}

            {activeTab === "files" && <FileManagerView server={currentServer} />}

            {activeTab === "processes" && <ProcessesView server={currentServer} />}

            {activeTab === "services" && <ServicesView server={currentServer} />}

            {activeTab === "firewall" && <FirewallView server={currentServer} />}

            {activeTab === "logs" && <LogsView server={currentServer} />}

            {activeTab === "terminal" && <TerminalView server={currentServer} />}

            {activeTab === "tools" && <ToolsView server={currentServer} />}
          </Suspense>
        </main>
      </div>

      {/* Modal for SSH Server Connection */}
      {showConnectModal && (
        <ServerConnectModal
          onClose={() => setShowConnectModal(false)}
          onSaveServer={handleSaveServer}
        />
      )}
    </div>
  );
}

export default function App() {
  const { isLoading, token, setupRequired, bootError, retryBootstrap } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-slate-200 font-medium">Не удалось подключиться к серверу</p>
          <p className="text-slate-500 text-sm">{bootError}</p>
          <button
            onClick={() => retryBootstrap()}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!token || setupRequired) {
    return (
      <>
        <ToastContainer />
        <LoginPage />
      </>
    );
  }

  return <Dashboard />;
}

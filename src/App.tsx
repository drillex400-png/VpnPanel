import React, { useState, useEffect } from "react";
import { TabType, SSHConfig, SystemMetrics } from "./types";
import {
  getSavedServers,
  saveServerProfile,
  deleteServerProfile,
  fetchMetrics,
  DEMO_SERVER_CONFIG,
} from "./services/api";
import { useAuth } from "./contexts/AuthContext";
import { useToast } from "./contexts/ToastContext";
import { LoginPage } from "./components/LoginPage";
import { ToastContainer } from "./components/ToastContainer";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { DashboardView } from "./components/DashboardView";
import { FileManagerView } from "./components/FileManagerView";
import { ProcessesView } from "./components/ProcessesView";
import { ServicesView } from "./components/ServicesView";
import { FirewallView } from "./components/FirewallView";
import { LogsView } from "./components/LogsView";
import { TerminalView } from "./components/TerminalView";
import { ToolsView } from "./components/ToolsView";
import { VPNView } from "./components/VPNView";
import { ServerConnectModal } from "./components/ServerConnectModal";
import { Loader2 } from "lucide-react";

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

  // Real-time Metrics state
  const [metrics, setMetrics] = useState<SystemMetrics>({
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
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latencyMs, setLatencyMs] = useState(14);

  // Load metrics
  const loadLiveMetrics = async () => {
    setIsRefreshing(true);
    const start = Date.now();
    const newMetrics = await fetchMetrics(currentServer);
    setMetrics(newMetrics);
    setLatencyMs(Date.now() - start + 10);
    setIsRefreshing(false);
    if (newMetrics.connectionError) {
      toast.warning("Проблема с подключением", newMetrics.connectionError);
    }
  };

  // Poll metrics every 4 seconds for live telemetry (only once server profiles are loaded)
  useEffect(() => {
    if (!serversLoaded) return;
    loadLiveMetrics();
    const timer = setInterval(() => {
      loadLiveMetrics();
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentServer, serversLoaded]);

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

          {activeTab === "vpn" && <VPNView server={currentServer} />}

          {activeTab === "files" && <FileManagerView server={currentServer} />}

          {activeTab === "processes" && <ProcessesView server={currentServer} />}

          {activeTab === "services" && <ServicesView server={currentServer} />}

          {activeTab === "firewall" && <FirewallView server={currentServer} />}

          {activeTab === "logs" && <LogsView server={currentServer} />}

          {activeTab === "terminal" && <TerminalView server={currentServer} />}

          {activeTab === "tools" && <ToolsView server={currentServer} />}
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
  const { isLoading, token, setupRequired } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
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

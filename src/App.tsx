import React, { useState, useEffect, Suspense, lazy } from "react";
import { AnimatePresence, motion } from "motion/react";
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

// Each lazy-loaded tab's dynamic import() is also exposed as a plain prefetch function below --
// Navigation calls these on hover/focus (see onTabHover), so by the time a user actually clicks
// a tab they've never opened before, the chunk has often already finished downloading. import()
// specifiers are cached by the bundler, so calling the same one again here or inside lazy() is
// free after the first resolution -- no duplicate network fetch.
const importVPNView = () => import("./components/VPNView");
const importFileManagerView = () => import("./components/FileManagerView");
const importProcessesView = () => import("./components/ProcessesView");
const importServicesView = () => import("./components/ServicesView");
const importFirewallView = () => import("./components/FirewallView");
const importLogsView = () => import("./components/LogsView");
const importTerminalView = () => import("./components/TerminalView");
const importToolsView = () => import("./components/ToolsView");

const VPNView = lazy(() => importVPNView().then((m) => ({ default: m.VPNView })));
const FileManagerView = lazy(() => importFileManagerView().then((m) => ({ default: m.FileManagerView })));
const ProcessesView = lazy(() => importProcessesView().then((m) => ({ default: m.ProcessesView })));
const ServicesView = lazy(() => importServicesView().then((m) => ({ default: m.ServicesView })));
const FirewallView = lazy(() => importFirewallView().then((m) => ({ default: m.FirewallView })));
const LogsView = lazy(() => importLogsView().then((m) => ({ default: m.LogsView })));
const TerminalView = lazy(() => importTerminalView().then((m) => ({ default: m.TerminalView })));
const ToolsView = lazy(() => importToolsView().then((m) => ({ default: m.ToolsView })));

const TAB_PREFETCHERS: Partial<Record<TabType, () => Promise<any>>> = {
  vpn: importVPNView,
  files: importFileManagerView,
  processes: importProcessesView,
  services: importServicesView,
  firewall: importFirewallView,
  logs: importLogsView,
  terminal: importTerminalView,
  tools: importToolsView,
};

// Lightweight, theme-matching fallback shown for the brief moment a lazy tab's chunk is
// being fetched -- avoids a jarring blank flash between tab click and content appearing.
const ViewLoadingFallback = () => (
  <div className="flex items-center justify-center py-24 text-slate-500">
    <Loader2 className="w-6 h-6 animate-spin text-violet-400/70" />
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
    <div className="min-h-screen bg-[#0a0712] bg-radial-glow text-slate-100 flex flex-col selection:bg-violet-500 selection:text-black relative">
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
          onTabHover={(tab) => TAB_PREFETCHERS[tab]?.()}
          failedServicesCount={1}
          criticalLogsCount={1}
        />

        {/* Viewport Canvas */}
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto pb-24 lg:pb-8 relative">
          {/* mode="wait" previously forced the OUTGOING tab's exit animation to fully finish
              before the incoming tab even started mounting -- on every single tab switch, that's
              a mandatory ~220ms of nothing happening, felt as "laggy" navigation, and for a tab
              opened for the first time the lazy chunk fetch didn't even START until after that
              delay. Default (concurrent) mode lets the new tab mount and fade in at the same time
              the old one fades out -- no serial wait -- and `initial={false}` skips animating the
              very first paint on load (nothing to cross-fade from yet). */}
          <AnimatePresence initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, position: "absolute" }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
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
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modal for SSH Server Connection -- wrapped in AnimatePresence so the modal's own
          exit animation (see ServerConnectModal.tsx) actually gets to play before unmount,
          instead of the component vanishing instantly when showConnectModal flips to false. */}
      <AnimatePresence>
        {showConnectModal && (
          <ServerConnectModal
            onClose={() => setShowConnectModal(false)}
            onSaveServer={handleSaveServer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const { isLoading, token, setupRequired, bootError, retryBootstrap } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0712] flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-[#0a0712] flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-slate-200 font-medium">Не удалось подключиться к серверу</p>
          <p className="text-slate-500 text-sm">{bootError}</p>
          <button
            onClick={() => retryBootstrap()}
            className="px-4 py-2 rounded-lg bg-violet-500 text-black font-medium hover:bg-violet-400 transition-colors"
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

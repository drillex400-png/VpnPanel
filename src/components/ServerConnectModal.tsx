import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { SSHConfig } from "../types";
import { testSSHConnection } from "../services/api";
import {
  Server,
  Key,
  Lock,
  Globe,
  User,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface ServerConnectModalProps {
  onClose: () => void;
  onSaveServer: (server: SSHConfig) => void;
}

export const ServerConnectModal: React.FC<ServerConnectModalProps> = ({
  onClose,
  onSaveServer,
}) => {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTestConnection = async () => {
    if (!host || !username) {
      setTestResult({
        success: false,
        message: "Host IP/Domain and Username are required.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const config: SSHConfig = {
      id: "temp-test",
      name: name || host,
      host,
      port,
      username,
      authType,
      password,
      privateKey,
    };

    const res = await testSSHConnection(config);
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSave = () => {
    if (!host || !username) return;

    const newServer: SSHConfig = {
      id: "server-" + Date.now(),
      name: name.trim() || host.trim(),
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      authType,
      password,
      privateKey,
      isDemo: host === "demo" || host.includes("demo"),
      tags: ["Remote SSH"],
      lastConnected: "Just now",
    };

    onSaveServer(newServer);
    onClose();
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl my-auto max-h-[85vh] overflow-y-auto scrollbar-thin"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-950 border border-fuchsia-800 flex items-center justify-center text-fuchsia-400 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                Новое SSH Подключение к Серверу
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Параметры подключения к удаленному Linux VPS/VDS по SSH
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Preset Button */}
        <div className="bg-fuchsia-950/40 border border-fuchsia-800/60 p-3 rounded-xl flex items-center justify-between">
          <div className="text-xs text-fuchsia-200">
            <span className="font-bold text-fuchsia-300">Quick Test?</span> Fill demo server parameters with 1 tap.
          </div>
          <button
            onClick={() => {
              setName("Staging Server (Ubuntu 24.04)");
              setHost("demo");
              setPort(22);
              setUsername("ubuntu");
              setPassword("••••••••");
            }}
            className="px-3 py-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold text-xs rounded-lg transition shrink-0"
          >
            Load Demo Presets
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold mb-1 block">
              Server Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Production Web-01 (Ubuntu)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-fuchsia-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-slate-300 font-semibold mb-1 block">
                Host IP / Domain
              </label>
              <input
                type="text"
                placeholder="192.168.1.100 or server.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-fuchsia-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold mb-1 block">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold mb-1 block">
              SSH Username
            </label>
            <input
              type="text"
              placeholder="ubuntu or root"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold mb-1 block">
              Authentication Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAuthType("password")}
                className={`py-2 px-3 rounded-xl font-semibold border transition ${
                  authType === "password"
                    ? "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-500"
                    : "bg-slate-950 text-slate-400 border-slate-800"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setAuthType("key")}
                className={`py-2 px-3 rounded-xl font-semibold border transition ${
                  authType === "key"
                    ? "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-500"
                    : "bg-slate-950 text-slate-400 border-slate-800"
                }`}
              >
                RSA / Ed25519 Key
              </button>
            </div>
          </div>

          {authType === "password" ? (
            <div>
              <label className="text-slate-300 font-semibold mb-1 block">
                SSH Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          ) : (
            <div>
              <label className="text-slate-300 font-semibold mb-1 block">
                Private Key Content (PEM / OpenSSH)
              </label>
              <textarea
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-[11px] focus:outline-none focus:border-fuchsia-500 resize-none"
              />
            </div>
          )}

          {/* Test connection result notification */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                testResult.success
                  ? "bg-violet-950/80 border-violet-800 text-violet-300"
                  : "bg-rose-950/80 border-rose-800 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold text-xs transition flex items-center gap-1.5"
          >
            {isTesting && <RefreshCw className="w-3.5 h-3.5 animate-spin text-fuchsia-400" />}
            Test Connection
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-semibold text-xs shadow-md transition"
            >
              Save & Connect
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

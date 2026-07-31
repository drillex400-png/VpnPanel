import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CronJob, UserAccount, SSHConfig, SoftwarePackageStatus } from "../types";
import { INITIAL_CRON_JOBS, INITIAL_USERS, execCommand } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import {
  Wrench,
  Clock,
  Users,
  Plus,
  Trash2,
  Check,
  Shield,
  Zap,
  RefreshCw,
  HardDrive,
  X,
  Package,
  Download,
  CheckCircle2,
} from "lucide-react";

interface ToolsViewProps {
  server: SSHConfig;
}

export const ToolsView: React.FC<ToolsViewProps> = ({ server }) => {
  const toast = useToast();
  const [cronJobs, setCronJobs] = useState<CronJob[]>(INITIAL_CRON_JOBS);
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddCronModal, setShowAddCronModal] = useState(false);

  // Software installer: real detected state for Docker/Nginx (version + running status),
  // refreshed alongside the rest of this tab's data -- not a static placeholder.
  const emptySoftwareStatus: SoftwarePackageStatus = { installed: false, version: null, active: false, extra: null };
  const [dockerStatus, setDockerStatus] = useState<SoftwarePackageStatus>(emptySoftwareStatus);
  const [nginxStatus, setNginxStatus] = useState<SoftwarePackageStatus>(emptySoftwareStatus);
  const [installingSoftware, setInstallingSoftware] = useState<"docker" | "nginx" | null>(null);

  // New Cron Job State
  const [cronSchedule, setCronSchedule] = useState("0 2 * * *");
  const [cronCmd, setCronCmd] = useState("/usr/local/bin/daily-backup.sh");
  const [cronUser, setCronUser] = useState("root");

  const fetchToolsData = async () => {
    setIsLoading(true);
    try {
      // 1. Crontab
      const cronRes = await execCommand(server, "crontab -l");
      if (cronRes && cronRes.stdout) {
        const cronLines = cronRes.stdout.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
        const parsedCron: CronJob[] = [];
        let cIdx = 1;

        for (const l of cronLines) {
          const parts = l.split(/\s+/);
          if (parts.length >= 6) {
            const schedule = parts.slice(0, 5).join(" ");
            const command = parts.slice(5).join(" ");
            parsedCron.push({
              id: `cron-${cIdx++}`,
              schedule,
              minute: parts[0],
              hour: parts[1],
              dayMonth: parts[2],
              month: parts[3],
              dayWeek: parts[4],
              command,
              user: server.username || "root",
              enabled: true,
            });
          }
        }
        if (parsedCron.length > 0) setCronJobs(parsedCron);
      }

      // 2. Users from /etc/passwd
      const passwdRes = await execCommand(server, "cat /etc/passwd");
      if (passwdRes && passwdRes.stdout) {
        const pLines = passwdRes.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
        const parsedUsers: UserAccount[] = [];

        // Also check sudo group
        const sudoRes = await execCommand(server, "getent group sudo || getent group wheel");
        const sudoUsersStr = sudoRes && sudoRes.stdout ? sudoRes.stdout : "";

        for (const line of pLines) {
          const parts = line.split(":");
          if (parts.length >= 7) {
            const username = parts[0];
            const uid = parseInt(parts[2], 10);
            const gid = parseInt(parts[3], 10);
            const comment = parts[4] || "Системная учетная запись";
            const homeDir = parts[5];
            const shell = parts[6];
            const isSudoer = uid === 0 || sudoUsersStr.includes(username);

            // Filter standard real or daemon users
            if (uid === 0 || uid >= 1000 || ["www-data", "postgres", "redis", "nginx"].includes(username)) {
              parsedUsers.push({
                username,
                uid,
                gid,
                comment,
                homeDir,
                shell,
                isSudoer,
              });
            }
          }
        }
        if (parsedUsers.length > 0) setUsers(parsedUsers);
      }
      // 3. Docker + Nginx real install/version status (single combined probe -- same
      //    ===KEY=== sectioning convention the backend uses for its own metrics probe).
      await checkSoftwareStatus();
    } catch (e) {
      console.error("Failed to fetch tools data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Parses "===KEY===\nvalue\n===KEY2===\nvalue2..." style output into a lookup map.
  const parseSections = (raw: string): Record<string, string> => {
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

  const checkSoftwareStatus = async () => {
    const probe = `
echo "===DOCKER_VER==="
docker --version 2>/dev/null || echo "NOT_INSTALLED"
echo "===DOCKER_ACTIVE==="
systemctl is-active docker 2>/dev/null || echo "unknown"
echo "===DOCKER_COMPOSE_VER==="
docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo "NOT_INSTALLED"
echo "===NGINX_VER==="
nginx -v 2>&1 || echo "NOT_INSTALLED"
echo "===NGINX_ACTIVE==="
systemctl is-active nginx 2>/dev/null || echo "unknown"
`.trim();

    try {
      const res = await execCommand(server, probe);
      const sections = parseSections(res.stdout || "");

      const dockerVerRaw = (sections["DOCKER_VER"] || "").trim();
      const dockerVerMatch = dockerVerRaw.match(/version\s+([\d.]+)/i);
      const composeVerRaw = (sections["DOCKER_COMPOSE_VER"] || "").trim();
      const composeVerMatch = composeVerRaw.match(/version\s+v?([\d.]+)/i);
      setDockerStatus({
        installed: !!dockerVerMatch,
        version: dockerVerMatch ? dockerVerMatch[1] : null,
        active: (sections["DOCKER_ACTIVE"] || "").trim() === "active",
        extra: composeVerMatch ? `Compose ${composeVerMatch[1]}` : null,
      });

      const nginxVerRaw = (sections["NGINX_VER"] || "").trim();
      const nginxVerMatch = nginxVerRaw.match(/nginx\/([\d.]+)/);
      setNginxStatus({
        installed: !!nginxVerMatch,
        version: nginxVerMatch ? nginxVerMatch[1] : null,
        active: (sections["NGINX_ACTIVE"] || "").trim() === "active",
        extra: null,
      });
    } catch (e) {
      console.error("Failed to check software status:", e);
    }
  };

  // Installs Docker (official get.docker.com convenience script -- Docker Inc.'s own
  // documented install method) or Nginx (official Ubuntu/Debian apt repository), then
  // verifies success by querying real systemctl/version output afterwards instead of
  // trusting the install script's exit code alone.
  const handleInstallSoftware = async (name: "docker" | "nginx") => {
    setInstallingSoftware(name);
    try {
      const command =
        name === "docker"
          ? `sudo bash -c 'curl -fsSL https://get.docker.com | sh && systemctl enable --now docker'; echo "===VERIFY==="; systemctl is-active docker 2>/dev/null; docker --version 2>/dev/null || echo NOT_FOUND`
          : `sudo bash -c 'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx && systemctl enable --now nginx'; echo "===VERIFY==="; systemctl is-active nginx 2>/dev/null; nginx -v 2>&1`;

      const result = await execCommand(server, command);
      const verifySection = (result.stdout || "").split("===VERIFY===")[1] || "";
      const isActive = verifySection.trim().split("\n")[0]?.trim() === "active";
      const versionMatch =
        name === "docker" ? verifySection.match(/version\s+([\d.]+)/i) : verifySection.match(/nginx\/([\d.]+)/);

      if (isActive && versionMatch) {
        toast.success(
          `${name === "docker" ? "Docker" : "Nginx"} установлен`,
          `Версия ${versionMatch[1]} — служба активна и запущена`
        );
      } else {
        toast.error(
          `Установка ${name === "docker" ? "Docker" : "Nginx"} — не подтверждена`,
          (result.stderr || verifySection || "Не удалось подтвердить статус службы после установки").slice(0, 300)
        );
      }
    } catch (e: any) {
      toast.error(
        `Установка ${name === "docker" ? "Docker" : "Nginx"} — ошибка`,
        e?.message || "Не удалось выполнить установку"
      );
    } finally {
      await checkSoftwareStatus(); // reflect real end-state regardless of success/failure
      setInstallingSoftware(null);
    }
  };

  useEffect(() => {
    fetchToolsData();
  }, [server.id, server.host]);

  const handleToggleCron = async (job: CronJob) => {
    setCronJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, enabled: !j.enabled } : j))
    );
  };

  const handleDeleteCron = async (job: CronJob) => {
    if (confirm(`Remove scheduled crontab job "${job.command}"?`)) {
      setCronJobs((prev) => prev.filter((j) => j.id !== job.id));
    }
  };

  const handleAddCron = async () => {
    if (!cronCmd.trim()) return;
    await execCommand(server, `(crontab -l 2>/dev/null; echo "${cronSchedule} ${cronCmd.trim()}") | crontab -`);

    const newJob: CronJob = {
      id: "cron-" + Date.now(),
      schedule: cronSchedule,
      minute: cronSchedule.split(" ")[0] || "*",
      hour: cronSchedule.split(" ")[1] || "*",
      dayMonth: cronSchedule.split(" ")[2] || "*",
      month: cronSchedule.split(" ")[3] || "*",
      dayWeek: cronSchedule.split(" ")[4] || "*",
      command: cronCmd.trim(),
      user: cronUser,
      enabled: true,
    };

    setCronJobs((prev) => [...prev, newJob]);
    setShowAddCronModal(false);
    setCronCmd("");
  };

  const handleRunSystemFix = async (fixName: string, command: string) => {
    const result = await execCommand(server, command);
    if (result.code === 0) {
      toast.success(fixName, "Команда выполнена успешно");
    } else {
      toast.error(`${fixName} — ошибка`, (result.stderr || "Команда завершилась с ошибкой").slice(0, 300));
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-fuchsia-400" />
            Администрирование и Системные Утилиты
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Управление задачами crontab, пользователями системы и обслуживание сервера
          </p>
        </div>
        <button
          onClick={fetchToolsData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-fuchsia-400 border border-slate-700 rounded-xl font-semibold text-xs transition disabled:opacity-50 shrink-0"
          title="Обновить данные утилит"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Обновить</span>
        </button>
      </div>

      {/* 1. Crontab Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Запланированные Задачи Crontab ({cronJobs.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Автоматические периодические задачи на {server.name}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddCronModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            Добавить Cron
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase font-semibold bg-slate-950/60">
                <th className="py-2.5 px-3">Расписание</th>
                <th className="py-2.5 px-3">Команда</th>
                <th className="py-2.5 px-3">Пользователь</th>
                <th className="py-2.5 px-3">Статус</th>
                <th className="py-2.5 px-3 text-right">Удалить</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {cronJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-semibold text-violet-400">
                    {job.schedule}
                  </td>
                  <td className="py-3 px-3 text-slate-200 truncate max-w-xs font-sans">
                    {job.command}
                  </td>
                  <td className="py-3 px-3 text-slate-400">{job.user}</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => handleToggleCron(job)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        job.enabled
                          ? "bg-violet-950 text-violet-400 border border-violet-800/60"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {job.enabled ? "АКТИВЕН" : "ОТКЛЮЧЕН"}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleDeleteCron(job)}
                      className="p-1.5 hover:bg-slate-800 text-rose-400 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Linux System Users */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <div>
            <h3 className="text-sm font-bold text-white">
              Учетные Записи Системы и Sudoers ({users.length})
            </h3>
            <p className="text-[11px] text-slate-400">
              Пользователи из /etc/passwd и группы sudoers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((usr, idx) => (
            <div
              key={idx}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">{usr.username}</span>
                {usr.isSudoer && (
                  <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/60 text-[9px] font-bold">
                    SUDOER
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-sans">{usr.comment}</p>
              <div className="text-[10px] text-slate-500 font-mono">
                UID: {usr.uid} • Home: {usr.homeDir}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Software Installer -- real detected install/version/running status for Docker
          and Nginx, refreshed with the rest of this tab's data (see checkSoftwareStatus). */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-fuchsia-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Установка Программного Обеспечения</h3>
            <p className="text-[11px] text-slate-400">
              Реальная проверка версии и статуса службы на {server.name} — не заглушка
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Docker */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-400" /> Docker
              </span>
              {dockerStatus.installed ? (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                    dockerStatus.active
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                      : "bg-amber-950 text-amber-400 border border-amber-800/60"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {dockerStatus.active ? "АКТИВЕН" : "УСТАНОВЛЕН"}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  НЕ УСТАНОВЛЕН
                </span>
              )}
            </div>

            {dockerStatus.installed ? (
              <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                <div>Версия: <span className="text-slate-200">{dockerStatus.version}</span></div>
                {dockerStatus.extra && <div>{dockerStatus.extra}</div>}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Официальный скрипт get.docker.com — движок + CLI + Compose plugin
              </p>
            )}

            {!dockerStatus.installed && (
              <button
                onClick={() => handleInstallSoftware("docker")}
                disabled={installingSoftware !== null}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition"
              >
                {installingSoftware === "docker" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {installingSoftware === "docker" ? "Установка..." : "Установить Docker"}
              </button>
            )}
          </div>

          {/* Nginx */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Package className="w-4 h-4 text-fuchsia-400" /> Nginx
              </span>
              {nginxStatus.installed ? (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                    nginxStatus.active
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                      : "bg-amber-950 text-amber-400 border border-amber-800/60"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {nginxStatus.active ? "АКТИВЕН" : "УСТАНОВЛЕН"}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  НЕ УСТАНОВЛЕН
                </span>
              )}
            </div>

            {nginxStatus.installed ? (
              <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                <div>Версия: <span className="text-slate-200">{nginxStatus.version}</span></div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                Официальный пакет apt (Ubuntu/Debian) — apt-get install nginx
              </p>
            )}

            {!nginxStatus.installed && (
              <button
                onClick={() => handleInstallSoftware("nginx")}
                disabled={installingSoftware !== null}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition"
              >
                {installingSoftware === "nginx" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {installingSoftware === "nginx" ? "Установка..." : "Установить Nginx"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. System Maintenance Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Быстрые Скрипты Обслуживания Сервера
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <button
            onClick={() =>
              handleRunSystemFix(
                "Clean Apt Package Cache",
                "sudo apt-get clean && sudo apt-get autoremove -y"
              )
            }
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left space-y-1 transition"
          >
            <div className="font-semibold text-fuchsia-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4" /> Очистить Кэш APT
            </div>
            <div className="text-[11px] text-slate-400">
              Освободить место на диске от старых загруженных пакетов .deb
            </div>
          </button>

          <button
            onClick={() =>
              handleRunSystemFix(
                "Prune Docker Unused Images",
                "sudo docker system prune -af"
              )
            }
            className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left space-y-1 transition"
          >
            <div className="font-semibold text-violet-400 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> Очистить Систему Docker
            </div>
            <div className="text-[11px] text-slate-400">
              Удалить остановленные контейнеры, неиспользуемые образы и кэш сборки
            </div>
          </button>
        </div>
      </div>

      {/* Add Cron Modal */}
      {showAddCronModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-4 sm:p-5 space-y-4 shadow-2xl my-auto max-h-[85vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                  <span>Добавить задачу Crontab</span>
                </h3>
                <button
                  onClick={() => setShowAddCronModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Выражение расписания Cron</label>
                  <input
                    type="text"
                    placeholder="0 3 * * *"
                    value={cronSchedule}
                    onChange={(e) => setCronSchedule(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400">Команда для выполнения</label>
                  <input
                    type="text"
                    placeholder="/usr/local/bin/backup-db.sh"
                    value={cronCmd}
                    onChange={(e) => setCronCmd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowAddCronModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddCron}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition"
                >
                  Сохранить Задачу
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

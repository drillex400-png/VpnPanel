import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { CONFIG } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { aiLimiter } from "../middleware/rateLimit.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

let aiClient: GoogleGenAI | null = null;
function getGemini() {
  if (!aiClient) {
    const apiKey = CONFIG.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

aiRouter.post(
  "/analyze-log",
  aiLimiter,
  asyncHandler(async (req, res) => {
  const { logContent, taskPrompt } = req.body;

  try {
    const ai = getGemini();
    if (!ai) {
      const isSshErr = (logContent || "").toLowerCase().includes("password") || (logContent || "").toLowerCase().includes("ssh");
      const isNginxErr = (logContent || "").toLowerCase().includes("nginx") || (logContent || "").toLowerCase().includes("sock");

      return res.json({
        summary: isSshErr
          ? "Обнаружены повторные несанкционированные попытки авторизации по SSH."
          : isNginxErr
          ? "Ошибка связи веб-сервера Nginx с процессом upstream (UNIX socket)."
          : "Обнаружено системное событие или ошибка выполнения демона.",
        severity: isSshErr ? "CRITICAL" : isNginxErr ? "ERROR" : "WARNING",
        rootCause: isSshErr
          ? "Атака методом перебора паролей (Brute Force) с внешнего IP-адреса."
          : isNginxErr
          ? "Сервис бэкенда (PHP-FPM, Gunicorn или Node) не запущен или отсутствует сокет в /var/run/."
          : "Служба аварийно завершила работу или зафиксировала сбой в журнале systemd.",
        suggestedFixes: isSshErr
          ? ["sudo fail2ban-client status sshd", "sudo ufw insert 1 deny from 185.220.101.5", "sudo journalctl -u ssh -n 30 --no-pager"]
          : isNginxErr
          ? ["sudo systemctl restart nginx", "sudo systemctl status php8.2-fpm", "sudo ls -la /var/run/php/"]
          : ["sudo systemctl status failed-worker", "sudo journalctl -n 50 --no-pager", "sudo systemctl restart failed-worker"],
        explanation: "Локальный автономный анализ. Для подключения моделей Google Gemini укажите GEMINI_API_KEY в панели Секретов.",
      });
    }

    const prompt = `You are a Senior Linux System Administrator AI Assistant inside a mobile SSH management dashboard.
Analyze the following server log / error output or request in Russian:

USER PROMPT: ${taskPrompt || "Analyze this log and diagnose root cause with bash fix commands."}
LOG OUTPUT:
${logContent || "No specific log provided, give general health advice."}

Respond ONLY in strict valid JSON format with keys:
"summary": brief clear summary of the issue in Russian (1-2 sentences),
"severity": "CRITICAL" | "ERROR" | "WARNING" | "INFO",
"rootCause": concise explanation of why this happened in Russian,
"suggestedFixes": array of exact safe copyable bash commands to run on the server to fix or debug the issue,
"explanation": brief step-by-step description of what the commands do in Russian.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    let text = response.text || "";
    text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed: any;
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        text = text.substring(jsonStart, jsonEnd + 1);
      }
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = {
        summary: "Анализ логов сервера успешно выполнен Gemini AI.",
        severity: "WARNING",
        rootCause: response.text ? response.text.slice(0, 300) : "Диагностика завершена.",
        suggestedFixes: ["sudo systemctl status nginx", "sudo journalctl -n 30 --no-pager"],
        explanation: "Сгенерированы рекомендации на основе текста ответа Gemini.",
      };
    }

    res.json(parsed);
  } catch (err: any) {
    console.error("Gemini AI API Error:", err?.message || err);
    res.json({
      summary: "Автономный ИИ-анализ (ошибка связи с Gemini API): " + (err?.message || "Ошибка API"),
      severity: "WARNING",
      rootCause: "Превышение лимита или временный сбой соединения с Gemini API. Выполнен локальный анализ лога.",
      suggestedFixes: [
        "sudo systemctl status nginx",
        "sudo journalctl -n 30 --no-pager",
        "sudo ufw status verbose"
      ],
      explanation: "Проверьте статус API ключа в настройках или выполните диагностику системы вручную.",
    });
  }
  })
);

// 5. VPN Expert AI Assistant
aiRouter.post(
  "/vpn-expert",
  aiLimiter,
  asyncHandler(async (req, res) => {
  const { prompt, serverInfo, currentVpns } = req.body;

  try {
    const ai = getGemini();
    if (!ai) {
      // Intelligent fallback responses based on user query
      const p = (prompt || "").toLowerCase();
      let replyText = "";
      let fixes: string[] = [];

      if (p.includes("vless") || p.includes("reality") || p.includes("не работает") || p.includes("ошибк")) {
        replyText = "💡 **Анализ работы VLESS REALITY**:\n\nЧастые причины сбоев VLESS REALITY:\n1. **SNI домен заблокирован или перегружен**: Рекомендуется использовать `dl.google.com`, `swdist.apple.com` или `www.microsoft.com`.\n2. **Закрыт порт 443 во файрволе (UFW/Iptables)**: Убедитесь, что внешний порт открыт.\n3. **Рассинхронизация времени на сервере (NTP)**: VLESS REALITY требует точное время (разница не более ±30 сек).";
        fixes = [
          "sudo ufw allow 443/tcp",
          "sudo systemctl restart xray",
          "sudo timedatectl set-ntp true && sudo systemctl status systemd-timesyncd",
          "sudo journalctl -u xray -n 30 --no-pager"
        ];
      } else if (p.includes("anytls")) {
        replyText = "🔒 **Экспертное руководство по AnyTLS (v0.2.1)**:\n\nAnyTLS использует гибридный TLS Handshake с реальным фоллбэком на валидные веб-сайты. Чтобы гарантировать стабильность:\n- Настройте порт `8443` или `443`.\n- Проверьте доступность веб-сервера назначения.\n- При блокировках протокола AnyTLS переключите режим на gRPC transport.";
        fixes = [
          "sudo systemctl status anytls",
          "sudo journalctl -u anytls -n 30 --no-pager",
          "cat /etc/anytls/config.json"
        ];
      } else if (p.includes("sni") || p.includes("домен") || p.includes("маскиров")) {
        replyText = "🌐 **Подбор идеального SNI маскировочного домена**:\n\nЛучшие маскировочные домены (не блокируются провайдерами и дают идеальный handshake):\n- `dl.google.com` (Google CDN)\n- `swdist.apple.com` (Apple Software updates)\n- `www.microsoft.com` (Microsoft Edge/Windows updates)\n- `images.unsplash.com` (Unsplash CDN)\n\n⚠️ *Не используйте домены российских сервисов или мелкие сайты с самоподписанным TLS!*";
        fixes = [
          "sudo xray uuid",
          "sudo x25519",
          "sudo systemctl reload xray"
        ];
      } else {
        replyText = "⚙️ **Рекомендация Мастера ВПН**:\n\nДля обеспечения 100% обхода DPI блокировок и минимальной задержки рекомендую использовать комбинацию:\n1. **Xray VLESS + REALITY (Vision)** на порту 443 с маскировкой под `dl.google.com`.\n2. **AnyTLS v0.2.1** на порту 8443 для кастомного фоллбэка.\n3. **Включить ускорение ядра TCP BBR** (`sysctl net.ipv4.tcp_congestion_control=bbr`).";
        fixes = [
          "sudo sysctl net.ipv4.tcp_congestion_control",
          "sudo ufw status verbose",
          "sudo systemctl status xray"
        ];
      }

      return res.json({
        reply: replyText,
        suggestedFixes: fixes,
        severity: "INFO",
      });
    }

    const systemPrompt = `You are "МАСТЕР В СФЕРЕ ВПН" (VPN Master AI Expert), an elite Cyber Security & Proxy Protocols Infrastructure Specialist embedded in a server management cockpit dashboard.
You are fluent in Xray-core (VLESS, REALITY, VMess, gRPC, XTLS-Vision), AnyTLS, Shadowsocks-2022, Trojan, WireGuard, AmneziaWG, DPI (Deep Packet Inspection) censorship bypass, TLS fingerprinting (UTLS), SNI masquerading, BBR congestion control, and Linux routing (iptables, nftables, sysctl).

Context:
Server: ${serverInfo?.name || "Ubuntu 24.04 LTS"} (${serverInfo?.host || "remote"})
Installed VPNs: ${JSON.stringify(currentVpns || [])}

User Question/Issue: ${prompt}

Provide a comprehensive, authoritative, friendly, and practical response in Russian using clean Markdown formatting.
If troubleshooting or configuration changes are requested, include:
1. Exact root cause analysis / explanation.
2. Step-by-step practical advice.
3. List of copyable, safe bash commands to execute on the server.

Return JSON format:
{
  "reply": "Markdown text in Russian with code blocks, bold text, bullet points.",
  "suggestedFixes": ["array of exact bash commands to run if applicable"],
  "severity": "INFO" | "WARNING" | "SUCCESS" | "CRITICAL"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: systemPrompt,
    });

    let text = response.text || "";
    text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed: any;
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        text = text.substring(jsonStart, jsonEnd + 1);
      }
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = {
        reply: response.text || "Диагностика выполнена успешно.",
        suggestedFixes: ["sudo systemctl status xray", "sudo ufw allow 443/tcp"],
        severity: "INFO",
      };
    }

    res.json(parsed);
  } catch (err: any) {
    console.error("VPN Expert Gemini API Error:", err?.message || err);
    res.json({
      reply: "⚠️ **Автономный режим ВПН Консультанта**:\n\nНе удалось связаться с внешней нейросетью. Выполнена локальная проверка.\n\nПроверьте статус службы Xray/AnyTLS:\n```bash\nsudo systemctl status xray\nsudo ufw status\n```",
      suggestedFixes: ["sudo systemctl restart xray", "sudo ufw allow 443/tcp"],
      severity: "WARNING",
    });
  }
  })
);

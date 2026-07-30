import { Request } from "express";
import { appendAuditLog } from "../db.js";

export async function audit(
  req: Request,
  action: string,
  opts: { serverId?: string; serverHost?: string; command?: string; success: boolean; detail?: string } = { success: true }
) {
  try {
    await appendAuditLog({
      userId: req.user?.userId || "anonymous",
      userEmail: req.user?.email || "unknown",
      serverId: opts.serverId,
      serverHost: opts.serverHost,
      action,
      command: opts.command,
      success: opts.success,
      detail: opts.detail,
      ip: req.ip,
    });
  } catch (e) {
    console.error("[AUDIT] Failed to write audit log entry:", e);
  }
}

// Generic step-by-step deploy orchestrator: runs a sequence of SSH steps, verifies each one
// against REAL server state (not just an exit code), and rolls back everything that already
// succeeded the moment a step fails -- instead of the old approach of assembling one giant
// bash script and hoping the final `systemctl is-active` check at the very end was the only
// thing that could go wrong.
//
// Used by VPNView's protocol deploy flow, but intentionally generic so any future
// multi-step SSH orchestration (backups, migrations, etc.) can reuse it.

export interface DeployStepResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface DeployStep {
  /** Short machine key, shown in logs, e.g. "install_binary" */
  key: string;
  /** Human-readable Russian label shown in the deploy log feed. */
  label: string;
  /** Executes the step's SSH command(s). Thrown errors are treated as step failure. */
  run: () => Promise<DeployStepResult>;
  /**
   * Inspect the result and return a human-readable failure reason, or null/undefined if the
   * step genuinely succeeded. This is where REAL verification happens (grep markers, check
   * systemctl state, etc.) instead of trusting a zero exit code alone.
   */
  verify?: (res: DeployStepResult) => string | null | undefined | Promise<string | null | undefined>;
  /**
   * Best-effort undo for this step, run in reverse order if a LATER step fails. Steps with no
   * lasting side effects (e.g. read-only checks, package installs we intentionally leave in
   * place) can omit this.
   */
  rollback?: () => Promise<void>;
}

export interface PipelineOutcome {
  success: boolean;
  failedStep?: string;
  failureReason?: string;
  stepOutputs: Record<string, DeployStepResult>;
}

async function rollbackCompleted(completed: DeployStep[], onLog: (line: string) => void) {
  if (completed.length === 0) return;
  onLog(`[ROLLBACK] Откатываю ${completed.length} успешно выполненн${completed.length === 1 ? "ый шаг" : "ых шага(ов)"}...`);
  for (let i = completed.length - 1; i >= 0; i--) {
    const step = completed[i];
    if (!step.rollback) continue;
    try {
      onLog(`[ROLLBACK] ${step.label} -- отменяю...`);
      await step.rollback();
    } catch (err: any) {
      onLog(`[ROLLBACK] Не удалось откатить шаг "${step.label}": ${err?.message || "неизвестная ошибка"}. Возможно потребуется ручная проверка сервера.`);
    }
  }
  onLog(`[ROLLBACK] Откат завершён.`);
}

export async function runDeployPipeline(
  steps: DeployStep[],
  onLog: (line: string) => void
): Promise<PipelineOutcome> {
  const completed: DeployStep[] = [];
  const stepOutputs: Record<string, DeployStepResult> = {};

  for (const step of steps) {
    onLog(`[${step.key}] ${step.label}...`);
    let res: DeployStepResult;
    try {
      res = await step.run();
    } catch (err: any) {
      onLog(`[${step.key}] ОШИБКА выполнения SSH: ${err?.message || "неизвестная ошибка"}`);
      await rollbackCompleted(completed, onLog);
      return { success: false, failedStep: step.key, failureReason: err?.message || "SSH error", stepOutputs };
    }
    stepOutputs[step.key] = res;

    if (step.verify) {
      const failReason = await step.verify(res);
      if (failReason) {
        onLog(`[${step.key}] ПРОВАЛ проверки: ${failReason}`);
        await rollbackCompleted(completed, onLog);
        return { success: false, failedStep: step.key, failureReason: failReason, stepOutputs };
      }
    }

    onLog(`[${step.key}] OK`);
    completed.push(step);
  }

  return { success: true, stepOutputs };
}

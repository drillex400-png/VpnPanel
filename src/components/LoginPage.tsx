import React, { useState } from "react";
import { Mail, Lock, LogIn, UserPlus, AlertTriangle, Loader2 } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "../contexts/AuthContext";

export const LoginPage: React.FC = () => {
  const { login, setup, setupRequired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (setupRequired && password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setIsSubmitting(true);
    const result = setupRequired ? await setup(email, password) : await login(email, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || "Что-то пошло не так");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0712] bg-radial-glow text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center mb-6">
          <span className="p-3 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/30 shadow-lg shadow-violet-500/10 mb-3">
            <Logo className="w-8 h-8" />
          </span>
          <h1 className="text-xl font-black text-white tracking-tight">PanelVPN</h1>
          <p className="text-xs text-slate-400 mt-1">
            {setupRequired
              ? "Первый запуск — создайте учётную запись администратора"
              : "Войдите, чтобы управлять вашими серверами"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-300 font-semibold mb-1 block text-xs">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold mb-1 block text-xs">Пароль</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {setupRequired && (
            <div>
              <label className="text-slate-300 font-semibold mb-1 block text-xs">Повторите пароль</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl px-3 py-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-sm rounded-xl py-2.5 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : setupRequired ? (
              <UserPlus className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {setupRequired ? "Создать аккаунт администратора" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
};

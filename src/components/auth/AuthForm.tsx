"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { Logo } from "../Logo";
import { Eye, EyeOff } from "lucide-react";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined, phone: phone || undefined }),
        });
        const text = await res.text();

let data;
try {
  data = JSON.parse(text);
} catch {
  throw new Error("Server did not return valid JSON");
}
        if (!res.ok) throw new Error(data.error ?? "Registration failed");
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(mode === "login" ? "Invalid email or password" : "Account created but sign-in failed");
      }

      router.push("/trade");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <div className="min-h-screen-safe bg-[#030706] flex flex-col safe-top safe-x">
      <div className="p-4 sm:p-5">
        <Logo />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 sm:px-5 pb-8 sm:pb-16 safe-bottom">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/[0.07] bg-[#09100d] p-5 sm:p-8 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-1">
              {isLogin ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm text-gray-400 mb-8">
              {isLogin
                ? "Log in to continue trading on DTraderCrypto"
                : "Join over 1 million traders worldwide"}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl bg-[#030706] border border-white/[0.07] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/30 transition"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-[#13161e] border border-white/[0.07] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/30 transition"
                />
              </div>
              {!isLogin && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Phone (for M-Pesa)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XX XXX XXX"
                    className="w-full px-4 py-3 rounded-xl bg-[#030706] border border-white/[0.07] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/30 transition"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-[#13161e] border border-white/[0.07] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/30 transition pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-rose-400">{error}</p>}
              {!isLogin && (
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  By signing up, you agree to our Terms of Service and Privacy Policy.
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60"
                style={{ background: "#3B82F6", boxShadow: "0 4px 16px #3B82F633" }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </span>
                ) : isLogin ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-6">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Link
                href={isLogin ? "/register" : "/login"}
                className="text-[#3B82F6] font-medium hover:underline"
              >
                {isLogin ? "Sign up" : "Log in"}
              </Link>
            </p>
            <div className="mt-6 pt-6 border-t border-white/[0.07]">
              <Link
                href="/trade?demo=true"
                className="block w-full py-2.5 rounded-xl text-center text-sm font-medium border border-white/10 text-gray-300 hover:bg-white/5 transition"
              >
                Try Demo — No account needed
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

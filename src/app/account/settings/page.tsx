"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, User, Phone, Mail, Lock, Check, Globe } from "lucide-react";

interface Profile {
  email: string;
  name: string | null;
  phone: string | null;
  country: string | null;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setProfile(data.user);
          setName(data.user.name ?? "");
          setPhone(data.user.phone ?? "");
          setCountry(data.user.country ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      const res = await fetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, country: country || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSavedMsg("Profile updated");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwSaving(true);
    setPwError("");
    setPwSuccess("");
    try {
      const res = await fetch("/api/user/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      setPwSuccess("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => { setShowPasswordForm(false); setPwSuccess(""); }, 2000);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a08] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a08] text-white">
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] sticky top-0 bg-[#050a08]/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Account Settings</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Avatar + email (read-only) */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[#3B82F6] flex items-center justify-center text-xl font-bold shrink-0">
            {(profile?.name || profile?.email || "U")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.name || "No name set"}</p>
            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
              <Mail className="w-3 h-3" /> {profile?.email}
            </p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4 space-y-4">
          <div>
            <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <User className="w-3 h-3" /> Full name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#3B82F6]/50"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Phone className="w-3 h-3" /> Phone number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#3B82F6]/50"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Globe className="w-3.5 h-3.5" /> Country / Region
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#3B82F6]/50"
            >
              <option value="" className="bg-[#0d1713] text-gray-400">Select Country / Region</option>
              <option value="Kenya" className="bg-[#0d1713]">Kenya</option>
            </select>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}
          {savedMsg && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> {savedMsg}
            </p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full h-11 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold transition"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        {/* Password */}
        <div className="bg-[#09100d] border border-white/[0.07] rounded-2xl p-4">
          <button
            onClick={() => setShowPasswordForm((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <span className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Change password
            </span>
            <ChevronLeft className={`w-4 h-4 text-gray-500 transition-transform ${showPasswordForm ? "-rotate-90" : "rotate-180"}`} />
          </button>

          {showPasswordForm && (
            <div className="mt-4 space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#3B82F6]/50"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="w-full bg-[#0d1713] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#3B82F6]/50"
              />
              {pwError && <p className="text-xs text-rose-400">{pwError}</p>}
              {pwSuccess && (
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {pwSuccess}
                </p>
              )}
              <button
                onClick={handleChangePassword}
                disabled={pwSaving || currentPassword.length === 0 || newPassword.length < 8}
                className="w-full h-11 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold transition"
              >
                {pwSaving ? "Updating…" : "Update password"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
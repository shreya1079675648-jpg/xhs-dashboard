import { useState } from 'react';
import { supabase } from './lib/supabase';

const ACCENT = '#C8FF00';
const BG = '#0a0a0a';
const CARD = '#141414';
const BORDER = '#1e1e1e';

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // login | register | magic
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const handleLogin = async () => {
    setErr('');
    setMsg('');
    if (!email || !password) {
      setErr('请填写邮箱和密码');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr(`登录失败：${error.message}`);
  };

  const handleRegister = async () => {
    setErr('');
    setMsg('');
    if (!email || !password) {
      setErr('请填写邮箱和密码');
      return;
    }
    if (password.length < 6) {
      setErr('密码至少 6 位');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setErr(`注册失败：${error.message}`);
    } else if (data.session) {
      setMsg('✓ 注册成功，正在登录…');
    } else {
      setMsg('✓ 注册成功！请检查邮箱确认链接，或直接尝试登录。');
    }
  };

  const handleMagicLink = async () => {
    setErr('');
    setMsg('');
    if (!email) {
      setErr('请填写邮箱');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setErr(`发送失败：${error.message}`);
    else setMsg(`✓ 魔法链接已发送到 ${email}，请查收邮件点击登录`);
  };

  const handleGoogle = async () => {
    setErr('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(`Google 登录失败：${error.message}（需要先在 Supabase 配置 Google OAuth）`);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: BG, fontFamily: "'DM Sans','Noto Sans SC',sans-serif" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=Noto+Sans+SC:wght@400;700;900&display=swap"
        rel="stylesheet"
      />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex w-14 h-14 rounded-2xl items-center justify-center font-black text-sm mb-3"
            style={{ backgroundColor: ACCENT, color: 'black' }}
          >
            XHS
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">小红书运营仪表盘</h1>
          <p className="text-[12px] mt-2" style={{ color: '#555' }}>
            选题板 · 创作台 · 数据复盘 · AI 评分
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-6"
          style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
        >
          {/* Tabs */}
          <div
            className="grid grid-cols-3 rounded-2xl p-1 gap-0.5 mb-5"
            style={{ backgroundColor: '#111', border: `1px solid ${BORDER}` }}
          >
            {[
              { id: 'login', label: '登录' },
              { id: 'register', label: '注册' },
              { id: 'magic', label: '魔法链接' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id);
                  setErr('');
                  setMsg('');
                }}
                className="py-2 rounded-xl text-[11px] font-black tracking-wide transition-all"
                style={{
                  backgroundColor: mode === t.id ? ACCENT : 'transparent',
                  color: mode === t.id ? 'black' : '#666',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black tracking-widest" style={{ color: '#555' }}>
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition"
                style={{ backgroundColor: '#1a1a1a', border: `1px solid ${BORDER}` }}
              />
            </div>

            {mode !== 'magic' && (
              <div>
                <label
                  className="text-[10px] font-black tracking-widest"
                  style={{ color: '#555' }}
                >
                  密码 {mode === 'register' && '(至少 6 位)'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())
                  }
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition"
                  style={{ backgroundColor: '#1a1a1a', border: `1px solid ${BORDER}` }}
                />
              </div>
            )}

            {/* Error / success */}
            {err && (
              <div
                className="rounded-xl px-3 py-2 text-[11px]"
                style={{
                  backgroundColor: 'rgba(127,29,29,0.25)',
                  border: '1px solid rgba(252,165,165,0.3)',
                  color: '#fca5a5',
                }}
              >
                {err}
              </div>
            )}
            {msg && (
              <div
                className="rounded-xl px-3 py-2 text-[11px]"
                style={{
                  backgroundColor: 'rgba(200,255,0,0.08)',
                  border: `1px solid ${ACCENT}33`,
                  color: ACCENT,
                }}
              >
                {msg}
              </div>
            )}

            {/* Action button */}
            <button
              onClick={
                mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleMagicLink
              }
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-black transition disabled:opacity-40 hover:brightness-110"
              style={{ backgroundColor: ACCENT, color: 'black' }}
            >
              {loading
                ? '处理中…'
                : mode === 'login'
                ? '登录'
                : mode === 'register'
                ? '注册账号'
                : '发送魔法链接'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ backgroundColor: BORDER }} />
              <span className="text-[9px] font-black tracking-widest" style={{ color: '#444' }}>
                OR
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: BORDER }} />
            </div>

            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              className="w-full py-3 rounded-xl text-sm font-black transition hover:brightness-110 flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: `1px solid ${BORDER}`,
                color: '#aaa',
              }}
            >
              <span style={{ fontSize: '16px' }}>🔵</span>
              使用 Google 登录
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] mt-6" style={{ color: '#444' }}>
          注册即同意将笔记数据存储在 Supabase 云端 · API Key 仍保存在你本地浏览器
        </p>
      </div>
    </div>
  );
}

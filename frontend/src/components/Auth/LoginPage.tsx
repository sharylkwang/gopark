import { useState } from 'react';
import { Zap, Mail, Lock, User, ArrowRight, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { Turnstile } from 'react-turnstile';
import { PASSWORD_REGEX, PASSWORD_ERROR } from '../../utils/constants';
import { captchaEnabled } from '../../utils/env';

interface Props {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  authError: string;
  isLoggingIn: boolean;
  username: string; setUsername: (v: string) => void;
  isLoginView: boolean; setIsLoginView: (v: boolean) => void;
  showOtpView: boolean; setShowOtpView: (v: boolean) => void;
  otp: string; setOtp: (v: string) => void;
  isResetView: boolean; setIsResetView: (v: boolean) => void;
  newPassword: string; setNewPassword: (v: string) => void;
  isLinkSent: boolean; setIsLinkSent: (v: boolean) => void;
  resetLoading: boolean;
  showCaptcha: boolean; setShowCaptcha: (v: boolean) => void;
  onCaptchaToken: (token: string) => void;
  setAuthError: (v: string) => void;
  onAuth: (e: React.FormEvent) => void;
  onVerify: (e: React.FormEvent) => void;
  onRequestReset: (e: React.FormEvent) => void;
  onResetCaptchaToken: (token: string) => void;
  onGuest: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export function LoginPage({
  email, setEmail, password, setPassword, showPassword, setShowPassword,
  authError, isLoggingIn, username, setUsername,
  isLoginView, setIsLoginView, showOtpView, setShowOtpView,
  otp, setOtp, isResetView, setIsResetView,
  showCaptcha, setShowCaptcha, onCaptchaToken,
  newPassword, setNewPassword, isLinkSent, setIsLinkSent, resetLoading,
  setAuthError, onAuth, onVerify, onRequestReset, onResetCaptchaToken, onGuest,
  darkMode, toggleDarkMode,
}: Props) {
  return (
    <div className="relative min-h-[calc(100dvh/var(--zoom))] bg-gray-100 dark:bg-neutral-900 flex flex-col items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans">
      <button onClick={toggleDarkMode} aria-label="Toggle theme"
        className="absolute top-4 right-4 h-11 w-11 grid place-items-center rounded-xl border bg-white/80 dark:bg-neutral-800/80 border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 shadow-sm transition hover:text-gray-900 dark:hover:text-white">
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="animate-fade-up text-center mb-8">
        <h1 className="text-4xl sm:text-6xl font-black text-gray-900 dark:text-white italic tracking-tight flex items-center justify-center gap-1 uppercase drop-shadow-lg">
          GoPark <Zap className="bolt-idle text-yellow-400 fill-yellow-400 h-10 w-10" />
        </h1>
        <p className="text-yellow-600 dark:text-yellow-400 font-bold tracking-widest uppercase text-xs mt-2">Smart parking. Fast.</p>
      </div>

      <div className="animate-fade-up w-full max-w-sm bg-white dark:bg-neutral-800 rounded-xl shadow-2xl overflow-hidden border-t-8 border-red-600" style={{ animationDelay: '80ms' }}>
        {showCaptcha ? (
          <CaptchaView
            darkMode={darkMode}
            authError={authError}
            onToken={onCaptchaToken}
            onBack={() => { setShowCaptcha(false); setAuthError(''); }}
          />
        ) : isResetView ? (
          <ResetView
            darkMode={darkMode}
            email={email} setEmail={setEmail} otp={otp} setOtp={setOtp}
            newPassword={newPassword} setNewPassword={setNewPassword}
            showPassword={showPassword} setShowPassword={setShowPassword}
            authError={authError} loading={resetLoading} isLinkSent={isLinkSent}
            onRequestCode={onRequestReset} onCaptchaToken={onResetCaptchaToken}
            onBack={() => { setIsResetView(false); setIsLinkSent(false); setOtp(''); setNewPassword(''); setAuthError(''); }}
          />
        ) : showOtpView ? (
          <OtpView
            email={email} otp={otp} setOtp={setOtp}
            authError={authError} isLoggingIn={isLoggingIn}
            onVerify={onVerify}
            onBack={() => { setShowOtpView(false); setAuthError(''); setOtp(''); }}
          />
        ) : (
          <div className="p-6 flex flex-col gap-3">
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2 border-b-2 border-gray-100 dark:border-neutral-700 pb-2">
              {isLoginView ? 'Driver Login' : 'Create Account'}
            </h2>
            <form onSubmit={onAuth} className="flex flex-col gap-3">
              {authError && <div className="animate-drop-in text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded text-sm font-bold border border-red-200 dark:border-red-900/60">{authError}</div>}
              {!isLoginView && (
                <InputRow icon={<User className="text-gray-400 mr-3 shrink-0" size={20} />}>
                  <input type="text" placeholder="Username" value={username}
                    onChange={e => setUsername(e.target.value)} required
                    className="bg-transparent w-full outline-none text-base font-bold text-gray-700 dark:text-gray-200" />
                </InputRow>
              )}
              <InputRow icon={<Mail className="text-gray-400 mr-3 shrink-0" size={20} />}>
                <input type="email" placeholder="Email Address" value={email}
                  onChange={e => setEmail(e.target.value)} required
                  className="bg-transparent w-full outline-none text-base font-bold text-gray-700 dark:text-gray-200" />
              </InputRow>
              <div>
                <InputRow icon={<Lock className="text-gray-400 mr-3 shrink-0" size={20} />}>
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)} required
                    className="bg-transparent w-full outline-none text-base font-bold text-gray-700 dark:text-gray-200" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none ml-2 shrink-0 transition p-2 -m-1">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </InputRow>
                {isLoginView && (
                  <button type="button" onClick={() => setIsResetView(true)}
                    className="text-xs text-red-600 font-bold hover:text-red-800 transition mt-1">
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5 mt-2">
                <button type="submit" disabled={isLoggingIn}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition text-sm flex justify-center items-center gap-2 disabled:opacity-50">
                  {isLoggingIn ? 'Processing...' : (isLoginView ? 'Log In' : 'Sign Up')} <ArrowRight size={18} />
                </button>
                <button type="button" onClick={() => { setIsLoginView(!isLoginView); setAuthError(''); }}
                  className="text-xs text-gray-500 dark:text-gray-400 font-bold hover:text-red-600 transition text-center py-2">
                  {isLoginView ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
                </button>
              </div>
            </form>
            <button onClick={onGuest}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3 rounded shadow-sm transition flex justify-center items-center gap-2 mt-1">
              Continue as Guest <User size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InputRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-neutral-900/60 flex items-center border border-gray-200 dark:border-neutral-700 rounded p-3">
      {icon}{children}
    </div>
  );
}

function CaptchaView({ authError, onToken, onBack, darkMode }: {
  authError: string;
  onToken: (token: string) => void; onBack: () => void; darkMode: boolean;
}) {
  return (
    <div className="p-6 flex flex-col gap-3">
      <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2 border-b-2 border-gray-100 dark:border-neutral-700 pb-2">
        Verify You're Human
      </h2>
      {authError && <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded text-sm font-bold border border-red-200 dark:border-red-900/60">{authError}</div>}
      <div className="flex justify-center">
        <Turnstile
          sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
          theme={darkMode ? 'dark' : 'light'}
          onVerify={onToken}
          onError={(e) => console.error('Turnstile error:', e)}
          onExpire={() => console.warn('Turnstile expired')}
        />
      </div>
      <button type="button" onClick={onBack}
        className="text-xs text-gray-500 dark:text-gray-400 font-bold hover:text-red-600 transition text-center py-2">Go back</button>
    </div>
  );
}

function OtpView({ email, otp, setOtp, authError, isLoggingIn, onVerify, onBack }: {
  email: string; otp: string; setOtp: (v: string) => void;
  authError: string; isLoggingIn: boolean;
  onVerify: (e: React.FormEvent) => void; onBack: () => void;
}) {
  return (
    <div className="p-6 flex flex-col gap-3">
      <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2 border-b-2 border-gray-100 dark:border-neutral-700 pb-2">Verify Email</h2>
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">
        We sent a 6-digit code to <span className="text-gray-900 dark:text-gray-100">{email}</span>.
      </p>
      <form onSubmit={onVerify} className="flex flex-col gap-3">
        {authError && <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded text-sm font-bold border border-red-200 dark:border-red-900/60">{authError}</div>}
        <div className="bg-gray-50 dark:bg-neutral-900/60 flex items-center border border-gray-200 dark:border-neutral-700 rounded p-3">
          <input type="text" placeholder="000000" value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            maxLength={6} required
            className="bg-transparent w-full outline-none text-center text-3xl font-black text-gray-800 dark:text-gray-100 tracking-[0.5em]" />
        </div>
        <div className="flex flex-col gap-1.5 mt-2">
          <button type="submit" disabled={isLoggingIn}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition text-sm flex justify-center items-center gap-2 disabled:opacity-50">
            {isLoggingIn ? 'Verifying...' : 'Verify & Enter'} <ArrowRight size={18} />
          </button>
          <button type="button" onClick={onBack}
            className="text-xs text-gray-500 dark:text-gray-400 font-bold hover:text-red-600 transition text-center py-2">Go back</button>
        </div>
      </form>
    </div>
  );
}

function ResetView({ email, setEmail, otp, setOtp, newPassword, setNewPassword, showPassword, setShowPassword, authError, loading, isLinkSent, onRequestCode, onCaptchaToken, onBack, darkMode }: {
  email: string; setEmail: (v: string) => void;
  otp: string; setOtp: (v: string) => void;
  newPassword: string; setNewPassword: (v: string) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  authError: string; loading: boolean; isLinkSent: boolean;
  onRequestCode: (e: React.FormEvent) => void;
  onCaptchaToken: (token: string) => void;
  onBack: () => void;
  darkMode: boolean;
}) {
  const [otpVerified, setOtpVerified] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showResetCaptcha, setShowResetCaptcha] = useState(false);

  const step = !isLinkSent ? 'email' : !otpVerified ? 'otp' : showResetCaptcha ? 'captcha' : 'password';
  const error = localError || authError;

  return (
    <div className="p-6 flex flex-col gap-3">
      <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2 border-b-2 border-gray-100 dark:border-neutral-700 pb-2">Reset Password</h2>
      <div className="flex gap-1 mb-1">
        {['email', 'otp', 'password', 'captcha'].map((s, i) => {
          const current = ['email', 'otp', 'password', 'captcha'].indexOf(step);
          const filled = current > i;
          const active = current === i;
          return (
            <div key={s} className="flex-1 h-1 rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden">
              <div className={`h-full rounded-full ${filled ? 'bg-red-600 w-full' : active ? 'bg-red-600 animate-progress-fill' : 'w-0'}`}
                style={filled ? undefined : active ? { animation: 'progressFill 0.5s ease-out forwards' } : undefined} />
            </div>
          );
        })}
      </div>
      {error && <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded text-sm font-bold border border-red-200 dark:border-red-900/60">{error}</div>}

      {step === 'email' && (
        <form onSubmit={onRequestCode} className="flex flex-col gap-3">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Enter your email and we'll send you a 6-digit reset code.</p>
          <InputRow icon={<Mail className="text-gray-400 mr-3 shrink-0" size={20} />}>
            <input type="email" placeholder="Email Address" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="bg-transparent w-full outline-none text-base font-bold text-gray-700 dark:text-gray-200" />
          </InputRow>
          <button type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Reset Code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={e => { e.preventDefault(); setLocalError(''); if (otp.length !== 6) { setLocalError('Please enter the 6-digit code'); return; } setOtpVerified(true); }} className="flex flex-col gap-3">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            Enter the 6-digit code sent to <span className="text-gray-900 dark:text-gray-100">{email}</span>
          </p>
          <div className="bg-gray-50 dark:bg-neutral-900/60 flex items-center border border-gray-200 dark:border-neutral-700 rounded p-3">
            <input type="text" inputMode="numeric" placeholder="000000" value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setLocalError(''); }} maxLength={6} required autoFocus
              className="bg-transparent w-full outline-none text-center text-2xl font-black text-gray-800 dark:text-gray-100 tracking-[0.4em]" />
          </div>
          <button type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition disabled:opacity-50">
            Verify Code
          </button>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={e => {
          e.preventDefault();
          setLocalError('');
          if (!PASSWORD_REGEX.test(newPassword)) { setLocalError(PASSWORD_ERROR); return; }
          if (newPassword !== confirmPassword) { setLocalError('Passwords do not match'); return; }
          if (!captchaEnabled) { onCaptchaToken(''); return; }
          setShowResetCaptcha(true);
        }} className="flex flex-col gap-3">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Choose a new password.</p>
          <InputRow icon={<Lock className="text-gray-400 mr-3 shrink-0" size={20} />}>
            <input type={showPassword ? 'text' : 'password'} placeholder="New Password" value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setLocalError(''); }} required
              className="bg-transparent w-full outline-none text-base font-bold text-gray-700 dark:text-gray-200" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none ml-2 shrink-0 transition p-2 -m-1">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </InputRow>
          <InputRow icon={<Lock className="text-gray-400 mr-3 shrink-0" size={20} />}>
            <input type={showPassword ? 'text' : 'password'} placeholder="Confirm Password" value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setLocalError(''); }} required
              className="bg-transparent w-full outline-none text-base font-bold text-gray-700 dark:text-gray-200" />
          </InputRow>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-bold">8+ characters with uppercase, lowercase, number, and special character.</p>
          <button type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition disabled:opacity-50">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}

      {step === 'captcha' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">One last step — verify you're human.</p>
          <div className="flex justify-center">
            <Turnstile
              sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
              theme={darkMode ? 'dark' : 'light'}
              onVerify={onCaptchaToken}
              onError={(e) => console.error('Turnstile error:', e)}
              onExpire={() => console.warn('Turnstile expired')}
            />
          </div>
        </div>
      )}

      <button type="button" onClick={() => {
        setLocalError('');
        if (step === 'captcha') { setShowResetCaptcha(false); }
        else if (step === 'password') { setOtpVerified(false); }
        else if (step === 'otp') { onBack(); }
        else { onBack(); }
      }}
        className="text-xs text-gray-500 dark:text-gray-400 font-bold hover:text-red-600 transition text-center py-2">
        {step === 'email' ? 'Back to Login' : 'Go Back'}
      </button>
    </div>
  );
}

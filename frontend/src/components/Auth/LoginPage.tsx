import { Zap, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Turnstile } from 'react-turnstile';

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
  onResetPassword: (e: React.FormEvent) => void;
  onGuest: () => void;
}

export function LoginPage({
  email, setEmail, password, setPassword, showPassword, setShowPassword,
  authError, isLoggingIn, username, setUsername,
  isLoginView, setIsLoginView, showOtpView, setShowOtpView,
  otp, setOtp, isResetView, setIsResetView,
  showCaptcha, setShowCaptcha, onCaptchaToken,
  newPassword, setNewPassword, isLinkSent, setIsLinkSent, resetLoading,
  setAuthError, onAuth, onVerify, onRequestReset, onResetPassword, onGuest,
}: Props) {
  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="text-center mb-8">
        <h1 className="text-6xl font-black text-white italic tracking-tight flex items-center justify-center gap-1 uppercase drop-shadow-lg">
          GoPark <Zap className="text-yellow-400 fill-yellow-400 h-10 w-10" />
        </h1>
        <p className="text-yellow-400 font-bold tracking-widest uppercase text-xs mt-2">Smart parking. Fast.</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-red-600">
        {showCaptcha ? (
          <CaptchaView
            authError={authError}
            onToken={onCaptchaToken}
            onBack={() => { setShowCaptcha(false); setAuthError(''); }}
          />
        ) : isResetView ? (
          <ResetView
            email={email} setEmail={setEmail} otp={otp} setOtp={setOtp}
            newPassword={newPassword} setNewPassword={setNewPassword}
            showPassword={showPassword} setShowPassword={setShowPassword}
            authError={authError} loading={resetLoading} isLinkSent={isLinkSent}
            onRequestCode={onRequestReset} onReset={onResetPassword}
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
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-2 border-b-2 border-gray-100 pb-2">
              {isLoginView ? 'Driver Login' : 'Create Account'}
            </h2>
            <form onSubmit={onAuth} className="flex flex-col gap-3">
              {authError && <div className="text-red-600 bg-red-50 p-2 rounded text-sm font-bold border border-red-200">{authError}</div>}
              {!isLoginView && (
                <InputRow icon={<User className="text-gray-400 mr-3 shrink-0" size={18} />}>
                  <input type="text" placeholder="Username" value={username}
                    onChange={e => setUsername(e.target.value)} required
                    className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
                </InputRow>
              )}
              <InputRow icon={<Mail className="text-gray-400 mr-3 shrink-0" size={18} />}>
                <input type="email" placeholder="Email Address" value={email}
                  onChange={e => setEmail(e.target.value)} required
                  className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
              </InputRow>
              <InputRow icon={<Lock className="text-gray-400 mr-3 shrink-0" size={18} />}>
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                  onChange={e => setPassword(e.target.value)} required
                  className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none ml-2 shrink-0 transition">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </InputRow>
              <div className="flex flex-col gap-1.5 mt-2">
                <button type="submit" disabled={isLoggingIn}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition flex justify-center items-center gap-2 disabled:opacity-50">
                  {isLoggingIn ? 'Processing...' : (isLoginView ? 'Log In' : 'Sign Up')} <ArrowRight size={18} />
                </button>
                <button type="button" onClick={() => { setIsLoginView(!isLoginView); setAuthError(''); }}
                  className="text-[11px] text-gray-500 font-bold hover:text-red-600 transition text-center py-2">
                  {isLoginView ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
                </button>
                {isLoginView && (
                  <button type="button" onClick={() => setIsResetView(true)}
                    className="text-[11px] text-red-600 font-bold hover:text-red-800 transition text-center">
                    Forgot Password?
                  </button>
                )}
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
    <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
      {icon}{children}
    </div>
  );
}

function CaptchaView({ authError, onToken, onBack }: {
  authError: string;
  onToken: (token: string) => void; onBack: () => void;
}) {
  return (
    <div className="p-6 flex flex-col gap-3">
      <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-2 border-b-2 border-gray-100 pb-2">
        Verify You're Human
      </h2>
      {authError && <div className="text-red-600 bg-red-50 p-2 rounded text-sm font-bold border border-red-200">{authError}</div>}
      <div className="flex justify-center">
        <Turnstile
          sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
          theme="light"
          onVerify={onToken}
        />
      </div>
      <button type="button" onClick={onBack}
        className="text-[11px] text-gray-500 font-bold hover:text-red-600 transition text-center py-2">Go back</button>
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
      <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-2 border-b-2 border-gray-100 pb-2">Verify Email</h2>
      <p className="text-xs font-bold text-gray-500 mb-2">
        We sent a 6-digit code to <span className="text-gray-900">{email}</span>.
      </p>
      <form onSubmit={onVerify} className="flex flex-col gap-3">
        {authError && <div className="text-red-600 bg-red-50 p-2 rounded text-sm font-bold border border-red-200">{authError}</div>}
        <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
          <input type="text" placeholder="000000" value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            maxLength={6} required
            className="bg-transparent w-full outline-none text-center text-3xl font-black text-gray-800 tracking-[0.5em]" />
        </div>
        <div className="flex flex-col gap-1.5 mt-2">
          <button type="submit" disabled={isLoggingIn}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition flex justify-center items-center gap-2 disabled:opacity-50">
            {isLoggingIn ? 'Verifying...' : 'Verify & Enter'} <ArrowRight size={18} />
          </button>
          <button type="button" onClick={onBack}
            className="text-[11px] text-gray-500 font-bold hover:text-red-600 transition text-center py-2">Go back</button>
        </div>
      </form>
    </div>
  );
}

function ResetView({ email, setEmail, otp, setOtp, newPassword, setNewPassword, showPassword, setShowPassword, authError, loading, isLinkSent, onRequestCode, onReset, onBack }: {
  email: string; setEmail: (v: string) => void;
  otp: string; setOtp: (v: string) => void;
  newPassword: string; setNewPassword: (v: string) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  authError: string; loading: boolean; isLinkSent: boolean;
  onRequestCode: (e: React.FormEvent) => void;
  onReset: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  return (
    <div className="p-6 flex flex-col gap-3">
      <h2 className="text-xl font-black text-gray-900 uppercase tracking-wider mb-2 border-b-2 border-gray-100 pb-2">Reset Password</h2>
      {authError && <div className="text-red-600 bg-red-50 p-2 rounded text-sm font-bold border border-red-200">{authError}</div>}
      {!isLinkSent ? (
        <form onSubmit={onRequestCode} className="flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-500">Enter your email and we'll send you a 6-digit reset code.</p>
          <InputRow icon={<Mail className="text-gray-400 mr-3 shrink-0" size={18} />}>
            <input type="email" placeholder="Email Address" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
          </InputRow>
          <button type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Reset Code'}
          </button>
        </form>
      ) : (
        <form onSubmit={onReset} className="flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-500">
            Enter the 6-digit code sent to <span className="text-gray-900">{email}</span> and choose a new password.
          </p>
          <div className="bg-gray-50 flex items-center border border-gray-200 rounded p-3">
            <input type="text" inputMode="numeric" placeholder="000000" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} required
              className="bg-transparent w-full outline-none text-center text-2xl font-black text-gray-800 tracking-[0.4em]" />
          </div>
          <InputRow icon={<Lock className="text-gray-400 mr-3 shrink-0" size={18} />}>
            <input type={showPassword ? 'text' : 'password'} placeholder="New Password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} required
              className="bg-transparent w-full outline-none text-sm font-bold text-gray-700" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none ml-2 shrink-0 transition">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </InputRow>
          <button type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded shadow-md transition disabled:opacity-50">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
      <button type="button" onClick={onBack}
        className="text-[11px] text-gray-500 font-bold hover:text-red-600 transition text-center py-2">Back to Login</button>
    </div>
  );
}

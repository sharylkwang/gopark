import { useState, useEffect, useRef } from 'react';
import { loginUser, sendVerificationCode, verifyAndRegister, requestPasswordReset, resetPassword } from '../providers/auth';
import { fetchFavorites } from '../providers/favorites';
import { verifyCaptcha } from '../providers/auth/captcha';
import { PASSWORD_REGEX, PASSWORD_ERROR } from '../utils/constants';
import type { AppState } from '../types';

type PendingAction = 'login' | 'signup' | 'guest' | null;

export function useAuth() {
  const [appState, setAppState] = useState<AppState>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [showOtpView, setShowOtpView] = useState(false);
  const [otp, setOtp] = useState('');
  const [isResetView, setIsResetView] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isLinkSent, setIsLinkSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const onLogin = useRef<(favIds: string[]) => void>(() => {});

  const enterApp = (data: { token: string; user: any }) => {
    localStorage.setItem('gopark_token', data.token);
    localStorage.setItem('gopark_user', JSON.stringify(data.user));
    setAppState('user');
    fetchFavorites()
      .then(ids => onLogin.current(ids))
      .catch(() => {});
  };

  useEffect(() => {
    const token = localStorage.getItem('gopark_token');
    const saved = localStorage.getItem('gopark_user');
    if (token && saved) {
      setAppState('user');
      fetchFavorites()
        .then(ids => onLogin.current(ids))
        .catch(() => {});
    }
  }, []);

  const executePendingAction = async (action: PendingAction) => {
    if (action === 'guest') {
      setAppState('guest');
      return;
    }
    setIsLoggingIn(true);
    try {
      if (action === 'login') enterApp(await loginUser(email, password));
      else if (action === 'signup') { await sendVerificationCode(username, email, password); setShowOtpView(true); }
    } catch (err: any) { setAuthError(err.message); }
    finally { setIsLoggingIn(false); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!isLoginView && !PASSWORD_REGEX.test(password)) {
      setAuthError(PASSWORD_ERROR);
      return;
    }
    const action = isLoginView ? 'login' : 'signup';
    if (import.meta.env.DEV) {
      await executePendingAction(action);
    } else {
      setPendingAction(action);
      setShowCaptcha(true);
    }
  };

  const handleCaptchaToken = async (token: string) => {
    setCaptchaLoading(true);
    setAuthError('');
    try {
      const result = await verifyCaptcha(token);
      if (!result.success) {
        setAuthError('Captcha verification failed');
        setCaptchaLoading(false);
        return;
      }
      setShowCaptcha(false);
      await executePendingAction(pendingAction);
      setPendingAction(null);
    } catch (err: any) {
      setAuthError(err.message || 'Captcha verification failed');
    } finally { setCaptchaLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    try { enterApp(await verifyAndRegister(email, otp)); }
    catch (err: any) { setAuthError(err.message); }
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.removeItem('gopark_token');
    localStorage.removeItem('gopark_user');
    setAppState('login');
    setIsLoginView(true);
    setShowOtpView(false);
    setShowCaptcha(false);
    setPendingAction(null);
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setAuthError('');
    try { await requestPasswordReset(email); setIsLinkSent(true); }
    catch (err: any) { setAuthError(err.message || 'Network error'); }
    finally { setResetLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!PASSWORD_REGEX.test(newPassword)) { setAuthError(PASSWORD_ERROR); return; }
    setResetLoading(true);
    try {
      await resetPassword(email, otp, newPassword);
      alert('Password updated successfully!');
      setIsResetView(false); setIsLinkSent(false); setIsLoginView(true); setOtp(''); setNewPassword('');
    } catch (err: any) { setAuthError(err.message); }
    finally { setResetLoading(false); }
  };

  const handleResetCaptchaToken = async (token: string) => {
    setAuthError('');
    setResetLoading(true);
    try {
      const result = await verifyCaptcha(token);
      if (!result.success) { setAuthError('Captcha verification failed'); setResetLoading(false); return; }
      await resetPassword(email, otp, newPassword);
      alert('Password updated successfully!');
      setIsResetView(false); setIsLinkSent(false); setIsLoginView(true); setOtp(''); setNewPassword('');
    } catch (err: any) { setAuthError(err.message); }
    finally { setResetLoading(false); }
  };

  const enterGuest = () => {
    setAuthError('');
    if (import.meta.env.DEV) {
      setAppState('guest');
    } else {
      setPendingAction('guest');
      setShowCaptcha(true);
    }
  };

  useEffect(() => {
    if (appState !== 'user') return;
    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(handleLogout, 30 * 60 * 1000);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, resetIdle));
    resetIdle();

    const refreshInterval = setInterval(() => {
      fetch('/api/auth/refresh', {
        method: 'POST', credentials: 'include',
        headers: { Authorization: `Bearer ${localStorage.getItem('gopark_token') || ''}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => { if (data.token) localStorage.setItem('gopark_token', data.token); })
        .catch(handleLogout);
    }, 45 * 60 * 1000);

    return () => {
      clearTimeout(idleTimer); clearInterval(refreshInterval);
      events.forEach(e => window.removeEventListener(e, resetIdle));
    };
  }, [appState]);

  return {
    appState, setAppState,
    email, setEmail, password, setPassword, showPassword, setShowPassword,
    authError, setAuthError, isLoggingIn, username, setUsername,
    isLoginView, setIsLoginView, showOtpView, setShowOtpView,
    otp, setOtp, isResetView, setIsResetView,
    newPassword, setNewPassword, isLinkSent, setIsLinkSent, resetLoading,
    onLogin,
    handleAuth, handleVerify, handleLogout,
    handleRequestResetCode, handleResetPassword, handleResetCaptchaToken,
    enterGuest,
    showCaptcha, setShowCaptcha, captchaLoading,
    handleCaptchaToken,
  };
}

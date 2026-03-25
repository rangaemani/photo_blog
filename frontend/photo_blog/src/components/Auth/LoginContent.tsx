import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '../../contexts/AuthContext';

interface Props {
  onSuccess: () => void;
}

type LoginMode = 'otp-identifier' | 'otp-code' | 'otp-name';

export default function LoginContent({ onSuccess }: Props) {
  const auth = useAuthContext();
  const [mode, setMode] = useState<LoginMode>('otp-identifier');

  // OTP state
  const [identifier, setIdentifier] = useState(() => {
    try { return localStorage.getItem('otp_identifier') ?? ''; } catch { return ''; }
  });
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('email');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [displayName, setDisplayName] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // === OTP flow ===

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await auth.requestOtp(identifier);
      try { localStorage.setItem('otp_identifier', identifier); } catch { /* */ }
      setIdentifierType(res.identifier_type);
      setOtpCode(['', '', '', '', '', '']);
      setCountdown(30);
      setMode('otp-code');
      // Focus first digit after render
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    } catch {
      setError('Failed to send code. Check your email/phone and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError('');
    try {
      await auth.requestOtp(identifier);
      setCountdown(30);
      setOtpCode(['', '', '', '', '', '']);
      digitRefs.current[0]?.focus();
    } catch {
      setError('Failed to resend code.');
    }
  };

  const submitOtpCode = useCallback(async (code: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await auth.verifyOtp(identifier, code);
      if (res.ok) {
        if (res.is_new) {
          setMode('otp-name');
        } else {
          onSuccess();
        }
      } else if (res.error === 'invalid_code') {
        setError(`Invalid code. ${res.attempts_remaining ?? '?'} attempts remaining.`);
        setOtpCode(['', '', '', '', '', '']);
        digitRefs.current[0]?.focus();
      } else if (res.error === 'expired') {
        setError('Code expired. Please request a new one.');
      } else if (res.error === 'too_many_attempts') {
        setError('Too many attempts. Please request a new code.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [auth, identifier, onSuccess]);

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (mode === 'otp-code' && otpCode.every(d => d !== '') && !isSubmitting) {
      submitOtpCode(otpCode.join(''));
    }
  }, [otpCode, mode, isSubmitting, submitOtpCode]);

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    setOtpCode(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    // Auto-advance to next input
    if (value && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleDigitKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
    // Prevent global shortcuts while typing
    e.stopPropagation();
  }, [otpCode]);

  const handleDigitPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const digits = pasted.split('');
    setOtpCode(prev => {
      const next = [...prev];
      digits.forEach((d, i) => { next[i] = d; });
      return next;
    });
    const focusIdx = Math.min(digits.length, 5);
    digitRefs.current[focusIdx]?.focus();
  }, []);

  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await auth.setDisplayName(displayName);
      onSuccess();
    } catch {
      setError('Failed to set name. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const masked = mode === 'otp-code'
    ? (identifierType === 'email'
        ? identifier.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        : identifier.replace(/(.{3})(.*)(.{2})/, '$1***$3'))
    : '';

  // Slide direction: forward through the flow goes left→right, back goes right→left
  return (
    <div style={styles.container}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          style={styles.card}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {mode === 'otp-identifier' && (
            <>
              <div style={styles.header}>
                <span style={styles.icon}>&#x2709;&#xFE0F;</span>
                <span style={styles.title}>Sign In</span>
              </div>
              <p style={styles.subtitle}>Enter your email or phone number to receive a verification code.</p>
              <form onSubmit={handleRequestOtp} style={styles.form}>
                <label style={styles.label}>
                  Email or Phone
                  <input
                    style={styles.input}
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    disabled={isSubmitting}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </label>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key={error}
                      style={styles.error}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <button type="submit" style={styles.button} disabled={isSubmitting || !identifier.trim()}>
                  {isSubmitting ? 'Sending...' : 'Send Code'}
                </button>
              </form>
            </>
          )}

          {mode === 'otp-code' && (
            <>
              <div style={styles.header}>
                <span style={styles.icon}>&#x1F4E8;</span>
                <span style={styles.title}>Enter Code</span>
              </div>
              <p style={styles.subtitle}>
                We sent a 6-digit code to <strong>{masked}</strong>
              </p>
              <div style={styles.digitRow} onPaste={handleDigitPaste}>
                {otpCode.map((digit, i) => (
                  <motion.input
                    key={i}
                    ref={el => { digitRefs.current[i] = el; }}
                    style={styles.digitInput}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    disabled={isSubmitting}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 500, damping: 25 }}
                  />
                ))}
              </div>
              <AnimatePresence>
                {error && (
                  <motion.div
                    key={error}
                    style={styles.error}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <div style={styles.resendRow}>
                <button
                  style={{
                    ...styles.backLink,
                    opacity: countdown > 0 ? 0.4 : 1,
                    cursor: countdown > 0 ? 'default' : 'pointer',
                  }}
                  onClick={handleResend}
                  disabled={countdown > 0}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                </button>
              </div>
              <button style={styles.backLink} onClick={() => { setMode('otp-identifier'); setError(''); }}>
                Use a different email/phone
              </button>
            </>
          )}

          {mode === 'otp-name' && (
            <>
              <div style={styles.header}>
                <span style={styles.icon}>&#x1F44B;</span>
                <span style={styles.title}>Welcome!</span>
              </div>
              <p style={styles.subtitle}>Choose a display name for your desktop.</p>
              <form onSubmit={handleSetName} style={styles.form}>
                <label style={styles.label}>
                  Display Name
                  <input
                    style={styles.input}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alice"
                    autoFocus
                    disabled={isSubmitting}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </label>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key={error}
                      style={styles.error}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <button type="submit" style={styles.button} disabled={isSubmitting || !displayName.trim()}>
                  {isSubmitting ? 'Saving...' : 'Continue'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 24,
    background: 'var(--window-bg)',
  },
  card: {
    width: '100%',
    maxWidth: 300,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginTop: 0,
    marginBottom: 16,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '6px 8px',
    fontSize: 13,
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    borderRadius: 0,
    outline: 'none',
    background: 'var(--inset-bg)',
    color: 'var(--text-primary)',
  },
  error: {
    fontSize: 12,
    color: '#d32f2f',
    padding: '4px 0',
  },
  button: {
    marginTop: 4,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    borderTop: '2px solid var(--bevel-highlight)',
    borderLeft: '2px solid var(--bevel-highlight)',
    borderBottom: '2px solid var(--bevel-shadow)',
    borderRight: '2px solid var(--bevel-shadow)',
    borderRadius: 0,
    background: 'var(--pale-slate)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  backLink: {
    marginTop: 12,
    padding: 0,
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  digitRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 8,
  },
  digitInput: {
    width: 36,
    height: 42,
    textAlign: 'center' as const,
    fontSize: 18,
    fontWeight: 600,
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    borderRadius: 0,
    outline: 'none',
    background: 'var(--inset-bg)',
    color: 'var(--text-primary)',
  },
  resendRow: {
    textAlign: 'center' as const,
  },
};

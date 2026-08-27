import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { cn } from './ui/utils';
import {
  evaluateNewPasswordRequirements,
  formatCountdown,
  NEW_PASSWORD_REQUIREMENT_LABELS,
  requestPasswordResetOtp,
  resetPasswordWithToken,
  validateNewPasswordClient,
  verifyPasswordResetOtp,
} from '../services/passwordResetService';

type ForgotStep = 'employee' | 'otp' | 'reset' | 'success';

interface ForgotPasswordFlowProps {
  onBackToLogin: () => void;
}

function LoginShell({
  title,
  children,
  footerExtra,
}: {
  title?: string;
  children: React.ReactNode;
  footerExtra?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="Company Logo"
                className="w-16 h-16 object-contain mb-2"
              />
            </div>
          </div>
          <h1 className="text-[#212529] font-bold">Spécialisé Products Private Limited</h1>
          {title ? <h2 className="text-lg font-semibold text-[#212529]">{title}</h2> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="flex flex-col gap-3 justify-center pb-6">
          {footerExtra}
          <p className="text-sm text-gray-500">© 2025 Spécialisé Products Private Limited</p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ForgotPasswordFlow({ onBackToLogin }: ForgotPasswordFlowProps) {
  const [step, setStep] = useState<ForgotStep>('employee');
  const [employeeCode, setEmployeeCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(6).fill(''));
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step !== 'otp' || otpExpiresAt == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step, otpExpiresAt]);

  const remainingMs = otpExpiresAt != null ? Math.max(0, otpExpiresAt - nowTick) : 0;
  const otpExpired = step === 'otp' && otpExpiresAt != null && remainingMs <= 0;
  const otpValue = otpDigits.join('');
  const otpComplete = /^\d{6}$/.test(otpValue);
  const newPasswordRequirements = evaluateNewPasswordRequirements(newPassword);

  const clearSensitiveState = useCallback(() => {
    setEmployeeCode('');
    setMaskedEmail('');
    setOtpDigits(Array(6).fill(''));
    setOtpExpiresAt(null);
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setSubmitting(false);
    setStep('employee');
  }, []);

  const handleBackToLogin = () => {
    clearSensitiveState();
    onBackToLogin();
  };

  const applyOtpExpiry = (expiresInSeconds: number) => {
    const seconds = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 180;
    setOtpExpiresAt(Date.now() + seconds * 1000);
    setNowTick(Date.now());
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = employeeCode.trim();
    if (!code) {
      toast.error('Employee ID is required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestPasswordResetOtp(code);
      setEmployeeCode(code);
      setMaskedEmail(result.maskedEmail || '');
      setOtpDigits(Array(6).fill(''));
      setResetToken('');
      applyOtpExpiry(result.expiresInSeconds);
      setStep('otp');
      toast.success(result.message || 'OTP sent');
      window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpExpired || submitting) return;
    const code = employeeCode.trim();
    if (!code) {
      toast.error('Employee ID is required');
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestPasswordResetOtp(code);
      if (result.maskedEmail) setMaskedEmail(result.maskedEmail);
      setOtpDigits(Array(6).fill(''));
      setResetToken('');
      applyOtpExpiry(result.expiresInSeconds);
      toast.success(result.message || 'A new OTP has been sent');
      window.setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to resend OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const setOtpAtIndex = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otpExpired) {
      toast.error('OTP expired. Please request a new OTP.');
      return;
    }
    if (!otpComplete) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyPasswordResetOtp(employeeCode, otpValue);
      setResetToken(result.resetToken);
      setOtpDigits(Array(6).fill(''));
      setOtpExpiresAt(null);
      setNewPassword('');
      setConfirmPassword('');
      setStep('reset');
      toast.success(result.message || 'OTP verified');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!resetToken) {
      toast.error('Password reset is not authorized. Please verify OTP again.');
      setStep('employee');
      return;
    }
    const policy = validateNewPasswordClient(newPassword, confirmPassword);
    if (!policy.ok) {
      toast.error(policy.message);
      return;
    }
    setSubmitting(true);
    try {
      const result = await resetPasswordWithToken({
        employeeCode,
        resetToken,
        newPassword,
        confirmPassword,
      });
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpDigits(Array(6).fill(''));
      setStep('success');
      toast.success(result.message || 'Password updated successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'employee') {
    return (
      <LoginShell title="Forgot Password">
        <form onSubmit={handleRequestOtp} className="space-y-5">
          <p className="text-sm text-gray-600 text-center">
            Enter your Employee ID and we&apos;ll send a verification code to your registered
            official email address.
          </p>
          <div className="space-y-2">
            <Label htmlFor="forgot-employee-id">Employee ID</Label>
            <Input
              id="forgot-employee-id"
              type="text"
              placeholder="Enter your employee ID"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              autoComplete="username"
              required
              disabled={submitting}
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#007BFF] hover:bg-[#0056b3]"
          >
            {submitting ? 'Please wait...' : 'Send OTP'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={submitting}
            onClick={handleBackToLogin}
          >
            Back to Login
          </Button>
        </form>
      </LoginShell>
    );
  }

  if (step === 'otp') {
    return (
      <LoginShell title="Verify OTP">
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div className="space-y-1 text-center text-sm text-gray-600">
            <p>A 6-digit verification code has been sent to:</p>
            <p className="font-medium text-[#212529]">{maskedEmail || 'your official email'}</p>
          </div>

          <div className="flex justify-center gap-2">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  otpRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={digit}
                disabled={submitting}
                onChange={(e) => setOtpAtIndex(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={handleOtpPaste}
                className={cn(
                  'border-input flex h-11 w-10 sm:w-11 min-w-0 rounded-md border bg-input-background px-0 py-1 text-center text-lg outline-none transition-[color,box-shadow]',
                  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                )}
                aria-label={`OTP digit ${index + 1}`}
              />
            ))}
          </div>

          <div className="text-center space-y-1">
            {otpExpired ? (
              <p className="text-sm text-red-600">OTP expired. Please request a new OTP.</p>
            ) : (
              <p className="text-sm text-gray-600">
                Time remaining:{' '}
                <span className="font-medium text-[#212529]">{formatCountdown(remainingMs)}</span>
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting || !otpComplete || otpExpired}
            className="w-full bg-[#007BFF] hover:bg-[#0056b3]"
          >
            {submitting ? 'Please wait...' : 'Verify OTP'}
          </Button>

          <div className="text-center">
            {otpExpired ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={submitting}
                onClick={() => void handleResendOtp()}
              >
                {submitting ? 'Please wait...' : 'Resend OTP'}
              </Button>
            ) : (
              <p className="text-sm text-gray-500">
                Resend OTP available in {formatCountdown(remainingMs)}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-gray-600"
            disabled={submitting}
            onClick={handleBackToLogin}
          >
            Back to Login
          </Button>
        </form>
      </LoginShell>
    );
  }

  if (step === 'reset') {
    return (
      <LoginShell title="Reset Password">
        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={submitting}
            />
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">Password must contain:</p>
            <ul className="space-y-0.5">
              {NEW_PASSWORD_REQUIREMENT_LABELS.map(({ id, label }) => {
                const met = newPasswordRequirements[id];
                return (
                  <li key={id} className="flex items-start gap-1.5">
                    <span
                      className="w-3 shrink-0 text-[11px] leading-4 text-green-700"
                      aria-hidden
                    >
                      {met ? '✔' : ''}
                    </span>
                    <span className={met ? 'text-green-700' : undefined}>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <Button
            type="submit"
            disabled={submitting || !resetToken}
            className="w-full bg-[#007BFF] hover:bg-[#0056b3]"
          >
            {submitting ? 'Please wait...' : 'Reset Password'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-gray-600"
            disabled={submitting}
            onClick={handleBackToLogin}
          >
            Back to Login
          </Button>
        </form>
      </LoginShell>
    );
  }

  return (
    <LoginShell title="Password Reset Successful">
      <div className="space-y-5 text-center">
        <p className="text-sm text-gray-600">
          Your password has been updated successfully.
          <br />
          You can now log in using your new password.
        </p>
        <Button
          type="button"
          className="w-full bg-[#007BFF] hover:bg-[#0056b3]"
          onClick={handleBackToLogin}
        >
          Back to Login
        </Button>
      </div>
    </LoginShell>
  );
}

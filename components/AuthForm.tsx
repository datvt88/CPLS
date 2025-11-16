'use client';
import { useState } from 'react';
import { authService } from '@/services/auth.service';
import { validateEmail, validatePassword, sanitizeInput } from '@/utils/validation';
// import ZaloLoginButton from './ZaloLoginButton'; // REMOVED: Using ZNS OTP instead
import RegisterForm from './RegisterForm';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login'); // Changed from isSignUp
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Sanitize inputs
      const sanitizedEmail = sanitizeInput(email);
      const sanitizedPassword = sanitizeInput(password);

      // Only handle login here - registration is in RegisterForm
      const { error } = await authService.signIn({
        email: sanitizedEmail,
        password: sanitizedPassword
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Đăng nhập thành công!');
        // Clear form on success
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  // Show RegisterForm if in register mode
  if (mode === 'register') {
    return (
      <RegisterForm
        onSuccess={() => {
          setMessage('Đăng ký thành công!');
          setMode('login');
        }}
        onSwitchToLogin={() => setMode('login')}
      />
    );
  }

  // Login form
  return (
    <div>
      <h2 className="text-2xl font-bold text-[--fg] mb-6">Đăng nhập</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            className={`w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white ${
              errors.email ? 'border-2 border-red-500' : 'border border-zinc-700'
            }`}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            disabled={loading}
            autoComplete="email"
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <input
            className={`w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white ${
              errors.password ? 'border-2 border-red-500' : 'border border-zinc-700'
            }`}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
            disabled={loading}
            autoComplete="current-password"
          />
          {errors.password && (
            <p className="text-red-400 text-xs mt-1">{errors.password}</p>
          )}
        </div>

        <button
          className="w-full bg-green-500 hover:bg-green-600 transition rounded-xl p-3 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      {/* REMOVED: Zalo OAuth - Now using ZNS OTP for registration */}

      <p
        onClick={() => {
          if (!loading) {
            setMode('register');
            setMessage('');
            setErrors({});
          }
        }}
        className={`text-sm mt-4 text-gray-400 text-center ${
          loading ? 'cursor-not-allowed' : 'cursor-pointer hover:text-gray-300'
        }`}
      >
        Chưa có tài khoản? Đăng ký ngay
      </p>

      {message && (
        <p className={`text-center text-sm mt-3 ${
          message.includes('thành công') ? 'text-green-400' : 'text-red-400'
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}

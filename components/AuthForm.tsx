'use client';
import { useState } from 'react';
import { authService } from '@/services/auth.service';
import { validatePassword, sanitizeInput } from '@/utils/validation';
import GoogleLoginButton from './GoogleLoginButton';
import RegisterForm from './RegisterForm';

export function AuthForm() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login'); // Changed from isSignUp
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ phoneNumber?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { phoneNumber?: string; password?: string } = {};

    // Validate phone number (Vietnam format)
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      newErrors.phoneNumber = 'Số điện thoại không hợp lệ';
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
      const sanitizedPhone = sanitizeInput(phoneNumber);
      const sanitizedPassword = sanitizeInput(password);

      // Login with phone number - registration is in RegisterForm
      const { error } = await authService.signInWithPhone({
        phoneNumber: sanitizedPhone,
        password: sanitizedPassword
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Đăng nhập thành công!');
        // Clear form on success
        setPhoneNumber('');
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
              errors.phoneNumber ? 'border-2 border-red-500' : 'border border-zinc-700'
            }`}
            type="tel"
            placeholder="Số điện thoại"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              if (errors.phoneNumber) setErrors({ ...errors, phoneNumber: undefined });
            }}
            disabled={loading}
            autoComplete="tel"
          />
          {errors.phoneNumber && (
            <p className="text-red-400 text-xs mt-1">{errors.phoneNumber}</p>
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

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[--panel] text-gray-400">Hoặc</span>
        </div>
      </div>

      {/* Google Login */}
      <GoogleLoginButton
        onError={(error) => setMessage(error)}
      />

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

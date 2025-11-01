'use client';
import { useState } from 'react';
import { authService } from '@/services/auth.service';
import { validateEmail, validatePassword, sanitizeInput } from '@/utils/validation';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
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

      const { error } = isSignUp
        ? await authService.signUp({ email: sanitizedEmail, password: sanitizedPassword })
        : await authService.signIn({ email: sanitizedEmail, password: sanitizedPassword });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage(
          isSignUp
            ? 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.'
            : 'Đăng nhập thành công!'
        );
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

  return (
    <div>
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
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
          {loading
            ? (isSignUp ? 'Đang đăng ký...' : 'Đang đăng nhập...')
            : (isSignUp ? 'Đăng ký' : 'Đăng nhập')
          }
        </button>
      </form>

      <p
        onClick={() => {
          if (!loading) {
            setIsSignUp(!isSignUp);
            setMessage('');
            setErrors({});
          }
        }}
        className={`text-sm mt-4 text-gray-400 text-center ${
          loading ? 'cursor-not-allowed' : 'cursor-pointer hover:text-gray-300'
        }`}
      >
        {isSignUp ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
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

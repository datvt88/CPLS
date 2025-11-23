'use client';
import { useState } from 'react';
import { authService } from '@/services/auth.service';
import { profileService } from '@/services/profile.service';
import { validatePassword, sanitizeInput } from '@/utils/validation';
import GoogleLoginButton from './GoogleLoginButton';
import { useRouter } from 'next/navigation';

export function AuthForm() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{
    phoneNumber?: string;
    password?: string;
    confirmPassword?: string;
    email?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: {
      phoneNumber?: string;
      password?: string;
      confirmPassword?: string;
      email?: string;
    } = {};

    // Validate phone number (Vietnam format)
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      newErrors.phoneNumber = 'Số điện thoại không hợp lệ';
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.error;
    }

    // Additional validation for register mode
    if (mode === 'register') {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = 'Email không hợp lệ';
      }

      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
      }
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
      const sanitizedPhone = sanitizeInput(phoneNumber);
      const sanitizedPassword = sanitizeInput(password);

      if (mode === 'login') {
        // Login
        const { error } = await authService.signInWithPhone({
          phoneNumber: sanitizedPhone,
          password: sanitizedPassword
        });

        if (error) {
          setMessage(error.message);
        } else {
          setMessage('Đăng nhập thành công!');
          setTimeout(() => router.push('/dashboard'), 1000);
        }
      } else {
        // Register
        const sanitizedEmail = sanitizeInput(email);

        const { data: signUpData, error: signUpError } = await authService.signUp({
          email: sanitizedEmail,
          password: sanitizedPassword,
        });

        if (signUpError) {
          throw new Error(signUpError.message || 'Không thể tạo tài khoản');
        }

        if (!signUpData.user) {
          throw new Error('Không thể tạo tài khoản');
        }

        // Create profile
        await profileService.upsertProfile({
          id: signUpData.user.id,
          email: sanitizedEmail,
          phone_number: sanitizedPhone,
          full_name: fullName || 'User',
          membership: 'free',
        });

        setMessage('Đăng ký thành công!');
        setTimeout(() => {
          setMode('login');
          setPhoneNumber('');
          setPassword('');
          setConfirmPassword('');
          setEmail('');
          setFullName('');
          setMessage('');
        }, 2000);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">
        {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name - Register only */}
        {mode === 'register' && (
          <div>
            <input
              className="w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white border border-zinc-700 placeholder-gray-500"
              type="text"
              placeholder="Họ và tên (tùy chọn)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        {/* Phone Number */}
        <div>
          <input
            className={`w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white placeholder-gray-500 ${
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

        {/* Email - Register only */}
        {mode === 'register' && (
          <div>
            <input
              className={`w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white placeholder-gray-500 ${
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
        )}

        {/* Password */}
        <div>
          <input
            className={`w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white placeholder-gray-500 ${
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
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {errors.password && (
            <p className="text-red-400 text-xs mt-1">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password - Register only */}
        {mode === 'register' && (
          <div>
            <input
              className={`w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white placeholder-gray-500 ${
                errors.confirmPassword ? 'border-2 border-red-500' : 'border border-zinc-700'
              }`}
              type="password"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
              }}
              disabled={loading}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          className="w-full bg-green-500 hover:bg-green-600 transition rounded-xl p-3 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
          disabled={loading}
        >
          {loading
            ? (mode === 'login' ? 'Đang đăng nhập...' : 'Đang đăng ký...')
            : (mode === 'login' ? 'Đăng nhập' : 'Đăng ký')
          }
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-zinc-900 text-gray-400">Hoặc</span>
        </div>
      </div>

      {/* Google Login */}
      <GoogleLoginButton
        onError={(error) => setMessage(error)}
      />

      {/* Switch Mode */}
      <p
        onClick={() => {
          if (!loading) {
            setMode(mode === 'login' ? 'register' : 'login');
            setMessage('');
            setErrors({});
            setConfirmPassword('');
            setEmail('');
            setFullName('');
          }
        }}
        className={`text-sm mt-4 text-gray-400 text-center ${
          loading ? 'cursor-not-allowed' : 'cursor-pointer hover:text-gray-300'
        }`}
      >
        {mode === 'login'
          ? 'Chưa có tài khoản? Đăng ký ngay'
          : 'Đã có tài khoản? Đăng nhập ngay'
        }
      </p>

      {/* Message */}
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

'use client';

import { useState } from 'react';
import { authService } from '@/services/auth.service';
import { profileService } from '@/services/profile.service';
import { validatePassword, sanitizeInput } from '@/utils/validation';
import GoogleLoginButton from './GoogleLoginButton';
import { useRouter } from 'next/navigation';

type AuthMode = 'login' | 'register';

interface FormErrors {
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
  email?: string;
}

export function AuthForm() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<AuthMode>('login');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Vietnam phone number validation
  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    return phoneRegex.test(phone);
  };

  // Email validation
  const validateEmail = (emailValue: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      newErrors.phoneNumber = 'Số điện thoại không hợp lệ';
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.error;
    }

    if (mode === 'register') {
      if (!email || !validateEmail(email)) {
        newErrors.email = 'Email không hợp lệ';
      }

      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    const sanitizedPhone = sanitizeInput(phoneNumber);
    const sanitizedPassword = sanitizeInput(password);

    const { data, error } = await authService.signInWithPhone({
      phoneNumber: sanitizedPhone,
      password: sanitizedPassword
    });

    if (error) {
      setMessage(error.message);
    } else if (data?.user) {
      setMessage('Đăng nhập thành công!');
      setTimeout(() => router.push('/dashboard'), 1000);
    } else {
      setMessage('Đăng nhập thất bại. Vui lòng thử lại.');
    }
  };

  const handleRegister = async () => {
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);
    const sanitizedPhone = sanitizeInput(phoneNumber);

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

    // Check if email confirmation is required
    const emailConfirmationRequired = !signUpData.session;

    if (emailConfirmationRequired) {
      setMessage(`✅ Đăng ký thành công! Vui lòng kiểm tra email ${sanitizedEmail} để xác thực tài khoản.`);
    } else {
      setMessage('Đăng ký thành công!');
      setTimeout(() => {
        resetForm();
        setMode('login');
      }, 2000);
    }
  };

  const resetForm = () => {
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setFullName('');
    setMessage('');
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setErrors({});

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (mode === 'login') {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    if (loading) return;
    setMode(mode === 'login' ? 'register' : 'login');
    setMessage('');
    setErrors({});
    setConfirmPassword('');
    setEmail('');
    setFullName('');
  };

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6 text-left">
        {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name - Register only */}
        {mode === 'register' && (
          <div>
            <input
              className="w-full p-3 bg-[#1a1a1a] rounded-lg focus:outline-none text-white border border-gray-800 placeholder-gray-500 focus:border-green-500 transition-colors"
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
            className={`w-full p-3 bg-[#1a1a1a] rounded-lg focus:outline-none text-white placeholder-gray-500 transition-colors ${
              errors.phoneNumber ? 'border-2 border-red-500' : 'border border-gray-800 focus:border-green-500'
            }`}
            type="tel"
            placeholder="Số điện thoại"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              clearError('phoneNumber');
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
              className={`w-full p-3 bg-[#1a1a1a] rounded-lg focus:outline-none text-white placeholder-gray-500 transition-colors ${
                errors.email ? 'border-2 border-red-500' : 'border border-gray-800 focus:border-green-500'
              }`}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError('email');
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
            className={`w-full p-3 bg-[#1a1a1a] rounded-lg focus:outline-none text-white placeholder-gray-500 transition-colors ${
              errors.password ? 'border-2 border-red-500' : 'border border-gray-800 focus:border-green-500'
            }`}
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError('password');
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
              className={`w-full p-3 bg-[#1a1a1a] rounded-lg focus:outline-none text-white placeholder-gray-500 transition-colors ${
                errors.confirmPassword ? 'border-2 border-red-500' : 'border border-gray-800 focus:border-green-500'
              }`}
              type="password"
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearError('confirmPassword');
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
          className="w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 transition-all rounded-lg p-3 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
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
          <div className="w-full border-t border-gray-800"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-black text-gray-500">Hoặc</span>
        </div>
      </div>

      {/* Google Login */}
      <GoogleLoginButton onError={(error) => setMessage(error)} />

      {/* Switch Mode */}
      <p
        onClick={switchMode}
        className={`text-sm mt-4 text-gray-500 text-center ${
          loading ? 'cursor-not-allowed' : 'cursor-pointer hover:text-gray-400'
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

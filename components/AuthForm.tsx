'use client';
import PhoneAuthForm from './PhoneAuthForm';

/**
 * Main authentication form component
 * Uses phone number + OTP authentication via Zalo ZNS
 */
export function AuthForm() {
  return (
    <div>
      <PhoneAuthForm
        defaultPurpose="login"
        redirectTo="/dashboard"
      />
    </div>
  );
}

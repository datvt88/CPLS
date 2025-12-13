import { redirect } from 'next/navigation'

/**
 * Legacy Login Page - Redirects to /auth/login
 * 
 * This page exists for backward compatibility.
 * All login functionality has been moved to /auth/login.
 */
export default function LoginPage() {
  redirect('/auth/login')
}

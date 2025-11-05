export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email không được để trống' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Email không hợp lệ' }
  }

  return { valid: true }
}

export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (!password) {
    return { valid: false, error: 'Mật khẩu không được để trống' }
  }

  if (password.length < 6) {
    return { valid: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' }
  }

  return { valid: true }
}

export const sanitizeInput = (input: string): string => {
  // Remove potential XSS characters
  return input.trim().replace(/[<>]/g, '')
}

export type PasswordRule = { label: string; met: boolean }

export const passwordRules = (value: string): PasswordRule[] => [
  { label: 'A senha deve ter mínimo 8 e máximo 70 caracteres.', met: value.length >= 8 && value.length <= 70 },
  { label: 'A senha deve ter pelo menos uma letra maiúscula.', met: /[A-Z]/.test(value) },
  { label: 'A senha deve ter pelo menos uma letra minúscula.', met: /[a-z]/.test(value) },
  { label: 'A senha deve ter pelo menos um número.', met: /[0-9]/.test(value) },
  { label: 'A senha deve ter pelo menos um símbolo. Ex.: * ! # $ % & + - / : ; = ? @ \\ |', met: /[^A-Za-z0-9]/.test(value) },
]

export const isStrongPassword = (value: string) => passwordRules(value).every(rule => rule.met)

export const digits = (value: string) => value.replace(/\D/g, '')
export const maskCnpj = (value: string) => digits(value).slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
export const maskPhone = (value: string) => { const v = digits(value).slice(0, 11); if (v.length <= 10) return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2'); return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2') }
export const maskCep = (value: string) => digits(value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
export const maskCrm = (value: string) => { const raw = value.toUpperCase().replace(/^CRM[-\s]*/, '').replace(/[^A-Z0-9]/g, '').slice(0, 8); const uf = raw.match(/^[A-Z]{1,2}/)?.[0] ?? ''; const number = raw.slice(uf.length).replace(/\D/g, '').slice(0, 6); return `CRM${uf ? `-${uf}` : ''}${number ? ` ${number}` : ''}` }
export const normalizeEmail = (value: string) => value.trim().toLowerCase().replace(/\s/g, '')
export const validEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

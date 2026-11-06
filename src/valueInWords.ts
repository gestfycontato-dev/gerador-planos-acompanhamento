const units = ['', 'um', 'dois', 'tr\u00eas', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function groupWords(value: number): string {
  if (value === 100) return 'cem'
  const parts: string[] = []
  const h = Math.floor(value / 100)
  const remainder = value % 100
  if (h) parts.push(hundreds[h])
  if (remainder) {
    if (remainder < 10) parts.push(units[remainder])
    else if (remainder < 20) parts.push(teens[remainder - 10])
    else {
      const t = Math.floor(remainder / 10)
      const unit = remainder % 10
      parts.push(unit ? `${tens[t]} e ${units[unit]}` : tens[t])
    }
  }
  return parts.join(' e ')
}

function integerWords(value: number): string {
  if (value === 0) return 'zero'
  const millions = Math.floor(value / 1_000_000)
  const thousands = Math.floor((value % 1_000_000) / 1_000)
  const remainder = value % 1_000
  const parts: string[] = []
  if (millions) parts.push(millions === 1 ? 'um milh\u00e3o' : `${groupWords(millions)} milh\u00f5es`)
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${groupWords(thousands)} mil`)
  if (remainder) parts.push(groupWords(remainder))
  return parts.join(remainder > 0 && remainder < 100 ? ' e ' : ' ')
}

export function valueInWords(value: number): string {
  const centsTotal = Math.round(value * 100)
  const reais = Math.floor(centsTotal / 100)
  const cents = centsTotal % 100
  const realText = `${integerWords(reais)} ${reais === 1 ? 'real' : 'reais'}`
  if (!cents) return realText
  return `${realText} e ${integerWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`
}

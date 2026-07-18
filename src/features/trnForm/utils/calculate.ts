import type { NumberSeparators } from '@/shared/lib/format'
import { formatByCurrency } from '@/shared/lib/formatByCurrency'

const config = {
  decimalPlaces: 8,
  maxIntegerLength: 999
} as const

/**
 * İKİ AYRI GÖSTERİM VAR, karıştırılırsa sayı bozulur:
 *
 *  - KANONİK  : ayraçsız, ondalık nokta ("1200.5"). İfadenin ve hesabın dili.
 *  - GÖRÜNEN  : kullanıcının ayarındaki biçim ("1.200,5" / "1 200.5"). Yalnız
 *               ekranda ve values.amountRaw içinde durur.
 *
 * Sınırlar net: sanitizeInput GÖRÜNEN→KANONİK, formatInput KANONİK→GÖRÜNEN.
 * evaluateAbsExpression yalnız KANONİK alır.
 *
 * Neden önemli: `dot_comma` biçiminde (1.000,33) binlik ayracı NOKTA — yani
 * kanonik ondalık işaretiyle aynı karakter. Görüneni kanonik sanıp
 * değerlendirirsek "1.200" (bin iki yüz) sessizce 1.2'ye döner. Bu yüzden
 * sanitize ÖNCE binlikleri atar, SONRA ondalığı noktaya çevirir.
 */
export const CANONICAL_SEPARATORS: NumberSeparators = { group: ' ', decimal: '.' }

type CalculatorOperator = '+' | '-' | '*' | '/'
type CalculatorAction = '=' | 'c' | '.' | CalculatorOperator
type CalculatorInput = string | number

export type CalculatorKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '+' | '-' | '*' | '/' | '.' | 'c'

function splitExpression(value: string): string[] {
  return value.split(/([/*\-+])/).filter(Boolean)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** GÖRÜNEN → KANONİK. Sıra önemli: önce binlikler atılır, sonra ondalık çevrilir. */
function sanitizeInput(value: string, seps: NumberSeparators = CANONICAL_SEPARATORS): string {
  let out = String(value)
  if (seps.group) out = out.replace(new RegExp(escapeRegExp(seps.group), 'g'), '')
  if (seps.decimal !== '.') out = out.replace(new RegExp(escapeRegExp(seps.decimal), 'g'), '.')
  // Operatörlerin çevresindeki boşluklar (formatInput " + " yazıyor) her hâlde atılır.
  return out.replace(/\s/g, '')
}

function isOperator(value: string): boolean {
  return /[/*\-+]/.test(value)
}

function isValidAction(value: string): value is CalculatorAction {
  return ['*', '+', '-', '.', '/', '=', 'c'].includes(value)
}

function getLastNumber(expression: string): string {
  return expression.split(/[/*\-+]/).at(-1) || ''
}

/**
 * Güvenli aritmetik ifade değerlendirici (özyinelemeli inişli ayrıştırıcı).
 * +, -, *, / işlemlerini doğru öncelikle destekler. eval/Function YOK.
 *
 * ⚠️ SONUÇ HER ZAMAN MUTLAK DEĞERDİR — ad bunu söylüyor (O-8).
 * `'100-150'` → **50**, −50 değil.
 *
 * Neden: bu bir genel amaçlı hesap makinesi değil, TUTAR alanının motoru.
 * Tutarlar pozitif büyüklük olarak saklanır; işareti işlemin TÜRÜ (gelir/gider)
 * taşır. Negatif bir tutar kaydetmek "eksi gider" gibi geçersiz bir durum
 * üretirdi. Eskiden fonksiyon `evaluateExpression` adındaydı ve bu davranış
 * yalnızca gövdedeki `Math.abs` çağrısından anlaşılıyordu — çağıran taraf
 * işaretin korunduğunu sanabilirdi.
 */
export function evaluateAbsExpression(value: string): number {
  try {
    const sanitized = sanitizeInput(value, CANONICAL_SEPARATORS)
    const lastChar = sanitized.at(-1) || ''
    const expression = isOperator(lastChar) ? sanitized.slice(0, -1) : sanitized || '0'

    let pos = 0

    function parseExpr(): number {
      let left = parseTerm()
      while (pos < expression.length && (expression[pos] === '+' || expression[pos] === '-')) {
        const op = expression[pos++]
        const right = parseTerm()
        left = op === '+' ? left + right : left - right
      }
      return left
    }

    function parseTerm(): number {
      let left = parseNumber()
      while (pos < expression.length && (expression[pos] === '*' || expression[pos] === '/')) {
        const op = expression[pos++]
        const right = parseNumber()
        left = op === '*' ? left * right : left / right
      }
      return left
    }

    function parseNumber(): number {
      const start = pos
      while (
        pos < expression.length &&
        ((expression[pos]! >= '0' && expression[pos]! <= '9') || expression[pos] === '.')
      ) {
        pos++
      }
      return Number(expression.slice(start, pos)) || 0
    }

    const result = parseExpr()

    if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER) return 0

    const abs = Math.abs(result)
    return Number.isInteger(abs) ? abs : +abs.toFixed(config.decimalPlaces)
  } catch {
    return 0
  }
}

function handleDecimalPoint(expression: string, lastChar: string): string {
  const currentNumber = getLastNumber(expression)

  if (currentNumber.includes('.') || lastChar === '.') return expression

  if (!expression || isOperator(lastChar)) return `${expression}0.`

  return `${expression}.`
}

/** Tuş + GÖRÜNEN ifade → yeni KANONİK ifade. */
export function createExpressionString(
  input: string,
  expression: string,
  seps: NumberSeparators = CANONICAL_SEPARATORS
): string {
  const sanitizedExpression = sanitizeInput(expression, seps)
  const lastChar = sanitizedExpression.at(-1) || ''
  const isActionInput = isValidAction(input)

  if (input === 'c')
    return sanitizedExpression === '0' ? '0' : sanitizedExpression.slice(0, -1) || '0'
  if (input === '=') return String(evaluateAbsExpression(sanitizedExpression))
  if (input === '.') return handleDecimalPoint(sanitizedExpression, lastChar)

  if (sanitizedExpression === '0') {
    return input === '0' ? sanitizedExpression : isActionInput ? `0${input}` : input
  }

  if (isActionInput && isOperator(lastChar)) {
    return sanitizedExpression.slice(0, -1) + input
  }

  if (!isActionInput) {
    const currentNumber = getLastNumber(sanitizedExpression)
    const [integerPart, decimalPart] = currentNumber.split('.')

    const isExceedingLength =
      (!decimalPart && integerPart && integerPart?.length >= config.maxIntegerLength) ||
      (decimalPart && decimalPart?.length >= config.decimalPlaces)

    if (isExceedingLength) return sanitizedExpression

    if (lastChar !== '.' && evaluateAbsExpression(sanitizedExpression + input) === 0)
      return sanitizedExpression
  }

  return sanitizedExpression + input
}

/** KANONİK → GÖRÜNEN. Girdi her zaman kanonik olmalı (sayı ya da kanonik ifade). */
export function formatInput(
  value: CalculatorInput,
  seps: NumberSeparators = CANONICAL_SEPARATORS
): string {
  return splitExpression(String(value))
    .map((part) => {
      if (isOperator(part)) return ` ${part} `

      const isDecimal = part.at(-1) === '.'
      const [integerPart, decimalPart] = sanitizeInput(part, CANONICAL_SEPARATORS).split('.')
      const formattedInteger = formatByCurrency(integerPart || '', seps.group)

      return decimalPart
        ? `${formattedInteger}${seps.decimal}${decimalPart}`
        : `${formattedInteger}${isDecimal ? seps.decimal : ''}`
    })
    .join('')
}

/**
 * GÖRÜNEN metne "kuruş" doldurma — YALNIZ ekran için, saklanan değere DEĞİL.
 *
 * Kural: kullanıcı ondalık ayracına basmadıysa (kuruşa dokunmadıysa) her tam
 * sayı "xxxx,00" gösterilir. Ondalık ayracı zaten varsa kullanıcı kuruş
 * giriyordur — olduğu gibi bırakılır; soldan sağa yazımı bozmamak için 0'la
 * DOLDURULMAZ ("1,3" yazarken "1,30"a çevirmek 7'yi beklerken şaşırtır).
 *
 * Neden amountRaw'a YAZILMAZ, ayrı bir görüntü katmanında yaşar: amountRaw bir
 * sonraki tuşta yeniden ayrıştırılıyor (createExpressionString onu sanitize
 * ediyor). Oraya ",00" eklersek "3.272.460" sanitize'de "3272460.00" olur ve
 * sonraki rakam "3272460.005" gibi bozulur. Doldurma bu yüzden salt görsel.
 *
 * İfadede her sayıya ayrı uygulanır: "1200" + tuş "+" + "250" → "1.200,00 +
 * 250,00". Bu tutarlı — her operand'da tamsayı soldan büyür, kuruş 00'da durur.
 */
export function padDisplayCents(
  display: string,
  seps: NumberSeparators = CANONICAL_SEPARATORS
): string {
  const text = display || '0'
  // formatInput operatörleri boşlukla sarıyor (" + "); operatör segmentlerini
  // ayır ve dokunma, yalnız sayı segmentlerini doldur.
  return text
    .split(/(\s[/*\-+]\s)/)
    .map((seg) => {
      if (!seg || /^\s[/*\-+]\s$/.test(seg)) return seg
      return seg.includes(seps.decimal) ? seg : `${seg}${seps.decimal}00`
    })
    .join('')
}

/**
 * Hesaplanan tutarı (ipucundaki "= ..." önizlemesi) tam 2 ondalıkla biçimler:
 * matematik sonucu da kuruşlu görünsün ("1450" → "1.450,00", "1450.5" →
 * "1.450,50"). toFixed yalnız önizleme içindir; saklanan değere dokunmaz.
 */
export function formatAmountResult(
  value: number,
  seps: NumberSeparators = CANONICAL_SEPARATORS
): string {
  return formatInput(value.toFixed(2), seps)
}

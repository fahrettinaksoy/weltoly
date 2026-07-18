import { describe, expect, it } from 'vitest'

import {
  createExpressionString,
  evaluateAbsExpression,
  formatAmountResult,
  formatInput,
  padDisplayCents
} from './calculate'

describe('evaluateAbsExpression', () => {
  it('işlem önceliğini uygular', () => {
    expect(evaluateAbsExpression('2+2*3')).toBe(8)
    expect(evaluateAbsExpression('10/2')).toBe(5)
    expect(evaluateAbsExpression('100-40')).toBe(60)
  })

  it('sona takılı operatörü yok sayar', () => {
    expect(evaluateAbsExpression('10+')).toBe(10)
  })

  it('ondalık sonucu döndürür', () => {
    expect(evaluateAbsExpression('1/4')).toBe(0.25)
  })

  it('boş/geçersiz girdide 0 döner', () => {
    expect(evaluateAbsExpression('')).toBe(0)
  })

  /**
   * O-8: sonuç MUTLAK DEĞERDİR — bilinçli. Tutarlar pozitif büyüklük olarak
   * saklanır, işareti işlemin türü taşır. Ad ("Abs") bunu duyurur; bu test
   * davranışı kilitler ki "işaret kayboluyor" diye sessizce düzeltilmesin.
   */
  it('sonuç her zaman mutlak değerdir (100-150 → 50, -50 DEĞİL)', () => {
    expect(evaluateAbsExpression('100-150')).toBe(50)
    expect(evaluateAbsExpression('0-7')).toBe(7)
  })
})

describe('createExpressionString', () => {
  it('rakam ekler', () => {
    expect(createExpressionString('5', '')).toBe('5')
    expect(createExpressionString('3', '12')).toBe('123')
  })

  it('baştaki sıfırı değiştirir', () => {
    expect(createExpressionString('7', '0')).toBe('7')
  })

  it('c geri siler', () => {
    expect(createExpressionString('c', '123')).toBe('12')
    expect(createExpressionString('c', '0')).toBe('0')
  })

  it('operatörü değiştirir', () => {
    expect(createExpressionString('-', '10 + ')).toBe('10-')
  })

  it('= ifadeyi hesaplar', () => {
    expect(createExpressionString('=', '2+2*3')).toBe('8')
  })
})

describe('formatInput', () => {
  it('binlik ayraç ekler', () => {
    expect(formatInput('1234567')).toBe('1 234 567')
  })

  it('ondalık kısmı korur', () => {
    expect(formatInput('1234.5')).toBe('1 234.5')
  })

  it('yerel ayraçları uygular (dot_comma: 1.234.567,8)', () => {
    expect(formatInput('1234567.8', { group: '.', decimal: ',' })).toBe('1.234.567,8')
  })

  it('yerel ayraçları uygular (comma_dot: 1,234,567.8)', () => {
    expect(formatInput('1234567.8', { group: ',', decimal: '.' })).toBe('1,234,567.8')
  })
})

// Yerelleştirmenin ASIL tuzağı: binlik ayracı NOKTA olan biçimde (1.000,33)
// görünen metin, kanonik ondalık noktasıyla karışabilir. Bu blok görünen→kanonik
// dönüşümünü createExpressionString üzerinden kilitler (sanitizeInput dışa
// açık değil; bu fonksiyon onu içeriden çağırıyor).
describe('createExpressionString (yerel ayraçlar)', () => {
  const dotComma = { group: '.', decimal: ',' }

  it('nokta-binlikli görünene rakam eklemeyi doğru sürdürür', () => {
    // Görünen "1.200" (bin iki yüz) + tuş "5" → kanonik "12005", "1.2005" DEĞİL.
    expect(createExpressionString('5', '1.200', dotComma)).toBe('12005')
  })

  it('virgül ondalıklı görünene rakam ekler', () => {
    // Görünen "2,5" + "0" → kanonik "2.50"
    expect(createExpressionString('0', '2,5', dotComma)).toBe('2.50')
  })

  it('operatör sonrası kanonik ifade kurar', () => {
    // Görünen "1.200,5 + 2,5"e "=" → kanonik "1203"
    expect(createExpressionString('=', '1.200,5 + 2,5', dotComma)).toBe('1203')
  })

  it('comma_dot biçiminde binlik virgülü çözer', () => {
    // Görünen "1,200" (bin iki yüz) + "=" → 1200
    expect(createExpressionString('=', '1,200', { group: ',', decimal: '.' })).toBe('1200')
  })
})

// "Her zaman xxxx,00" — kullanıcı kuruşa dokunmadıkça tam sayılar kuruşlu
// gösterilir; ondalık ayracı varsa (kuruş giriliyorsa) olduğu gibi kalır.
describe('padDisplayCents', () => {
  const dc = { group: '.', decimal: ',' }

  it('tam sayıyı ,00 ile gösterir', () => {
    expect(padDisplayCents('3.272.460', dc)).toBe('3.272.460,00')
  })

  it('boş/sıfır → 0,00 (varsayılan)', () => {
    expect(padDisplayCents('', dc)).toBe('0,00')
    expect(padDisplayCents('0', dc)).toBe('0,00')
  })

  it('kullanıcı kuruş giriyorsa DOLDURMAZ (soldan sağa yazım korunur)', () => {
    expect(padDisplayCents('3.272.460,', dc)).toBe('3.272.460,')
    expect(padDisplayCents('3.272.460,3', dc)).toBe('3.272.460,3')
    expect(padDisplayCents('3.272.460,37', dc)).toBe('3.272.460,37')
  })

  it('ifadede her operandı ayrı doldurur', () => {
    expect(padDisplayCents('1.200 + 250', dc)).toBe('1.200,00 + 250,00')
  })

  it('comma_dot biçimi', () => {
    expect(padDisplayCents('3,272,460', { group: ',', decimal: '.' })).toBe('3,272,460.00')
  })
})

describe('formatAmountResult', () => {
  const dc = { group: '.', decimal: ',' }

  it('tam sonucu ,00 ile biçimler', () => {
    expect(formatAmountResult(1450, dc)).toBe('1.450,00')
  })

  it('ondalık sonucu 2 haneye tamamlar', () => {
    expect(formatAmountResult(1450.5, dc)).toBe('1.450,50')
  })
})

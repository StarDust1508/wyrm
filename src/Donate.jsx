/* ============================================================
   Galathilion — страница поддержки (донаты через QR + почта).
   QR генерируется КЛИЕНТСКИ (qrcode, без внешних сервисов — важно для РФ-контура)
   из ссылки на оплату. Ссылку/реквизиты владелец подставляет в DONATE ниже.
   ============================================================ */
import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// >>> ЗАПОЛНИТЬ владельцу <<<
export const DONATE = {
  url: '',                              // ссылка на оплату: ЮMoney / CloudTips / Tinkoff / СБП. Пусто — покажет заглушку.
  method: 'ЮMoney · СБП',               // подпись способа
  requisite: '',                        // необязательно: номер карты или телефон СБП (текстом)
  email: 'donate@galathilion.ru',       // почта для донатов и вопросов
}

export function DonatePage({ go }) {
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const has = !!(DONATE.url && DONATE.url.trim())
  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (has) {
      QRCode.toDataURL(DONATE.url.trim(), { margin: 1, scale: 9, errorCorrectionLevel: 'M', color: { dark: '#14110d', light: '#f7f4ec' } })
        .then(setQr).catch(() => setQr(''))
    }
  }, [])
  const copy = () => { try { navigator.clipboard.writeText(DONATE.url.trim()); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch (_) {} }
  return (
    <div className="view wrap" style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(32px,6vh,72px) 0 90px', textAlign: 'center' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Поддержка</div>
      <h1 className="display" style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', marginBottom: 16, lineHeight: 1.05 }}>Поддержать Galathilion</h1>
      <p className="serif" style={{ color: 'var(--ink-2)', maxWidth: '42ch', margin: '0 auto 34px', lineHeight: 1.6, fontSize: '1.05rem' }}>
        Платформа держится на энтузиазме. Поддержка помогает оплачивать сервер и развивать
        инструменты для авторов. Отсканируйте QR-код камерой или банковским приложением.
      </p>

      <div className="donate-card">
        {has
          ? (qr
              ? <img src={qr} alt="QR-код для поддержки" className="donate-qr" width="240" height="240" />
              : <div className="donate-qr donate-qr-empty mono">генерирую QR…</div>)
          : <div className="donate-qr donate-qr-empty mono">QR появится, когда будут указаны реквизиты для оплаты</div>}
        <div className="mono donate-method">{DONATE.method}</div>
        {has && (
          <div className="donate-actions">
            <a className="btn btn-primary" href={DONATE.url.trim()} target="_blank" rel="noopener noreferrer">Открыть оплату</a>
            <button className="btn btn-ghost" onClick={copy}>{copied ? 'скопировано ✓' : 'скопировать ссылку'}</button>
          </div>
        )}
        {DONATE.requisite && <div className="mono donate-req">или напрямую: {DONATE.requisite}</div>}
      </div>

      <p className="mono" style={{ fontSize: '.62rem', color: 'var(--ink-3)', marginTop: 28, lineHeight: 1.6 }}>
        Другие способы поддержки или вопросы — на почту{' '}
        <a className="cookie-link" href={`mailto:${DONATE.email}`}>{DONATE.email}</a>
      </p>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 28 }} onClick={() => go('home')}>На главную</button>
    </div>
  )
}

export default DonatePage

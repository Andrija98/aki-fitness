// IPS QR kod kao slika, sa dugmetom za čuvanje (za plaćanje sa istog telefona: slika se učita u aplikaciji banke).
// Biblioteka qrcode se učitava tek kad je potrebna, da ne povećava aplikaciju za ostale ekrane.

import { useEffect, useState } from 'react';

export default function IpsQr({ payload, alt = 'IPS QR kod za uplatu' }) {
  const [qr, setQr] = useState(null); // null = pravi se, '' = nije uspelo
  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 560 }))
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { if (!cancelled) setQr(''); });
    return () => { cancelled = true; };
  }, [payload]);

  if (qr === '') return <p className="login-error" role="alert">QR kod nije napravljen. Uplati preko podataka ispod.</p>;
  if (!qr) return null;
  return (
    <>
      <img className="ips-qr" src={qr} alt={alt} />
      <a className="pill-btn ips-download" href={qr} download="clanarina-qr.png">Sačuvaj QR kao sliku</a>
    </>
  );
}

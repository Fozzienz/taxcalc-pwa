# TaxTrack blueprint

What is in the app, and what is waiting. This is a working list, not a promise of dates.

## Done

- Local records: income years, working-from-home hours, expenses, receipts, assets, rentals, car kilometres.
- Summary, Excel, and PDF for the selected income year.
- JSON backup from Data and backup.
- Sign-in is required before the summary. Email and password.
- Vault key created in the browser. Password and recovery key wrap it. Supabase stores the wraps, salts, and ciphertext.
- Upload this device, and download to this device, for the encrypted record and each receipt file.

## Later

- Biometrics on this device, such as Face ID, Touch ID, or Windows Hello, to unlock the vault without retyping the password.
- A PIN on this device, as a backup when biometrics are unavailable.
- The vault key stays in memory only until those exist. A refresh asks for the password again.
- Automatic sync. Upload and download stay as separate actions so one device does not silently replace the other.
- Custom email sender. The built-in Supabase mailer is enough for one account.

## Supabase

- Project URL `https://xjadidyyolscrlmkyauh.supabase.co`
- Publishable key in `.env.local` on this computer. The secret key stays in Supabase.
- Site URL `https://taxcalc-pwa.vercel.app`
- Redirect URLs include `http://localhost:3001` and `https://taxcalc-pwa.vercel.app`
- Tables `profiles`, `encrypted_records`, `encrypted_receipts`, with row level security.
- A password-reset link must land on one of those addresses. If it does not, add that full address under Authentication → URL Configuration.

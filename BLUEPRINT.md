# TaxTrack blueprint

What is in the app, and what is waiting. This is a working list, not a promise of dates.

## Done

- Local records: income years, working-from-home hours, expenses, receipts, assets, rentals, car kilometres.
- Summary, Excel, and PDF for the selected income year.
- JSON backup from Data and backup.
- Sign-in is required before the summary. Email and password.
- Vault key created in the browser. Password and recovery key wrap it. Supabase stores the wraps, salts, and ciphertext.
- Signing in opens that account's encrypted records on the device. Later changes are encrypted and stored with the account.
- Change password from Account. The new password re-wraps the vault. The recovery key stays the same.
- Sign-up confirmation and password reset use Supabase's built-in email.
- The vault key stays in memory only. A refresh asks for the password again. No device PIN or biometrics.

## Later

- Nothing waiting.

## Supabase

- Project URL `https://xjadidyyolscrlmkyauh.supabase.co`
- Publishable key in `.env.local` on this computer. The secret key stays in Supabase.
- Site URL `https://taxcalc-pwa.vercel.app`
- Redirect URLs include `http://localhost:3001` and `https://taxcalc-pwa.vercel.app`
- Tables `profiles`, `encrypted_records`, `encrypted_receipts`, with row level security.
- Delete account uses `public.delete_own_account()`. Run `supabase/delete_own_account.sql` once in the SQL editor. It removes the signed-in user, and the three tables follow.
- A password-reset link must land on one of those addresses. If it does not, add that full address under Authentication → URL Configuration.

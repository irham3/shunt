<aside>
🧭

**Keputusan utama:** Shunt tidak perlu menjadi anchor. Shunt tetap menjadi aplikasi non-custodial dan mengintegrasikan MoneyGram atau anchor lain sebagai operator fiat on/off-ramp.

</aside>

## Ringkasan

Untuk membuat integrasi MoneyGram dianggap nyata, langkah pertama bukan sekadar mengganti `VITE_ANCHOR_HOME_DOMAIN`. Shunt perlu melakukan onboarding sebagai **non-custodial Stellar wallet/application**, menyiapkan domain dan `stellar.toml`, lalu meminta domain tersebut di-allowlist pada environment staging MoneyGram.

Alur yang benar:

```
Domain + stellar.toml
→ staging allowlist
→ SEP-10/SEP-24 integration
→ staging test cases
→ certification
→ KYB dan legal
→ production preview
→ full production
```

## Pembagian peran

| Komponen | Peran |
| --- | --- |
| Shunt | User-facing non-custodial application, rules engine, income detection, split, dan Savings Vault. |
| MoneyGram Ramps | Operator cash-to-USDC dan USDC-to-cash, termasuk KYC, cash locations, dan settlement. |
| Soroban contract | Menyimpan dan menegakkan aturan Savings, timelock, withdrawal, dan penalty. |
| Stellar SEP-10/SEP-24 | Standar autentikasi wallet dan hosted deposit/withdrawal. |

# Tahapan implementasi

## 1. Tentukan domain resmi Shunt

Aplikasi saat ini tersedia di:

```
https://shunt-app.vercel.app
```

Domain tersebut dapat digunakan untuk staging awal. Untuk production, sebaiknya gunakan domain sendiri, misalnya:

```
https://shunt.finance
https://app.shunt.finance
```

Struktur yang disarankan:

```
https://shunt.finance/.well-known/stellar.toml
https://app.shunt.finance
```

Keuntungan domain sendiri:

- Tidak bergantung pada provider hosting tertentu.
- Lebih profesional untuk KYB dan legal review.
- Tetap stabil ketika hosting dipindahkan.
- Lebih mudah digunakan sebagai `home_domain` pada SEP-10.
- Memperjelas identitas Shunt sebagai wallet integrator.

## 2. Buat signing key khusus domain

Buat Stellar testnet keypair khusus untuk identitas domain Shunt:

```bash
stellar keys generate shunt-domain-testnet --network testnet
stellar keys address shunt-domain-testnet
```

Public key hasil perintah kedua dimasukkan sebagai `SIGNING_KEY` dalam `stellar.toml`.

**Jangan gunakan:**

- Secret key pengguna.
- Deployer contract.
- Issuer demo asset.
- Akun treasury.
- Akun E2E.
- Private key di environment variable `VITE_*`.

Secret key harus disimpan di secret manager dan tidak boleh masuk Git, frontend bundle, dokumentasi publik, atau chat.

## 3. Host `stellar.toml`

Untuk aplikasi Vite/Vercel, buat file:

```
web/public/.well-known/stellar.toml
```

Isi awal untuk permintaan allowlisting:

```toml
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
SIGNING_KEY = "GANTI_DENGAN_PUBLIC_KEY_TESTNET_SHUNT"

[DOCUMENTATION]
ORG_NAME = "Shunt"
ORG_URL = "https://DOMAIN_SHUNT"
ORG_DESCRIPTION = "A non-custodial Stellar application for programmable income allocation."
ORG_OFFICIAL_EMAIL = "EMAIL_BISNIS_SHUNT"
```

Setelah deploy, URL berikut harus memberikan file TOML langsung:

```
https://DOMAIN_SHUNT/.well-known/stellar.toml
```

Verifikasi bahwa:

- Response HTTP adalah `200`.
- Tidak diarahkan ke HTML aplikasi.
- Tidak membutuhkan login.
- Tidak mengandung secret key.
- Dapat dibaca oleh Stellar TOML Checker.

<aside>
⚠️

Jangan menebak atau memasukkan endpoint staging MoneyGram. Tunggu MoneyGram memberikan domain, endpoint SEP-10/SEP-24, konfigurasi client, dan test case yang resmi.

</aside>

## 4. Ajukan onboarding MoneyGram Ramps

Gunakan formulir partner resmi:

MoneyGram Ramps partner form

Dokumentasi resmi:

Integrate MoneyGram Ramps

Informasi yang perlu disiapkan:

- Product name: Shunt.
- Website dan wallet domain.
- Live demo.
- Repository.
- Target negara/corridor.
- Target persona.
- Wallet type: non-custodial Stellar application.
- URL `stellar.toml`.
- Testnet `SIGNING_KEY` public key.
- Status implementasi SEP-10 dan SEP-24.
- Permintaan staging access dan domain allowlisting.
- Requested corridors dan test locations.
- Estimasi pilot volume hanya jika ada dasar nyata.
- Status badan usaha, jika sudah tersedia.

### Contoh email

```
Subject: MoneyGram Ramps staging allowlist request — Shunt non-custodial Stellar app

Hello MoneyGram Ramps team,

I am building Shunt, a non-custodial Stellar application that helps
cross-border freelancers allocate incoming USDC into liquid spending,
emergency buffer, and contract-enforced savings.

We currently have:

- A live Stellar testnet application:
  https://shunt-app.vercel.app
- A deployed Soroban savings vault
- SEP-10 and SEP-24 client integration currently tested against the
  SDF test anchor
- Real Stellar testnet transaction and Playwright E2E coverage
- A non-custodial wallet flow where each user signs transactions using
  their own Stellar account

We would like to integrate MoneyGram Ramps in the staging environment
and request allowlisting for our wallet domain.

Wallet type:
Non-custodial Stellar wallet/application

Wallet domain:
https://DOMAIN_SHUNT

stellar.toml:
https://DOMAIN_SHUNT/.well-known/stellar.toml

Testnet signing key:
G...

Initial target corridor:
[Fill only after confirming the intended corridor]

Initial use case:
USDC cash-in and cash-out for freelancers receiving international income.

Could you please provide:

1. Staging allowlisting requirements
2. Staging SEP-10 and SEP-24 configuration
3. Required test cases and certification workbook
4. Required client-domain or home-domain parameters
5. Supported test corridors and test-location data
6. Production Preview eligibility
7. KYB and legal requirements for eventual production access

Thank you,
Irham Tri Ahmadi
Shunt
```

Jangan mengatakan bahwa:

- Shunt sudah menjadi partner MoneyGram.
- MoneyGram sudah menyetujui use case Shunt.
- Corridor tertentu pasti tersedia untuk Shunt.
- Production hanya membutuhkan penggantian environment variable.

## 5. Update SEP-10 setelah domain di-allowlist

Implementasi Shunt saat ini meminta challenge menggunakan account saja. Untuk non-custodial wallet, MoneyGram dapat memerlukan `home_domain`.

Target request:

```tsx
const challengeUrl = new URL(webAuthEndpoint);
challengeUrl.searchParams.set("account", account);
challengeUrl.searchParams.set("home_domain", SHUNT_HOME_DOMAIN);

const chRes = await fetch(challengeUrl);
```

Tambahkan konfigurasi non-secret:

```
VITE_WALLET_HOME_DOMAIN=shunt.finance
```

Lalu di `web/src/lib/anchor.ts`:

```tsx
const WALLET_HOME_DOMAIN =
  import.meta.env.VITE_WALLET_HOME_DOMAIN;
```

Ikuti konfigurasi staging resmi MoneyGram untuk parameter tambahan seperti:

- `client_domain`.
- `memo`.
- SEP-9 fields.
- Language.
- Callback URL.

**Jangan menebak parameter yang belum diberikan.**

## 6. Gunakan endpoint staging resmi

Setelah MoneyGram memberikan staging configuration:

```
VITE_ANCHOR_HOME_DOMAIN=DOMAIN_STAGING_RESMI_DARI_MONEYGRAM
VITE_WALLET_HOME_DOMAIN=DOMAIN_SHUNT
```

Jangan langsung menggunakan domain mainnet untuk mengklaim integration selesai. Public MoneyGram TOML dapat dipakai untuk discovery verification, tetapi staging flow tetap memerlukan allowlisting dan konfigurasi resmi.

# Lifecycle yang wajib dibuktikan

## Deposit / cash-in

```
1. User menghubungkan Stellar wallet
2. Shunt meminta SEP-10 challenge
3. User menandatangani challenge
4. Shunt memperoleh JWT
5. Shunt memulai SEP-24 interactive deposit
6. MoneyGram hosted UI dibuka
7. User menyelesaikan test identity dan location flow
8. Shunt memantau transaction status
9. Test USDC diterima wallet pengguna
10. Shunt mendeteksi incoming USDC
11. User menyetujui split
12. Savings masuk ke ShuntVault
```

## Withdrawal / cash-out

```
1. User memilih cash out
2. Shunt menjalankan SEP-10
3. User menandatangani challenge
4. Shunt memulai SEP-24 interactive withdrawal
5. MoneyGram hosted UI mengumpulkan detail transaksi
6. Shunt menerima anchor account dan memo
7. User mengirim USDC ke account dan memo yang tepat
8. Shunt memantau transaction status
9. MoneyGram memberikan reference number
10. Shunt menampilkan pickup instructions/reference
11. Transaction mencapai terminal status
```

# Kekurangan implementasi Shunt yang perlu dilengkapi

`web/src/lib/anchor.ts` sudah memiliki:

- SEP-1/TOML discovery.
- SEP-10 challenge.
- Token exchange.
- SEP-24 deposit.
- SEP-24 withdrawal.
- Transaction status polling.

Untuk integrasi MoneyGram staging, tambahkan atau verifikasi:

## Wajib

- `home_domain` pada SEP-10.
- Environment-specific anchor configuration.
- Dynamic amount limits dari anchor `/info`.
- Complete transaction-status state machine.
- Hosted UI close notification.
- Exact memo handling.
- Reference number retrieval.
- Retry/backoff.
- Expired, refunded, dan error states.
- Asset/network validation.
- Staging-vs-production disclosure.

## Disarankan

- `client_domain` jika diminta MoneyGram.
- SEP-9 customer fields.
- Test-location data.
- Transaction detail persistence.
- Reconciliation setelah refresh.
- Popup/postMessage origin validation.
- Audit log tanpa menyimpan PII sensitif.

# Certification, KYB, dan production

## Staging

Umumnya memerlukan:

- Domain allowlisting.
- Testnet signing public key.
- Test accounts jika diminta.
- SEP-10/SEP-24 integration.
- Penyelesaian staging test cases.

MoneyGram menentukan requirement final.

## Production

Production membutuhkan:

- Certification.
- Submission hasil test cases.
- KYB onboarding.
- Legal agreement.
- Production approval.
- Kemungkinan Production Preview sebelum full production.

# Klaim produk yang aman

## Sebelum MoneyGram staging

Gunakan:

> Shunt has implemented a generic SEP-1/10/24 client and currently validates it against the SDF test anchor.
> 

## Setelah staging berhasil

Gunakan:

> Shunt is integrated with the MoneyGram Ramps staging environment and has completed the documented test lifecycle.
> 

## Setelah certification dan production approval

Baru gunakan:

> Shunt integrates MoneyGram Ramps for supported production corridors.
> 

Jangan menggunakan klaim “one config value away”. Gunakan:

> The anchor client is reusable across compliant operators, while production activation still requires onboarding, allowlisting, corridor validation, certification, KYB, and legal approval.
> 

# Checklist eksekusi

- [ ]  Tentukan domain resmi Shunt.
- [ ]  Buat Stellar testnet signing key khusus domain.
- [ ]  Host `/.well-known/stellar.toml`.
- [ ]  Validasi menggunakan Stellar TOML Checker.
- [ ]  Buka formulir MoneyGram Ramps partner.
- [ ]  Kirim staging allowlist request.
- [ ]  Nyatakan Shunt sebagai non-custodial Stellar application.
- [ ]  Sertakan domain, TOML URL, dan testnet signing public key.
- [ ]  Minta staging SEP-10/SEP-24 configuration.
- [ ]  Minta certification test workbook.
- [ ]  Minta daftar corridor dan test locations yang benar-benar tersedia.
- [ ]  Jangan mengubah GTM menjadi Philippines-first sebelum validasi pengguna dan corridor.
- [ ]  Setelah mendapat staging config, tambahkan `home_domain`.
- [ ]  Jalankan deposit dan withdrawal lifecycle penuh.
- [ ]  Simpan transaction ID, status history, screenshot, dan explorer proof.
- [ ]  Update README menjadi “MoneyGram staging integration” hanya setelah berhasil.
- [ ]  Jangan menyebut production sebelum certification, KYB, dan legal selesai.

# Panduan operasional setup MoneyGram Ramps

<aside>
🧩

Bagian ini membedakan pekerjaan yang dapat dilakukan sekarang dari pekerjaan yang harus menunggu domain Shunt di-allowlist. Jangan mengarang endpoint staging, credential, partner ID, atau status partnership.

</aside>

## Fase 0 — Siapkan identitas integrator

### A. Gunakan email bisnis

Siapkan email yang dapat digunakan untuk komunikasi partner, certification, dan KYB, idealnya pada domain Shunt:

```
partnerships@DOMAIN_SHUNT
engineering@DOMAIN_SHUNT
compliance@DOMAIN_SHUNT
```

Jika domain sendiri belum tersedia, email pribadi dapat digunakan untuk percakapan awal, tetapi domain bisnis akan lebih baik untuk certification dan KYB.

### B. Siapkan satu lembar profil integrasi

Sebelum mengisi formulir, siapkan jawaban berikut:

| Field | Jawaban Shunt |
| --- | --- |
| Product | Shunt |
| Integration type | Non-custodial Stellar wallet/application |
| Network awal | Stellar Testnet |
| Asset | USDC on Stellar |
| Custody | Users sign with their own wallet; Shunt does not hold user keys |
| Use case | Cash-in/cash-out plus programmable allocation for cross-border freelancer income |
| Current status | SEP-10/SEP-24 client tested against SDF test anchor; MoneyGram staging not yet connected |
| Requested access | Non-custodial wallet staging allowlist and certification test materials |
| Target corridor | State only the corridor MoneyGram confirms; do not assume Indonesia or Philippines |

## Fase 1 — Domain, key, dan TOML

### 1. Pilih satu home domain

Gunakan hostname tanpa protocol sebagai nilai SEP-10:

```
shunt.finance
```

Jika sementara memakai Vercel:

```
shunt-app.vercel.app
```

Jangan mencampur beberapa home domain pada staging. Domain yang dikirim ke MoneyGram, domain yang memiliki TOML, dan parameter `home_domain` harus konsisten.

### 2. Buat key testnet khusus domain

```bash
stellar keys generate shunt-domain-testnet --network testnet
stellar keys address shunt-domain-testnet
```

Catat hanya public key yang diawali `G`. Jangan menyalin secret key yang diawali `S` ke repository atau formulir publik.

### 3. Buat TOML

File repository:

```
web/public/.well-known/stellar.toml
```

Template staging minimum:

```toml
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
SIGNING_KEY = "G_REPLACE_WITH_SHUNT_TESTNET_DOMAIN_PUBLIC_KEY"

[DOCUMENTATION]
ORG_NAME = "Shunt"
ORG_URL = "https://DOMAIN_SHUNT"
ORG_DESCRIPTION = "Non-custodial programmable income allocation for cross-border freelancers."
ORG_OFFICIAL_EMAIL = "partnerships@DOMAIN_SHUNT"
```

### 4. Deploy dan validasi

```bash
curl -i https://DOMAIN_SHUNT/.well-known/stellar.toml
curl -s https://DOMAIN_SHUNT/.well-known/stellar.toml
```

Expected:

- Status `200`.
- Body adalah TOML, bukan `index.html`.
- `SIGNING_KEY` sama dengan public key yang didaftarkan.
- Tidak ada secret.
- Tidak ada redirect antar-domain yang tidak perlu.

Gunakan Stellar TOML Checker sebelum mengirim formulir MoneyGram.

## Fase 2 — Mengajukan staging access

### 1. Buka halaman resmi

- MoneyGram Ramps integration guide
- MoneyGram Ramps partner form

Dokumentasi MoneyGram menyatakan bahwa wallet domain harus di-allowlist. Untuk non-custodial wallet, materi utama yang diminta adalah domain tempat `stellar.toml` di-host dan testnet `SIGNING_KEY` di dalam TOML tersebut.

### 2. Isi partner form

Gunakan informasi berikut sebagai panduan, disesuaikan dengan field aktual:

```
Company/product: Shunt
Website: https://DOMAIN_SHUNT
Product type: Non-custodial Stellar wallet / fintech application
Integration requested: MoneyGram Ramps staging
Blockchain: Stellar
Asset: USDC
Wallet domain: DOMAIN_SHUNT
stellar.toml: https://DOMAIN_SHUNT/.well-known/stellar.toml
Target user: Cross-border freelancers with irregular income
Current environment: Stellar Testnet
Current integration: SEP-10 and SEP-24 client against SDF test anchor
Requested support: Domain allowlisting, staging endpoints, test data, and certification workbook
```

Jika form meminta company registration dan Shunt belum memiliki badan usaha, jawab secara jujur sebagai early-stage project. Jangan memasukkan data perusahaan fiktif.

### 3. Kirim follow-up email

Gunakan contoh email sebelumnya, tetapi lampirkan juga:

- URL live app.
- URL repository.
- URL TOML.
- Testnet domain signing public key.
- Screenshot SEP-24 SDF test-anchor flow.
- Daftar transaksi testnet Shunt yang relevan.
- Ringkasan bahwa Shunt tidak menyimpan user keys.

### 4. Minta jawaban eksplisit

Minta MoneyGram mengonfirmasi:

- Domain sudah di-allowlist atau belum.
- Staging home domain.
- SEP-10 endpoint.
- SEP-24 endpoint.
- Apakah `home_domain` atau `client_domain` diperlukan.
- Testnet asset dan issuer yang harus digunakan.
- Test locations dan test identity data.
- Supported corridors untuk staging dan Production Preview.
- Required test cases.
- Certification submission method.
- Production KYB dan legal prerequisites.

<aside>
⏸️

Jangan melanjutkan ke konfigurasi MoneyGram staging sampai allowlisting dan endpoint resmi diterima. Public mainnet TOML MoneyGram bukan pengganti staging approval.

</aside>

## Fase 3 — Siapkan akun Stellar staging

Dokumentasi MoneyGram memperbolehkan setup testnet dengan akun authentication/funds jika diperlukan. Untuk Shunt non-custodial, user account tetap menjadi akun utama, tetapi siapkan akun integration test terpisah.

### 1. Generate akun testnet

```bash
stellar keys generate shunt-moneygram-test --network testnet
stellar keys address shunt-moneygram-test
```

Jangan gunakan key domain untuk memegang dana pengguna.

### 2. Fund XLM

Gunakan Friendbot atau Stellar Lab untuk mendanai account testnet. XLM dibutuhkan untuk account reserve, trustline, dan transaction fees.

### 3. Tambahkan trustline USDC testnet

MoneyGram mendokumentasikan USDC testnet berikut:

```
Asset code: USDC
Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

Pastikan nilai tersebut tetap dikonfirmasi dari dokumentasi atau staging response terbaru sebelum digunakan.

### 4. Dapatkan test USDC

Gunakan metode yang disetujui MoneyGram/Circle untuk staging. Jangan mencampur demo USDC issuer dengan issuer yang ditentukan MoneyGram.

### 5. Jika MoneyGram meminta test public keys

Kirim hanya public key akun testnet yang diminta. Jangan kirim secret key.

## Fase 4 — Konfigurasi environment Shunt

Setelah MoneyGram memberikan domain staging resmi, isi environment berikut:

```
VITE_ANCHOR_HOME_DOMAIN=STAGING_DOMAIN_FROM_MONEYGRAM
VITE_WALLET_HOME_DOMAIN=DOMAIN_SHUNT
VITE_STELLAR_NETWORK=testnet
```

Aturan:

- Jangan commit `.env` yang berisi credential.
- Nilai `VITE_*` masuk ke frontend bundle; hanya simpan konfigurasi publik di sana.
- JWT SEP-10 adalah session credential dan jangan disimpan permanen di local storage.
- Secret key domain atau wallet tidak boleh menjadi `VITE_*`.
- Jangan hardcode endpoint jika TOML discovery dapat digunakan.

## Fase 5 — Implementasi SEP-1 discovery

Pada startup flow:

```
GET https://STAGING_DOMAIN_FROM_MONEYGRAM/.well-known/stellar.toml
```

Baca sekurangnya:

```
WEB_AUTH_ENDPOINT
TRANSFER_SERVER_SEP0024
SIGNING_KEY
NETWORK_PASSPHRASE
```

Validasi:

- HTTPS.
- Network adalah testnet untuk staging.
- Endpoint berasal dari TOML, bukan input pengguna.
- Field wajib tersedia.
- Error discovery menghasilkan pesan eksplisit, bukan fallback diam-diam ke SDF test anchor.

## Fase 6 — Implementasi SEP-10 untuk non-custodial wallet

Request challenge harus menyertakan user public key dan Shunt home domain:

```tsx
const challengeUrl = new URL(webAuthEndpoint);
challengeUrl.searchParams.set("account", userPublicKey);
challengeUrl.searchParams.set("home_domain", SHUNT_HOME_DOMAIN);

const challengeResponse = await fetch(challengeUrl);
```

Kemudian:

```
1. Parse challenge transaction XDR.
2. Validate network passphrase.
3. Validate challenge belum expired.
4. Validasi server signature menggunakan MoneyGram SIGNING_KEY dari TOML.
5. Minta user menandatangani challenge melalui wallet.
6. POST signed challenge ke WEB_AUTH_ENDPOINT.
7. Terima SEP-10 JWT.
8. Simpan JWT hanya selama flow aktif.
```

Untuk non-custodial integration:

- Gunakan public key masing-masing user.
- `home_domain` wajib konsisten dengan domain yang di-allowlist.
- Jangan menggunakan satu shared custodial wallet.
- Jangan meminta seed phrase atau secret key pengguna.

## Fase 7 — Baca kemampuan dan limits SEP-24

Sebelum menampilkan form deposit/withdrawal, panggil:

```
GET {TRANSFER_SERVER_SEP0024}/info
```

Jangan lagi memakai limit SDF test anchor `1–10` sebagai constant global production.

Dari response `/info`, baca:

- Asset yang didukung.
- Deposit enabled/disabled.
- Withdrawal enabled/disabled.
- Min/max amount.
- Fee behavior.
- Field tambahan yang diperlukan.

Jika MoneyGram hanya mendukung USDC, blok asset lain sebelum membuka hosted flow.

## Fase 8 — Memulai cash-in / deposit

Request target:

```
POST {TRANSFER_SERVER_SEP0024}/transactions/deposit/interactive
Authorization: Bearer {SEP10_JWT}
Content-Type: application/json
```

Payload dasar:

```json
{
  "asset_code": "USDC",
  "account": "G_USER_PUBLIC_KEY",
  "amount": "10"
}
```

Tambahkan `lang`, SEP-9 fields, `home_domain`, atau parameter lain hanya jika diminta konfigurasi MoneyGram.

Expected response:

```json
{
  "type": "interactive_customer_info_needed",
  "url": "https://...",
  "id": "anchor-transaction-id"
}
```

Simpan:

- Anchor transaction ID.
- Flow type: deposit.
- User account.
- Requested amount.
- Creation time.
- Hosted URL origin.
- Current status.

Jangan simpan KYC detail mentah kecuali benar-benar diperlukan dan diizinkan.

## Fase 9 — Memulai cash-out / withdrawal

Request target:

```
POST {TRANSFER_SERVER_SEP0024}/transactions/withdraw/interactive
Authorization: Bearer {SEP10_JWT}
Content-Type: application/json
```

Payload dasar:

```json
{
  "asset_code": "USDC",
  "account": "G_USER_PUBLIC_KEY",
  "amount": "10"
}
```

Expected response juga berisi hosted URL dan transaction ID.

Setelah hosted flow selesai, MoneyGram dapat memberikan:

- `withdraw_anchor_account`.
- `withdraw_memo`.
- `withdraw_memo_type`.
- Expected amount.
- Fee/amount-out information.

Shunt harus membangun transaksi dari nilai yang diberikan anchor. Jangan menggunakan hardcoded anchor account atau memo.

## Fase 10 — Buka hosted UI dengan aman

Buka URL hanya jika:

- URL menggunakan HTTPS.
- Origin sesuai endpoint/domain MoneyGram yang ditemukan.
- URL berasal langsung dari authenticated SEP-24 response.

Jika memakai popup atau webview:

- Simpan reference ke window yang dibuka.
- Jangan memasukkan JWT ke query string sendiri.
- Validasi `postMessage` origin.
- Jangan percaya payload dari origin lain.
- Setelah popup ditutup, lanjutkan polling berdasarkan transaction ID.

MoneyGram menyediakan close notification melalui `postMessage`, tetapi polling tetap diperlukan untuk authoritative status.

## Fase 11 — Poll transaction status

Request:

```
GET {TRANSFER_SERVER_SEP0024}/transaction?id={TRANSACTION_ID}
Authorization: Bearer {SEP10_JWT}
```

Poll dengan interval wajar, misalnya:

```
0 detik
2 detik
5 detik
10 detik
15 detik
30 detik
```

Setelah itu lanjutkan maksimal setiap 30 detik selama flow aktif. Hentikan polling pada terminal state atau ketika user meninggalkan flow.

Status penting yang harus ditangani meliputi:

```
incomplete
pending_user_transfer_start
pending_user_transfer_complete
pending_anchor
pending_stellar
pending_external
completed
refunded
expired
error
```

Jangan menganggap popup ditutup berarti transaksi selesai.

### UI mapping minimum

| Status | Pesan UI |
| --- | --- |
| incomplete | Complete the MoneyGram verification flow. |
| pending_user_transfer_start | Action required: send USDC using the exact account and memo shown. |
| pending_user_transfer_complete | MoneyGram is waiting for the user-side transfer to settle. |
| pending_anchor / pending_stellar / pending_external | Processing; no duplicate payment is required. |
| completed | Transaction completed. |
| refunded | Transaction was refunded; show the returned amount and next action. |
| expired | Transaction expired; start a new quote/flow. |
| error | Display the anchor-provided message without exposing internal tokens. |

## Fase 12 — Kirim USDC untuk withdrawal

Hanya kirim setelah status dan transaction response meminta user transfer.

Transaksi harus menggunakan:

```
Destination = withdraw_anchor_account dari response
Amount = amount yang diminta flow
Memo type = withdraw_memo_type dari response
Memo value = withdraw_memo dari response
Asset = USDC issuer yang sesuai dengan network
```

Sebelum user sign, tampilkan confirmation screen:

- Amount USDC.
- Destination anchor.
- Memo dan memo type.
- Fee.
- Expected payout.
- Corridor/location.
- Expiration.
- Network: Testnet atau Mainnet.

Setelah submit:

- Simpan Stellar transaction hash.
- Jangan mengirim ulang otomatis.
- Poll anchor status.
- Jika submit timeout, cek Horizon sebelum retry.

## Fase 13 — Cash-in completion

Untuk deposit/cash-in:

```
1. User menyelesaikan hosted KYC dan memilih lokasi.
2. User membawa cash ke lokasi test/preview yang ditentukan.
3. MoneyGram memproses cash-in.
4. Test/mainnet USDC dikirim ke user Stellar account.
5. Shunt memonitor wallet dan anchor transaction.
6. Setelah USDC masuk, Shunt memperlakukannya sebagai income baru.
7. User tetap menandatangani distribute transaction; jangan auto-sign.
```

Untuk sandbox, gunakan hanya location test data resmi MoneyGram. Jangan mendatangi lokasi production dengan test transaction.

## Fase 14 — Reference number dan receipt

Untuk withdrawal yang berhasil, tampilkan reference number yang diperoleh dari transaction status/response MoneyGram.

Receipt minimum:

- MoneyGram reference number.
- Anchor transaction ID.
- Stellar transaction hash.
- Amount in.
- Fee.
- Expected amount out.
- Payout currency.
- Pickup location jika tersedia.
- Status dan timestamp.
- Instruksi identitas yang dibutuhkan, jika diberikan MoneyGram.

Jangan log reference number bersama PII sensitif di analytics publik.

## Fase 15 — Test matrix staging

Jalankan dan dokumentasikan sekurangnya:

### Authentication

- [ ]  Valid wallet + allowlisted home domain berhasil.
- [ ]  Unlisted home domain ditolak.
- [ ]  Expired challenge ditolak.
- [ ]  Wrong network ditolak.
- [ ]  User menolak signature ditangani.

### Deposit

- [ ]  Deposit interactive URL berhasil dibuat.
- [ ]  Popup close tanpa completion ditangani.
- [ ]  KYC incomplete ditampilkan.
- [ ]  Cash-in test berhasil sampai USDC diterima.
- [ ]  USDC yang diterima terdeteksi Shunt.
- [ ]  Duplicate income tidak diproses dua kali.

### Withdrawal

- [ ]  Withdrawal interactive URL berhasil dibuat.
- [ ]  Anchor account dan memo dibaca dari response.
- [ ]  User cancellation tidak mengirim dana.
- [ ]  Wrong memo test ditangani sesuai sandbox case.
- [ ]  Successful withdrawal menghasilkan reference number.
- [ ]  Duplicate submit dicegah.

### Status and recovery

- [ ]  Refresh browser dapat memulihkan transaction ID dan status.
- [ ]  JWT expiration meminta re-authentication.
- [ ]  `expired`, `refunded`, dan `error` ditampilkan benar.
- [ ]  Timeout tidak dianggap completed.
- [ ]  Retry tidak membuat transaksi baru tanpa persetujuan user.

### Security

- [ ]  Popup `postMessage` origin divalidasi.
- [ ]  JWT tidak masuk log.
- [ ]  Secret key tidak masuk frontend bundle.
- [ ]  KYC data tidak disalin ke Shunt tanpa kebutuhan.
- [ ]  Mainnet dan testnet asset issuer tidak dapat tertukar.

## Fase 16 — Production Preview

MoneyGram mendokumentasikan Production Preview sebagai mainnet testing dengan real funds dan limit terbatas. Nilai yang tercantum saat panduan ini ditulis:

```
Minimum per transaction: 10 USDC
Maximum per transaction: 20 USDC
Aggregate preview limit: 100 USDC
```

USDC mainnet yang tercantum:

```
Asset code: USDC
Issuer: GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
```

Konfirmasi kembali limit dan issuer dari MoneyGram sebelum transaksi. Production Preview memakai dana nyata; gunakan nominal minimum dan akun khusus.

## Fase 17 — Certification, KYB, dan legal

Untuk full production:

### Certification

- Minta workbook/test cases resmi.
- Jalankan semua case pada staging/preview yang ditentukan.
- Isi expected result, actual result, screenshot, transaction ID, dan Stellar hash.
- Submit melalui channel certification yang diberikan MoneyGram.
- Jangan mengedit hasil untuk menyembunyikan kegagalan.

### KYB

Siapkan sesuai badan usaha dan permintaan aktual:

- Registration/incorporation documents.
- Beneficial owner information.
- Director/founder identification.
- Business address.
- Product description.
- Compliance contact.
- Expected volumes dan corridors dengan asumsi yang dapat dijelaskan.
- Data handling dan privacy policy.
- AML/sanctions responsibility matrix.

### Legal

- Review MoneyGram agreement.
- Pastikan pembagian tanggung jawab KYC, customer support, refunds, dan disputes jelas.
- Jangan go live sebelum production approval tertulis.

MoneyGram menyarankan certification, KYB, dan legal berjalan paralel.

## Fase 18 — Production go-live checklist

- [ ]  Production domain di-allowlist.
- [ ]  Production TOML valid.
- [ ]  Mainnet network passphrase digunakan.
- [ ]  Mainnet USDC issuer diverifikasi.
- [ ]  Production limits berasal dari anchor response/config terbaru.
- [ ]  Mainnet banner tidak lagi menyebut test funds.
- [ ]  Error monitoring aktif.
- [ ]  Anchor transaction reconciliation aktif.
- [ ]  Customer-support escalation tersedia.
- [ ]  Refund dan failed-payout runbook tersedia.
- [ ]  Privacy policy dan terms tersedia.
- [ ]  KYB, legal, dan certification selesai.
- [ ]  Small-value smoke test selesai.
- [ ]  README membedakan sandbox, Production Preview, dan production.

## Bukti yang perlu disimpan

Buat folder submission/internal evidence dengan struktur:

```
docs/moneygram/
  onboarding-request.md
  staging-config.redacted.md
  test-matrix.md
  certification-results.redacted.md
  deposit-lifecycle.md
  withdrawal-lifecycle.md
  screenshots/
  transaction-proofs.md
```

Jangan commit credential, JWT, secret key, personal KYC data, atau unredacted legal documents.

## Definisi selesai per tahap

| Tahap | Boleh diklaim ketika |
| --- | --- |
| Protocol client | SEP-10/SEP-24 berjalan terhadap SDF test anchor. |
| Onboarding requested | Partner form/email sudah dikirim, tetapi belum ada approval. |
| Staging allowlisted | MoneyGram mengonfirmasi domain dan memberi staging configuration. |
| Staging integrated | Deposit dan withdrawal test lifecycle berhasil dengan MoneyGram staging. |
| Production Preview tested | Real-fund preview selesai sesuai limit dan approval. |
| Production integrated | Certification, KYB, legal, dan production approval selesai. |

<aside>
✅

**Tindakan berikutnya:** pilih satu domain, deploy `stellar.toml`, validasi TOML, lalu kirim partner-form request untuk MoneyGram Ramps staging allowlist. Jangan menunggu perubahan kode besar sebelum memulai onboarding.

</aside>
> Current status, July 29, 2026: Shunt treats the SDF test anchor as a Stellar testnet simulation. Provider sandbox, Production Preview, and live routes are separate environments. A route becomes "live" only after provider capability, order completion, and matching Stellar mainnet settlement evidence.

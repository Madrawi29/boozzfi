# Tutorial Deploy BOOZZ dan Add LP

Panduan ini untuk Arc Testnet di BoozzFi. Jangan pernah memakai private key atau dana mainnet untuk alur ini.

## Pair yang Didukung

- USDC / EURC
- USDC / cirBTC
- EURC / cirBTC
- USDC / BOOZZ
- EURC / BOOZZ

## 1. Siapkan Environment

Isi `.env.local` minimal seperti ini:

```text
NEXT_PUBLIC_PRIVY_APP_ID=isi_dari_privy
NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_TESTNET_EXPLORER_URL=https://testnet.arcscan.app
NEXT_PUBLIC_ARC_TESTNET_FAUCET_URL=https://faucet.circle.com
NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS=
NEXT_PUBLIC_BOOZZ_LIQUIDITY_VAULT_ADDRESS=
```

Jalankan:

```powershell
npm install
npm run compile
npm run check
npm run dev
```

## 2. Deploy Token BOOZZ

### Opsi Terminal

Isi private key testnet deployer di `.env.local` atau terminal:

```text
DEPLOYER_PRIVATE_KEY=0xprivate_key_testnet_kamu
BOOZZ_TOKEN_NAME=BOOZZ Token
BOOZZ_TOKEN_SYMBOL=BOOZZ
BOOZZ_TOKEN_SUPPLY=1000000000
```

Pastikan wallet deployer punya gas/testnet USDC Arc, lalu jalankan:

```powershell
npm run compile
npm run deploy:boozz
```

Output command akan mencetak:

```text
NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_BOOZZ_LIQUIDITY_VAULT_ADDRESS=0x...
```

Salin dua baris itu ke `.env.local`, lalu restart dev server.

### Opsi UI

1. Buka `http://127.0.0.1:3000/create`.
2. Connect wallet Privy dan pastikan wallet pindah ke Arc Testnet.
3. Isi:
   - Token Name: `BOOZZ Token`
   - Symbol: `BOOZZ`
   - Supply: contoh `1000000000`
4. Klik `Deploy Token`.
5. Setelah transaksi sukses, klik `Verify Name, Symbol, and Supply`.
6. Klik `Add Asset to Owner Wallet`.
7. Salin contract address BOOZZ dari halaman atau explorer.
8. Masukkan address itu ke `.env.local`:

```text
NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS=0xAlamatTokenBOOZZ
```

Restart dev server setelah mengubah `.env.local`.

## 3. Deploy Vault LP

1. Buka `http://127.0.0.1:3000/liquidity`.
2. Klik `Deploy Vault Contract`.
3. Salin address `BoozzLiquidityVault` yang muncul.
4. Masukkan address itu ke `.env.local`:

```text
NEXT_PUBLIC_BOOZZ_LIQUIDITY_VAULT_ADDRESS=0xAlamatVault
```

Restart dev server supaya address otomatis terisi di halaman LP.

## 4. Add LP

1. Buka `/liquidity`.
2. Pilih pair, misalnya `USDC / BOOZZ`.
3. Pastikan `BoozzLiquidityVault address` dan `BOOZZ token address` sudah benar.
4. Isi amount untuk dua token di pair.
5. Klik `Add LP`.
6. Wallet akan meminta approval untuk token A dan token B, lalu transaksi add liquidity.
7. Setelah confirmed, klik `Refresh Position` untuk melihat `Wallet LP Shares`.

Catatan: untuk pair tanpa BOOZZ, address BOOZZ tidak diperlukan. Untuk pair BOOZZ, token BOOZZ harus berasal dari kontrak hasil deploy di langkah 2.

## 5. Deposit LP ke Vault

1. Di halaman `/liquidity`, pilih pair yang sama.
2. Lihat `Wallet LP Shares`.
3. Masukkan jumlah LP shares ke field `LP shares to deposit`.
4. Klik `Deposit LP to Vault`.
5. Setelah confirmed, `Vault Shares` akan bertambah.

## 6. Earn USDC dari LP yang Ditahan

Halaman `/liquidity` sekarang menampilkan estimasi earn dalam USDC untuk LP shares yang sudah masuk vault.

Model pembagian earn MVP:

- USDC / EURC: APR 8.4%, 82% untuk LP provider, 10% protocol, 8% reserve.
- USDC / cirBTC: APR 18.2%, 76% untuk LP provider, 14% protocol, 10% reserve.
- EURC / cirBTC: APR 19.6%, 75% untuk LP provider, 15% protocol, 10% reserve.
- USDC / BOOZZ: APR 31.5%, 72% untuk LP provider, 18% protocol, 10% reserve.
- EURC / BOOZZ: APR 34.8%, 70% untuk LP provider, 20% protocol, 10% reserve.

Semakin tinggi risiko pair, APR dibuat lebih tinggi dan porsi protocol sedikit lebih besar. Tombol `Claim Estimated USDC Earn` mencatat estimasi reward ke activity sebagai MVP. Untuk payout USDC sungguhan on-chain, vault perlu versi reward-funded yang menerima deposit USDC reward treasury lalu mengirim USDC saat claim.

## 7. Produksi

Kontrak `BoozzLiquidityVault` di repo ini adalah vault testnet sederhana untuk MVP. Sebelum mainnet, tambahkan audit, fee model, slippage/min-share guard, withdraw liquidity, reward accounting, pause control, dan ownership/admin policy.

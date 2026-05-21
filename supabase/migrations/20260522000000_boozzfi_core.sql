create table if not exists public.activities (
  id text primary key,
  "walletAddress" text not null,
  type text not null,
  asset text not null,
  amount double precision not null,
  status text not null,
  "feeUsd" double precision not null default 0,
  "txHash" text not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists activities_wallet_created_idx
  on public.activities ("walletAddress", "createdAt" desc);

create index if not exists activities_tx_hash_idx
  on public.activities ("txHash");

create table if not exists public.payment_records (
  "referenceId" text primary key,
  "invoiceId" text,
  "invoiceUrl" text,
  "userWallet" text not null,
  "idrAmount" double precision not null,
  "usdcAmount" text not null,
  status text not null,
  "xenditStatus" text,
  "circleTransactionId" text,
  "txHash" text,
  "errorMessage" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists payment_records_invoice_id_idx
  on public.payment_records ("invoiceId");

create table if not exists public.portfolio_snapshots (
  id text primary key,
  "walletAddress" text not null,
  "totalValueUsd" double precision not null default 0,
  "simulatedYieldPercent" double precision not null default 0,
  "trackedChains" integer not null default 1,
  "availableLiquidityUsd" double precision not null default 0,
  "liquidityDepthPercent" integer not null default 0,
  "pendingTransactions" integer not null default 0,
  "pendingStatus" text not null default 'Ready',
  "statusPollSeconds" integer not null default 8,
  "gasFeeUsd" double precision not null default 0,
  "finalitySeconds" double precision not null default 0,
  "gasTrend" text not null default 'Stable',
  "updatedAt" timestamptz not null default now()
);

insert into public.portfolio_snapshots (
  id,
  "walletAddress",
  "totalValueUsd",
  "simulatedYieldPercent",
  "trackedChains",
  "availableLiquidityUsd",
  "liquidityDepthPercent",
  "pendingTransactions",
  "pendingStatus",
  "statusPollSeconds",
  "gasFeeUsd",
  "finalitySeconds",
  "gasTrend",
  "updatedAt"
) values (
  'portfolio_demo_001',
  '0x71C4B7D84EfB9D8E79E5832D1Cd7b7A42C9F02',
  0,
  0,
  1,
  0,
  0,
  0,
  'Ready',
  8,
  0,
  0,
  'Stable',
  now()
) on conflict (id) do nothing;

alter table public.activities enable row level security;
alter table public.payment_records enable row level security;
alter table public.portfolio_snapshots enable row level security;

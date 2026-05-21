# BOOZZFI Supabase Integration

BOOZZFI can store transaction activity and Xendit/Circle payment records in Supabase.
The integration is server-side only. Do not expose the secret key through `NEXT_PUBLIC_`
variables.

## Environment Variables

Add these variables locally and in Vercel:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
```

Legacy service role keys also work:

```text
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SECRET_KEY` is preferred when available.

## Database Setup

Run this SQL in Supabase SQL Editor, or apply it with the Supabase CLI:

```text
supabase/migrations/20260522000000_boozzfi_core.sql
```

The migration creates:

- `activities`
- `payment_records`
- `portfolio_snapshots`

Row Level Security is enabled. BOOZZFI writes through a server-side secret key, so
public browser access is not required.

## Fallback Behavior

If Supabase env variables are missing or Supabase is temporarily unavailable,
BOOZZFI falls back to the existing local SQLite/libSQL storage. This keeps local
development and current working flows alive while Supabase is being configured.

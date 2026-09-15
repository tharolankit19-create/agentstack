# KryxAI production Supabase finish

Project ref: `fdkxvalsyyyxzjgpxunu`

This directory contains the two things production still needs outside Vercel:

1. Run `migrations/0027_kryx_production_repair.sql` once in the Supabase SQL Editor.
2. Apply the Auth patch in `auth-config.production.json` through the Supabase Management API or Dashboard, then paste the HTML templates from `email-templates/`.

The SQL migration is intentionally scoped to the `agentstack` schema and the Kryx trigger on `auth.users`. It does not modify Meamus/public application tables.

The Auth patch keeps email confirmation on, disables anonymous sign-ins and unverified email sign-in, enables secure email change + password-change reauthentication, rotates refresh tokens, raises password strength, and limits session lifetime.

Do not commit or paste a Supabase personal access token into this repository. Use it only as a secret when applying the Management API patch.

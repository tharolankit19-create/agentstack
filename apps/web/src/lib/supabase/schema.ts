/**
 * Which Postgres schema AgentStack's tables live in.
 *
 * Not `public`. `public` is a shared room — extensions land there, other tools
 * create things there, and `subscriptions` is a table name that three
 * different products will each want. Owning a named schema means this can be
 * installed into a Supabase project that is already doing something else
 * without dropping a single thing that was there first.
 *
 * Overridable, because someone installing into an empty project may
 * reasonably prefer `public`, and that should be an environment variable
 * rather than a fork. It has to be `NEXT_PUBLIC_` since the browser client
 * reads it too.
 *
 * Whatever this is set to must match the schema the migrations created **and**
 * be listed in the project's exposed schemas (Supabase → Settings → API →
 * Exposed schemas), or PostgREST returns PGRST106 and every query fails.
 */
export const DB_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? "agentstack";

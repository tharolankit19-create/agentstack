# tests

Two standalone checks over the model-provider chain. No framework: they compile
with `tsc` and run on node, which is the whole dependency list.

```bash
npm test --workspace apps/web
```

They cover the part of the routing that has no other way of being verified —
the *order* attempts are made in, and what each provider HTTP status does to the
rest of the request. Both are pure functions in `src/lib/providers.ts`
(`attemptOrder`, `classify`) precisely so they can be tested without a network,
a database or a Next runtime. A failover policy that can only be checked by
watching production is not checked.

`server-only` is stripped during compilation because it exists to fail outside
a request; these run outside one on purpose.

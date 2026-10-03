import { adapterManifest } from "../../apps/web/src/lib/operator/adapters.ts";
// An explicitly labelled QA response, using a public literal address to avoid DNS dependencies.
export const readManifest = adapterManifest.parse({
  name: "QA repository API",
  description: "Read repository details from the QA provider",
  documentation_url: "https://8.8.8.8/docs",
  version: 1,
  state: "DRAFT",
  allowed_domains: ["8.8.8.8"],
  authentication: { type: "none" },
  actions: [
    {
      name: "repository.read",
      method: "GET",
      url: "https://8.8.8.8/repository",
      risk: "READ",
      inputs_schema: {
        type: "object",
        properties: { page: { type: "integer" } },
        required: [],
        additionalProperties: false,
      },
    },
  ],
});

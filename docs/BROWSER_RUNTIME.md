# Browser runtime status

There is no V2 persistent cloud Chromium executor or Watch stream implemented in this slice. `KRYX_BROWSER_WATCH` remains false. The Job API returns no browser attachment, so Watch is not rendered. No screenshot or fake live viewport is supplied.

Existing desktop browser-extension/accessibility and Android device foundations are preserved. Existing signed device tasks and approvals remain readable. They are not wired into the new verified Lead List procedure yet.

Current Lead List execution uses official search API calls and public HTTPS page reads. HTTPS source access validates all DNS answers, rejects private/reserved networks and credential-bearing URLs, pins the connection to a checked address, validates HTTPS redirects individually, and bounds response size/time. This is a public source reader, not a browser.

The next browser phase must deploy an isolated persistent browser service, attach real sessions/tabs to Jobs, fence browser actions, persist profiles safely, provide actual viewport events, and test restart/Watch/takeover behavior before enabling Watch. Public research and independent source validation must still fail closed when the relevant source cannot be read.

"use client";

import Script from "next/script";

export function PlausibleAnalytics() {
  return (
    <>
      <Script
        src="https://plausible.io/js/pa-IToCqdku8bp7LkDzWGOcF.js"
        strategy="afterInteractive"
      />
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();`}
      </Script>
    </>
  );
}

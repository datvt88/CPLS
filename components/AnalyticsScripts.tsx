'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

interface AnalyticsConfig {
  clarityEnabled: boolean
  clarityId: string
  googleAnalyticsEnabled: boolean
  googleAnalyticsId: string
}

export default function AnalyticsScripts() {
  const [config, setConfig] = useState<AnalyticsConfig>({
    clarityEnabled: true, // Default enabled with provided ID
    clarityId: 'udywqzdpit',
    googleAnalyticsEnabled: false,
    googleAnalyticsId: '',
  })

  useEffect(() => {
    // Load config from localStorage (set by admin)
    const savedConfig = localStorage.getItem('analytics-config')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig(parsed)
      } catch (e) {
        console.error('Error parsing analytics config:', e)
      }
    }
  }, [])

  return (
    <>
      {/* Microsoft Clarity */}
      {config.clarityEnabled && config.clarityId && (
        <Script
          id="clarity-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${config.clarityId}");
            `,
          }}
        />
      )}

      {/* Google Analytics */}
      {config.googleAnalyticsEnabled && config.googleAnalyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${config.googleAnalyticsId}');
              `,
            }}
          />
        </>
      )}
    </>
  )
}

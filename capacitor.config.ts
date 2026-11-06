import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.portfolio.neondrift',
  appName: 'Neon Drift',
  // The built game is copied into the APK; there is no server.url, so the app never loads a remote page.
  webDir: 'dist',
  // Matches the night asphalt, so the WebView never flashes white while the page loads.
  backgroundColor: '#07060d',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SystemBars: {
      // The game is always dark, so the status and navigation bars always get light icons ("DARK" = for dark
      // backgrounds). Left on its default it follows the phone's theme and the icons can vanish.
      style: 'DARK',
      // index.html uses viewport-fit=cover; saying so up front avoids a layout shift when the page loads.
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;

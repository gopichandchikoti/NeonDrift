import { defineConfig } from 'vitest/config';

// Neon Drift's fixed dev/preview port. SkyHop uses 5605 and Orbit Shift 5610; this one must not collide with them.
const PORT = 5615;

export default defineConfig({
  // Relative asset URLs: the Android WebView serves the bundle from its own origin, not from a domain root.
  base: './',
  server: {
    port: PORT,
    strictPort: true,
    host: 'localhost',
    // Gradle and the test runners write into these folders; none of it should reload the page.
    watch: { ignored: ['**/android/**', '**/artifacts/**', '**/coverage/**', '**/tests/**/output/**'] },
  },
  preview: { port: PORT, strictPort: true, host: 'localhost' },
  build: {
    target: 'es2020',
    // Phaser alone is ~1.2 MB minified; the game is one bundle loaded from the device, never over a network.
    chunkSizeWarningLimit: 1800,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Some suites play the autopilot through whole courses.
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      include: ['src/**/*.ts'],
      // Documented exceptions: files that only draw with a real WebGL canvas (covered by the Playwright suite in
      // tests/e2e), the browser entry point, the dev-only inspector, authored stage data and generated calibration.
      // Everything with logic (camera, quality, effects pool, event mapping, the whole simulation) stays covered.
      exclude: [
        'src/main.ts',
        'src/app/dev.ts',
        'src/game/scenes/drive-scene.ts',
        'src/game/scenes/rain.ts',
        'src/game/scenes/draw/{road,city,car,objects,grid}.ts',
        'src/game/levels/stages/**',
        'src/game/levels/calibration.ts',
        'src/**/*.d.ts',
      ],
      thresholds: { lines: 90, statements: 90, branches: 90, functions: 90 },
    },
  },
});

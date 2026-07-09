import { defineConfig } from 'vitest/config';

/**
 * Opt-in integration tests that spawn a real `vipm` / `docker` build and assert
 * that a `.vip` is produced. They are excluded from the default `npm test`
 * (which only runs `tests/unit/**`) because they require LabVIEW + VIPM (and, for
 * the docker-windows provider, a Windows Docker container). Run them with
 * `npm run test:integration` and the `LVPB_*` environment variables described in
 * tests/integration/windowsBuild.integration.test.ts.
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.integration.test.ts'],
    // A real LabVIEW build (launch + mass-compile + package) can take minutes.
    testTimeout: 1_200_000,
    hookTimeout: 1_200_000
  }
});

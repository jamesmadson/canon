/**
 * Starts the consent bar and Google Analytics on the marketing pages. The dev
 * server skips it, so local work does not count as visits. Add ?ga=1 to the
 * address to try the bar there.
 */
import { initAnalytics } from '../lib/analytics';

initAnalytics({
  doc: document,
  win: window,
  enabled: !import.meta.env.DEV || new URLSearchParams(location.search).get('ga') === '1',
});

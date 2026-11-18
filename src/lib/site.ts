/**
 * Where the hosted waitlist form posts its answers: a Formspree form. While it
 * is empty the homepage shows no form and no waitlist button, and the hosted
 * card says the waitlist opens soon.
 *
 * The page posts from the browser with a normal cors request and reads the
 * answer, so the endpoint must allow cross-origin posts from this site and
 * answer with an ok status. Otherwise people see the failure message.
 */
export const WAITLIST_URL = 'https://formspree.io/f/xrpqqjqb';

/** The Google Analytics 4 measurement ID. Only the marketing pages use it, never the app. */
export const GA_ID = 'G-F4MW70DVD4';

export const REPO_URL = 'https://github.com/jamesmadson/canon';
export const ISSUES_URL = 'https://github.com/jamesmadson/canon/issues';
export const SETUP_COMMAND = 'claude mcp add canon -- npx -y usecanon mcp';

/**
 * Where the hosted waitlist form posts its answers. Empty until there is
 * somewhere to send them. While it is empty the homepage shows no form and no
 * waitlist button, and the hosted card says the waitlist opens soon.
 *
 * The page posts from the browser with a normal cors request and reads the
 * answer, so the endpoint must allow cross-origin posts from this site and
 * answer with an ok status. Otherwise people see the failure message.
 */
export const WAITLIST_URL = '';

export const REPO_URL = 'https://github.com/jamesmadson/canon';
export const ISSUES_URL = 'https://github.com/jamesmadson/canon/issues';
export const START_COMMAND = 'npx usecanon';
export const SETUP_COMMAND = 'claude mcp add canon -- npx -y usecanon mcp';

/**
 * The two strings the homepage cannot invent for itself.
 *
 * INSTALL_COMMAND is the one place the package name is written down. The
 * package is not published yet, so the name here is a placeholder and every
 * surface that shows an install line reads it from this constant rather than
 * repeating it. Renaming the package is then one edit, not a search.
 */
// TODO(name): the package is unpublished. Settle the name, then change it here.
export const INSTALL_COMMAND = 'npx @canon-design/cli init';

/**
 * Where the alpha sign-up posts. Empty until the endpoint exists, and the form
 * reads that emptiness as the instruction to disable itself and say why. A
 * submit button that pretended to work would be the one control on this site
 * that lies about what it did.
 */
export const SIGNUP_ENDPOINT = '';

/** Printed beside the disabled button, so the reason is on the page. */
export const SIGNUP_CLOSED_NOTE = 'Sign-up opens with the alpha.';

export type SignupState =
  | { open: true; action: string }
  | { open: false; reason: string };

/**
 * Whether the sign-up form can accept an address, and if not, what to say.
 *
 * The rule lives here rather than in the component so it can be tested without
 * rendering a page: an empty endpoint closes the form and supplies the reason.
 */
export function signupState(endpoint: string = SIGNUP_ENDPOINT): SignupState {
  const trimmed = endpoint.trim();
  return trimmed === ''
    ? { open: false, reason: SIGNUP_CLOSED_NOTE }
    : { open: true, action: trimmed };
}

// How the site frames the pages the skills made. Shared by the skill pages and
// the homepage, so the two cannot disagree.

// A page that needs no script is framed on the site's origin with scripts
// blocked. A fully opaque sandbox draws nothing in some embedded browsers,
// and with no scripts, sharing the origin gives the page nothing to act with.
export const STATIC_SANDBOX = 'allow-same-origin';

// Graft's page needs its scripts. Running them on the site's origin is only
// acceptable because the page is Canon's own output, rendered with --public.
export const SCRIPTED_SANDBOX = 'allow-scripts allow-same-origin';

/**
 * Branch names to family trees.
 *
 * A prototype is a family: a root plus its variants. The hierarchy lives in
 * the branch name's path depth, so it is derived on every run and never
 * stored. Nothing here touches the filesystem or git, which is why it is the
 * first thing the suite pins.
 *
 * Two rules keep the derivation honest:
 *   1. A branch is a child only when its named parent is also selected.
 *      Otherwise it stands as its own root and says so, rather than being
 *      hung off a parent the person chose not to index.
 *   2. A configured familyRoot wins over the name, because teams arrive with
 *      conventions and a rename is not the price of being indexed.
 */

/** Path depth below the namespace segment: proto/today-ring is 1, its child is 2. */
export function branchDepth(name) {
  return name.split('/').length - 1;
}

/** The name a family reads under: the last segment of its root branch. */
export function familyDisplayName(root) {
  const segments = root.split('/');
  return segments[segments.length - 1];
}

function namedParent(name) {
  const cut = name.lastIndexOf('/');
  return cut === -1 ? null : name.slice(0, cut);
}

/**
 * @param {Array<{name: string, lastCommit?: string}>} branches every local branch
 * @param {{defaultBranch?: string, selected?: string[]|null, familyRoots?: Record<string,string>}} options
 * @returns {Array<object>} families sorted by root branch name
 */
export function deriveFamilies(branches, options = {}) {
  const { defaultBranch = 'main', selected = null, familyRoots = {} } = options;

  const chosen = branches
    .filter((b) => b.name !== defaultBranch)
    .filter((b) => (selected === null ? true : selected.includes(b.name)));

  const present = new Set(chosen.map((b) => b.name));

  // Resolve each branch to its parent inside the selected set, or to null.
  const parentOf = new Map();
  for (const b of chosen) {
    const configured = familyRoots[b.name];
    if (configured && configured !== b.name && present.has(configured)) {
      parentOf.set(b.name, configured);
      continue;
    }
    const parent = namedParent(b.name);
    parentOf.set(b.name, parent && present.has(parent) ? parent : null);
  }

  // Walk to the root of each chain. A configured cycle would loop forever, so
  // the walk is bounded by the number of branches and falls back to the branch
  // itself, which is the honest answer for an unresolvable chain.
  function rootOf(name) {
    let current = name;
    for (let step = 0; step < chosen.length + 1; step += 1) {
      const parent = parentOf.get(current);
      if (!parent) return current;
      current = parent;
    }
    return name;
  }

  const byRoot = new Map();
  for (const b of chosen) {
    const root = rootOf(b.name);
    if (!byRoot.has(root)) byRoot.set(root, []);
    const parent = parentOf.get(b.name);
    byRoot.get(root).push({
      ...b,
      parent,
      depth: branchDepth(b.name),
      label: familyDisplayName(b.name),
      // A branch whose name implies a parent that nobody selected. Stated on
      // the node so the tree can show it standing alone on purpose.
      orphaned: parent === null && namedParent(b.name) !== null,
    });
  }

  return [...byRoot.entries()]
    .map(([root, nodes]) => {
      nodes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      const dates = nodes.map((n) => n.lastCommit).filter(Boolean);
      return {
        root,
        name: familyDisplayName(root),
        nodes,
        size: nodes.length,
        maxDepth: nodes.reduce((max, n) => Math.max(max, n.depth), 0),
        lastCommit: dates.length ? dates.slice().sort().reverse()[0] : null,
      };
    })
    .sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
}

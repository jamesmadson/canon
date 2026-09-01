/**
 * Branch names to family trees.
 *
 * A prototype is a family: a root plus its variants. The hierarchy lives in
 * the branch name's path depth, so it is derived on every run and never
 * stored. Nothing here touches the filesystem or git, which is why it is the
 * first thing the suite pins.
 *
 * One fact about git shapes all of this. Git stores a branch as a file under
 * refs/heads, so a repository cannot hold proto/ring and proto/ring/alt at the
 * same time: the first is a file where the second needs a directory, and git
 * refuses the second outright. A family whose root is itself a branch is
 * therefore rare, and the ordinary shape is a shared prefix that no branch
 * occupies, with the variants underneath it.
 *
 * So there are three ways a branch finds its place, in this order:
 *
 *   1. A configured familyRoot wins over the name, because teams arrive with
 *      conventions and a rename is not the price of being indexed.
 *   2. Its named parent, when that parent is a selected branch.
 *   3. The deepest ancestor prefix that no branch occupies and that two or
 *      more selected branches share. That prefix becomes a virtual root: a
 *      node in the tree with no commit of its own.
 *
 * A branch whose named parent exists but was not selected falls through all
 * three and stands as its own root, saying so rather than being hung off a
 * parent the person chose to leave out.
 */

/** Path depth below the namespace segment: proto/today-ring is 1, its child is 2. */
export function branchDepth(name) {
  return name.split('/').length - 1;
}

/** The name a family reads under: the last segment of its root. */
export function familyDisplayName(root) {
  const segments = root.split('/');
  return segments[segments.length - 1];
}

function namedParent(name) {
  const cut = name.lastIndexOf('/');
  return cut === -1 ? null : name.slice(0, cut);
}

/** Every strict ancestor prefix of a branch name, deepest first. */
function ancestors(name) {
  const out = [];
  for (let parent = namedParent(name); parent; parent = namedParent(parent)) out.push(parent);
  return out;
}

/**
 * @param {Array<{name: string, lastCommit?: string}>} branches every local branch
 * @param {{defaultBranch?: string, selected?: string[]|null, familyRoots?: Record<string,string>}} options
 * @returns {Array<object>} families sorted by root name
 */
export function deriveFamilies(branches, options = {}) {
  const { defaultBranch = 'main', selected = null, familyRoots = {} } = options;

  const everyName = new Set(branches.map((b) => b.name));

  const chosen = branches
    .filter((b) => b.name !== defaultBranch)
    .filter((b) => (selected === null ? true : selected.includes(b.name)));

  const present = new Set(chosen.map((b) => b.name));

  // A prefix earns a virtual node when no branch occupies it and two or more
  // selected branches sit under it. One branch under a prefix is just a branch
  // with a slash in its name, and inventing a parent for it would be noise.
  //
  // The first segment is excluded on purpose. A root sits at depth 1, so the
  // leading namespace that every branch shares is a filing convention rather
  // than a family, and treating proto as a prototype would say nothing.
  const shareCount = new Map();
  for (const b of chosen) {
    for (const prefix of ancestors(b.name)) {
      shareCount.set(prefix, (shareCount.get(prefix) || 0) + 1);
    }
  }
  const virtualNames = new Set(
    [...shareCount.entries()]
      .filter(([prefix, count]) => count >= 2 && branchDepth(prefix) >= 1 && !everyName.has(prefix))
      .map(([prefix]) => prefix),
  );

  function placeUnder(name) {
    const parent = namedParent(name);
    if (parent && present.has(parent)) return parent;
    for (const ancestor of ancestors(name)) {
      if (virtualNames.has(ancestor)) return ancestor;
    }
    return null;
  }

  const parentOf = new Map();
  for (const b of chosen) {
    const configured = familyRoots[b.name];
    if (configured && configured !== b.name && (present.has(configured) || virtualNames.has(configured))) {
      parentOf.set(b.name, configured);
    } else {
      parentOf.set(b.name, placeUnder(b.name));
    }
  }
  for (const name of virtualNames) parentOf.set(name, placeUnder(name));

  const allNodes = [
    ...chosen.map((b) => ({ ...b, virtual: false })),
    ...[...virtualNames].map((name) => ({ name, lastCommit: null, sha: '', subject: '', virtual: true })),
  ];

  // Walk to the root of each chain, bounded so a configured cycle cannot spin.
  function rootOf(name) {
    let current = name;
    for (let step = 0; step < allNodes.length + 1; step += 1) {
      const parent = parentOf.get(current);
      if (!parent) return current;
      current = parent;
    }
    return name;
  }

  const byRoot = new Map();
  for (const node of allNodes) {
    const root = rootOf(node.name);
    if (!byRoot.has(root)) byRoot.set(root, []);
    const parent = parentOf.get(node.name) ?? null;
    byRoot.get(root).push({
      ...node,
      parent,
      depth: branchDepth(node.name),
      label: familyDisplayName(node.name),
      // A branch whose name implies a parent that nobody selected. Stated on
      // the node so the tree can show it standing alone on purpose.
      orphaned: !node.virtual && parent === null && namedParent(node.name) !== null,
    });
  }

  return [...byRoot.entries()]
    .map(([root, nodes]) => {
      nodes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      const dates = nodes.map((n) => n.lastCommit).filter(Boolean).sort();
      const newest = dates.length ? dates[dates.length - 1] : null;
      // A virtual node has no commit of its own, so it carries the newest date
      // underneath it rather than showing a blank where a date should be.
      for (const node of nodes) if (node.virtual) node.lastCommit = newest;
      return {
        root,
        name: familyDisplayName(root),
        virtualRoot: nodes.some((n) => n.name === root && n.virtual),
        nodes,
        size: nodes.filter((n) => !n.virtual).length,
        maxDepth: nodes.reduce((max, n) => Math.max(max, n.depth), 0),
        lastCommit: newest,
      };
    })
    .sort((a, b) => (a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
}

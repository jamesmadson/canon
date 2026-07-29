export interface FilterableSkill {
  tools: string[];
  categories: string[];
}

export interface FacetFilter {
  tools: string[];
  categories: string[];
}

export function filterSkills<T extends FilterableSkill>(skills: T[], filter: FacetFilter): T[] {
  const hasToolFilter = filter.tools.length > 0;
  const hasCategoryFilter = filter.categories.length > 0;

  if (!hasToolFilter && !hasCategoryFilter) {
    return skills;
  }

  return skills.filter((skill) => {
    const matchesTools = !hasToolFilter || skill.tools.some((tool) => filter.tools.includes(tool));
    const matchesCategories =
      !hasCategoryFilter || skill.categories.some((category) => filter.categories.includes(category));
    return matchesTools && matchesCategories;
  });
}

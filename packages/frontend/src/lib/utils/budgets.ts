export interface BudgetCategory {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface BudgetCategoryNode extends BudgetCategory {
  children: BudgetCategory[];
}

export function getBudgetProgressGradient(percentUsed: number): string {
  if (percentUsed >= 100)
    return 'linear-gradient(90deg, var(--fo-danger-500), var(--fo-danger-400))';
  if (percentUsed >= 80)
    return 'linear-gradient(90deg, var(--fo-accent-500), var(--fo-danger-400))';
  if (percentUsed >= 50)
    return 'linear-gradient(90deg, var(--fo-primary-500), var(--fo-accent-500))';
  return 'linear-gradient(90deg, var(--fo-primary-600), var(--fo-primary-400))';
}

export function getBudgetStatusBadge(percentUsed: number): { label: string; class: string } {
  if (percentUsed >= 100) {
    return {
      label: 'Over Budget',
      class: 'bg-red-500/10 text-red-400 ring-red-500/20',
    };
  }

  if (percentUsed >= 80) {
    return {
      label: 'Near Limit',
      class: 'bg-accent-500/10 text-accent-400 ring-accent-500/20',
    };
  }

  if (percentUsed >= 50) {
    return {
      label: 'On Track',
      class: 'bg-primary-500/10 text-primary-400 ring-primary-500/20',
    };
  }

  return {
    label: 'Under Budget',
    class: 'bg-primary-500/10 text-primary-400 ring-primary-500/20',
  };
}

export function getBudgetProgressTextColor(percentUsed: number): string {
  if (percentUsed >= 100) return 'text-red-400';
  if (percentUsed >= 80) return 'text-accent-400';
  return 'text-primary-400';
}

export function getBudgetCategoryIcon(categoryName: string | null): string {
  if (!categoryName) return '?';

  const name = categoryName.toLowerCase();
  if (
    name.includes('food') ||
    name.includes('grocery') ||
    name.includes('groceries') ||
    name.includes('dining') ||
    name.includes('restaurant')
  )
    return 'F';
  if (
    name.includes('transport') ||
    name.includes('gas') ||
    name.includes('auto') ||
    name.includes('car')
  )
    return 'T';
  if (name.includes('shop') || name.includes('cloth') || name.includes('retail')) return 'S';
  if (name.includes('entertainment') || name.includes('movie') || name.includes('game')) return 'E';
  if (name.includes('health') || name.includes('medical') || name.includes('doctor')) return 'H';
  if (
    name.includes('home') ||
    name.includes('rent') ||
    name.includes('mortgage') ||
    name.includes('housing')
  )
    return 'R';
  if (
    name.includes('util') ||
    name.includes('electric') ||
    name.includes('water') ||
    name.includes('internet')
  )
    return 'U';
  if (name.includes('travel') || name.includes('hotel') || name.includes('flight')) return 'V';
  if (name.includes('education') || name.includes('school') || name.includes('book')) return 'B';
  if (name.includes('subscription') || name.includes('software')) return 'W';

  return categoryName.charAt(0).toUpperCase();
}

export function getBudgetCategoryTree(categories: BudgetCategory[]): BudgetCategoryNode[] {
  const parents = categories.filter((category) => !category.parentId);

  return parents.map((parent) => ({
    ...parent,
    children: categories.filter((category) => category.parentId === parent.id),
  }));
}

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	let categories: any[] = [];
	let rules: any[] = [];

	try {
		const [cats, rls] = await Promise.all([
			api('/categories', { accessToken: locals.accessToken }),
			api('/categories/rules/list', { accessToken: locals.accessToken })
		]);

		categories = cats || [];
		rules = rls || [];
	} catch {
		// Use defaults on failure
	}

	return { categories, rules };
};

export const actions: Actions = {
	createCategory: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const color = formData.get('color') as string;
		const icon = formData.get('icon') as string;
		const parentId = formData.get('parentId') as string;

		if (!name) {
			return fail(400, { categoryError: 'Category name is required.' });
		}

		try {
			await api('/categories', {
				method: 'POST',
				body: {
					name,
					color: color || undefined,
					icon: icon || undefined,
					parentId: parentId || undefined
				},
				accessToken: locals.accessToken
			});
			return { categorySuccess: true };
		} catch (e: any) {
			return fail(500, { categoryError: e.message || 'Failed to create category.' });
		}
	},

	updateCategory: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = (formData.get('name') as string)?.trim();
		const color = formData.get('color') as string;
		const icon = formData.get('icon') as string;
		const parentId = formData.get('parentId') as string;

		if (!id) {
			return fail(400, { categoryError: 'Category ID is required.' });
		}

		try {
			await api(`/categories/${id}`, {
				method: 'PATCH',
				body: {
					name: name || undefined,
					color: color || undefined,
					icon: icon || undefined,
					parentId: parentId || undefined
				},
				accessToken: locals.accessToken
			});
			return { categoryUpdateSuccess: true };
		} catch (e: any) {
			return fail(500, { categoryError: e.message || 'Failed to update category.' });
		}
	},

	deleteCategory: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { categoryError: 'Category ID is required.' });
		}

		try {
			await api(`/categories/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { categoryDeleteSuccess: true };
		} catch (e: any) {
			return fail(500, { categoryError: e.message || 'Failed to delete category.' });
		}
	},

	createRule: async ({ request, locals }) => {
		const formData = await request.formData();
		const categoryId = formData.get('categoryId') as string;
		const matchType = formData.get('matchType') as string;
		const matchValue = (formData.get('matchValue') as string)?.trim();

		if (!categoryId || !matchType || !matchValue) {
			return fail(400, { ruleError: 'All rule fields are required.' });
		}

		try {
			await api('/categories/rules', {
				method: 'POST',
				body: { categoryId, matchType, matchValue },
				accessToken: locals.accessToken
			});
			return { ruleSuccess: true };
		} catch (e: any) {
			return fail(500, { ruleError: e.message || 'Failed to create rule.' });
		}
	},

	deleteRule: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { ruleError: 'Rule ID is required.' });
		}

		try {
			await api(`/categories/rules/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { ruleDeleteSuccess: true };
		} catch (e: any) {
			return fail(500, { ruleError: e.message || 'Failed to delete rule.' });
		}
	}
};

import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [accountsData, transfers, interest, ratesData] = await Promise.all([
			api('/banking/accounts', { accessToken: locals.accessToken }).catch(() => ({
				accounts: [],
				summary: {
					totalBalance: 0,
					checkingBalance: 0,
					savingsBalance: 0,
					accountCount: 0,
					checkingCount: 0,
					savingsCount: 0
				}
			})),
			api('/banking/transfers', { accessToken: locals.accessToken }).catch(() => []),
			api('/banking/interest', { accessToken: locals.accessToken }).catch(() => ({
				totalEarned: 0,
				thisMonth: 0,
				thisYear: 0,
				payments: [],
				byAccount: []
			})),
			api('/banking/rates', { accessToken: locals.accessToken }).catch(() => ({
				rates: [
					{
						provider: 'default',
						checking: { apy: 0.001, isVariable: true },
						savings: { apy: 0.045, isVariable: true }
					}
				],
				fdic: {
					insured: true,
					maxCoverageFormatted: '$250,000',
					disclosure:
						'Deposits are FDIC insured up to $250,000 per depositor, per insured bank.',
					learnMoreUrl: 'https://www.fdic.gov/resources/deposit-insurance/'
				}
			}))
		]);

		return {
			accounts: accountsData.accounts || [],
			summary: accountsData.summary || {
				totalBalance: 0,
				checkingBalance: 0,
				savingsBalance: 0,
				accountCount: 0,
				checkingCount: 0,
				savingsCount: 0
			},
			transfers: Array.isArray(transfers) ? transfers : [],
			interest,
			rates: ratesData.rates || [],
			fdic: ratesData.fdic || {
				insured: true,
				maxCoverageFormatted: '$250,000',
				disclosure:
					'Deposits are FDIC insured up to $250,000 per depositor, per insured bank.',
				learnMoreUrl: 'https://www.fdic.gov/resources/deposit-insurance/'
			}
		};
	} catch {
		return {
			accounts: [],
			summary: {
				totalBalance: 0,
				checkingBalance: 0,
				savingsBalance: 0,
				accountCount: 0,
				checkingCount: 0,
				savingsCount: 0
			},
			transfers: [],
			interest: {
				totalEarned: 0,
				thisMonth: 0,
				thisYear: 0,
				payments: [],
				byAccount: []
			},
			rates: [],
			fdic: {
				insured: true,
				maxCoverageFormatted: '$250,000',
				disclosure:
					'Deposits are FDIC insured up to $250,000 per depositor, per insured bank.',
				learnMoreUrl: 'https://www.fdic.gov/resources/deposit-insurance/'
			}
		};
	}
};

export const actions: Actions = {
	openAccount: async ({ request, locals }) => {
		const formData = await request.formData();
		const type = formData.get('type') as string;
		const fullName = formData.get('fullName') as string;
		const email = formData.get('email') as string;
		const dateOfBirth = formData.get('dateOfBirth') as string;
		const ssn = formData.get('ssn') as string;
		const street = formData.get('street') as string;
		const city = formData.get('city') as string;
		const state = formData.get('state') as string;
		const postalCode = formData.get('postalCode') as string;
		const phone = (formData.get('phone') as string) || undefined;

		if (!type || !fullName || !email || !dateOfBirth || !ssn || !street || !city || !state || !postalCode) {
			return fail(400, { error: 'All required fields must be filled.' });
		}

		try {
			const result = await api('/banking/accounts', {
				method: 'POST',
				accessToken: locals.accessToken,
				body: {
					type,
					fullName,
					email,
					dateOfBirth,
					ssn,
					address: { street, city, state, postalCode, country: 'US' },
					phone
				}
			});

			return { success: true, account: result };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to open account.'
			});
		}
	},

	initiateTransfer: async ({ request, locals }) => {
		const formData = await request.formData();
		const fromAccountId = formData.get('fromAccountId') as string;
		const toAccountId = formData.get('toAccountId') as string;
		const amount = Number(formData.get('amount'));
		const memo = (formData.get('memo') as string) || undefined;
		const transferType = (formData.get('transferType') as string) || 'internal';
		const routingNumber = (formData.get('routingNumber') as string) || undefined;
		const accountNumber = (formData.get('accountNumber') as string) || undefined;

		if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
			return fail(400, { error: 'Valid source, destination, and amount are required.' });
		}

		try {
			const result = await api('/banking/transfers', {
				method: 'POST',
				accessToken: locals.accessToken,
				body: {
					fromAccountId,
					toAccountId,
					amount: Math.round(amount * 100), // convert dollars to cents
					memo,
					transferType,
					routingNumber,
					accountNumber
				}
			});

			return { transferSuccess: true, transfer: result };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to initiate transfer.'
			});
		}
	}
};

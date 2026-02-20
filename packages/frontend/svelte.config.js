import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Use adapter-vercel for Vercel deployments (pin runtime to a supported LTS).
 * Use adapter-node for Docker/self-hosted deployments.
 *
 * Set ADAPTER=node to force adapter-node (e.g. in docker-compose).
 */
const useNodeAdapter = process.env.ADAPTER === 'node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: useNodeAdapter
			? adapterNode({ out: 'build' })
			: adapterVercel({ runtime: 'nodejs24.x' }),
		alias: {
			$components: 'src/lib/components',
			$stores: 'src/lib/stores'
		}
	}
};

export default config;

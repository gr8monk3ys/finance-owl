import adapterAuto from '@sveltejs/adapter-auto';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Use adapter-auto for Vercel/cloud deployments (auto-detects platform).
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
			: adapterAuto(),
		alias: {
			$components: 'src/lib/components',
			$stores: 'src/lib/stores'
		}
	}
};

export default config;

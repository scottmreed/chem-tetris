// @ts-check

/**
 * @type {import('robo.js').Config}
 **/
export default {
	experimental: {
		disableBot: true
	},
	plugins: ['@robojs/sync'],
	type: 'robo',
	watcher: {
		ignore: ['src/app', 'src/components', 'src/hooks']
	}
}

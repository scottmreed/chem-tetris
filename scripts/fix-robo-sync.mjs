import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'node_modules', '@robojs', 'sync', 'client.js');

if (fs.existsSync(filePath)) {
	const content = `export * from './.robo/build/core/types.js'
export { SyncContextProvider } from './.robo/build/core/context.js'
export { useSyncState } from './.robo/build/core/useSyncState.js'`;
	
	fs.writeFileSync(filePath, content);
	console.log('Successfully patched @robojs/sync/client.js');
} else {
	console.error('Could not find @robojs/sync/client.js to patch');
}

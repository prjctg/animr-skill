#!/usr/bin/env node
/**
 * Open the browser preview.   npm run preview -- [anims/my-anim@0.1.yaml] [--port 5173]
 * Serves the repo on 127.0.0.1 and prints the URL. The page lists every module under anims/, examples/
 * and skill/templates/; the module is re-read from disk on each Reload.
 */
import { serve } from './serve.mjs';

const argv = process.argv.slice(2);
const pi = argv.indexOf('--port');
const port = pi < 0 ? 5173 : Number(argv[pi + 1]);
const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--port'));
const { url } = await serve({ port });
const link = url + '/harness/preview.html' + (file ? '?src=' + encodeURIComponent(file.replaceAll('\\', '/')) : '');
console.log(`preview: ${link}\n(ctrl+c to stop)`);

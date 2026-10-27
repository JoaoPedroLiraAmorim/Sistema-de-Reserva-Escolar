import { copyFile, mkdir, readdir, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'public');
// Só esta pasta gerada pode ser removida. Links não são seguidos.
if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== 'public') {
    throw new Error('Diretório de saída inválido.');
}
const existing = await lstat(output).catch(error => {
    if (error.code !== 'ENOENT') throw error;
});
if (existing?.isSymbolicLink()) throw new Error('public não pode ser um link.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(path.join(root, 'index.html'), path.join(output, 'index.html'));

const allowed = {
    pages: new Set(['.html']),
    css: new Set(['.css']),
    js: new Set(['.js']),
    imagens: new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico']),
};
async function copyDirectory(relative, extensions) {
    const source = path.join(root, relative);
    if ((await lstat(source)).isSymbolicLink()) throw new Error(`Link não permitido: ${relative}`);
    await mkdir(path.join(output, relative), { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
        const child = path.join(relative, entry.name);
        if (entry.isDirectory()) await copyDirectory(child, extensions);
        else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
            await copyFile(path.join(root, child), path.join(output, child));
        }
    }
}
for (const [directory, extensions] of Object.entries(allowed)) await copyDirectory(directory, extensions);
console.log('public/ gerada: index.html, pages/, css/, js/ e imagens/.');

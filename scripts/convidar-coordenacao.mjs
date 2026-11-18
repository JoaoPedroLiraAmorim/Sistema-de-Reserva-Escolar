import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [emailArg, target, persistTo] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    !['--remote', '--local'].includes(target) || (persistTo && target !== '--local')) {
    console.error('Uso: node scripts/convidar-coordenacao.mjs email@exemplo.com --local|--remote [diretório-local]');
    process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const secret = randomBytes(32).toString('base64url');
const hash = createHash('sha256').update(secret).digest('base64url');
const expira = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
const escapedEmail = email.replaceAll("'", "''");
const directory = mkdtempSync(path.join(tmpdir(), 'alceu-convite-'));
try {
    const file = path.join(directory, 'convite.sql');
    writeFileSync(file, `INSERT INTO convites (hash, email, papel, expira)
        SELECT '${hash}', '${escapedEmail}', 'coordenacao', ${expira}
        WHERE NOT EXISTS (SELECT 1 FROM contas WHERE email = '${escapedEmail}')
        ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, expira = excluded.expira, papel = 'coordenacao'
        WHERE NOT EXISTS (SELECT 1 FROM contas WHERE email = excluded.email);
        SELECT EXISTS (SELECT 1 FROM convites WHERE hash = '${hash}'
            AND NOT EXISTS (SELECT 1 FROM contas WHERE email = '${escapedEmail}')) AS criado;`, { mode: 0o600 });
    const command = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
    const args = [command, 'd1', 'execute', 'edulab-dev', target, '--file', file, '--json'];
    if (persistTo) args.push('--persist-to', persistTo);
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Falha ao criar convite.');
    const output = JSON.parse(result.stdout);
    if (output.at(-1)?.results?.[0]?.criado !== 1) throw new Error('Este endereço já tem uma conta.');
    const origin = target === '--remote' ? 'https://app.reservas-alceu.workers.dev' : 'http://localhost:8787';
    console.log(origin + '/pages/conta.html#convite=' + secret);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    rmSync(directory, { recursive: true, force: true });
}

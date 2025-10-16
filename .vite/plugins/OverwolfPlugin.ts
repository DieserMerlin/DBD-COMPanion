import { existsSync } from 'fs';
import { readFile, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import semver from 'semver';
import { Plugin } from 'vite';
import { zip } from 'zip-a-folder';

type Options = {
    setVersion?: string | undefined;
    makeOpk?: string | undefined; // "true" or a suffix like "beta"
};

const r = (p: string) => resolve(process.cwd(), p);

export default function overwolfVitePlugin(options: Options = {}): Plugin {
    const pluginName = 'overwolf-plugin';

    const packagePath = r('package.json');
    const manifestPath = r('public/manifest.json');
    const distDir = r('dist');

    const readJSON = async <T = any>(p: string): Promise<T | null> => {
        try {
            const raw = await readFile(p, 'utf-8');
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    };

    const writeText = (p: string, content: string) => writeFile(p, content, 'utf-8');

    const deleteFileIfExists = async (p: string) => {
        if (existsSync(p)) {
            try { await unlink(p); } catch { }
        }
    };

    const setVersionIfRequested = async () => {
        const newVersion = options.setVersion;
        if (!newVersion) return;

        if (!semver.valid(newVersion)) {
            throw new Error(`[${pluginName}] Invalid semver "${newVersion}"`);
        }

        const [pkg, manifest] = await Promise.all([
            readJSON<any>(packagePath),
            readJSON<any>(manifestPath),
        ]);

        if (!pkg) throw new Error(`[${pluginName}] could not read package.json`);
        if (!manifest) throw new Error(`[${pluginName}] could not read manifest.json`);

        pkg.version = newVersion;
        if (!manifest.meta) manifest.meta = {};
        manifest.meta.version = newVersion;

        await Promise.all([
            writeText(packagePath, JSON.stringify(pkg, null, 2)),
            writeText(manifestPath, JSON.stringify(manifest, null, 2)),
        ]);
        // eslint-disable-next-line no-console
        console.log(`[${pluginName}] Version set to ${newVersion}`);
    };

    const makeOPKIfRequested = async () => {
        const makeOpk = options.makeOpk;
        if (!makeOpk) return;

        const [pkg, manifest] = await Promise.all([
            readJSON<any>(packagePath),
            readJSON<any>(manifestPath),
        ]);

        if (!pkg) throw new Error(`[${pluginName}] could not read package.json`);
        if (!manifest) throw new Error(`[${pluginName}] could not read manifest.json`);

        const version = pkg.version;
        const name = manifest.meta?.name;
        if (!name) throw new Error(`[${pluginName}] manifest.meta.name not found`);

        const suffix = makeOpk === 'true' ? '' : `.${makeOpk}`;
        const releasesDir = r('releases');
        const opkPath = join(releasesDir, `${name}-${version}${suffix}.opk`);

        await deleteFileIfExists(opkPath);
        await zip(distDir, opkPath);

        // eslint-disable-next-line no-console
        console.log(`[${pluginName}] OPK created at ${opkPath}`);
    };

    return {
        name: pluginName,

        // Equivalent to your webpack "run" phase: set version before build starts
        async configResolved() {
            await setVersionIfRequested();
        },

        // After everything is written to dist/
        async closeBundle() {
            await makeOPKIfRequested();
        },
    };
}
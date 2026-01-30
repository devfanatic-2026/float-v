import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { createRequire } from 'node:module';

export interface VibeDiagnostics {
    reactMismatch: boolean;
    multipleReacts: string[];
    hydrationReady: boolean;
    transformCacheSize: number;
}

/**
 * VibeDebugger - A specialized debugging suite for agents and LLMs
 */
export class VibeDebugger {
    private static enabled = false;
    private static rootDir: string;

    static init(enabled: boolean, rootDir: string) {
        this.enabled = enabled;
        this.rootDir = rootDir;
        if (this.enabled) {
            this.log('VibeDebug mode activated. Starting diagnostics...');
            this.runInitialCheck();
        }
    }

    static isEnabled() {
        return this.enabled;
    }

    static log(message: string, detail?: any) {
        if (!this.enabled) return;
        console.log(pc.magenta(`🔍 [VibeDebug] ${message}`));
        if (detail) {
            console.log(pc.dim(JSON.stringify(detail, null, 2)));
        }
    }

    static error(message: string, error?: any) {
        if (!this.enabled) return;
        console.error(pc.red(`⚠️ [VibeDebug Error] ${message}`));
        if (error) console.error(error);
    }

    private static runInitialCheck() {
        const diagnostics = this.getDiagnostics();
        if (diagnostics.multipleReacts.length > 1) {
            this.error('Multiple React instances detected. This is a critical issue for SSR Hooks.');
            diagnostics.multipleReacts.forEach(p => console.log(pc.dim(`  - ${p}`)));
        }
    }

    static getDiagnostics(): VibeDiagnostics {
        const reacts: string[] = [];

        // Check various common locations
        const locations = [
            this.rootDir,
            path.join(this.rootDir, 'node_modules'),
            path.resolve(this.rootDir, '..'),
        ];

        for (const loc of locations) {
            try {
                const r = createRequire(path.join(loc, 'noop.js')).resolve('react');
                const real = fs.realpathSync(r);
                if (!reacts.includes(real)) reacts.push(real);
            } catch (e) { }
        }

        return {
            reactMismatch: reacts.length > 1,
            multipleReacts: reacts,
            hydrationReady: true, // TODO: Implement more checks
            transformCacheSize: 0,
        };
    }
    static dumpEvidence(type: string, data: any) {
        if (!this.enabled) return;

        const evidenceDir = path.join(this.rootDir, '.float', 'evidence');
        try {
            if (!fs.existsSync(evidenceDir)) {
                fs.mkdirSync(evidenceDir, { recursive: true });
            }

            const timestamp = Date.now();
            const filename = `${type}_${timestamp}.json`;
            const filepath = path.join(evidenceDir, filename);

            fs.writeFileSync(filepath, JSON.stringify({
                timestamp: new Date().toISOString(),
                type,
                data
            }, null, 2));

            this.log(`Evidence dumped: ${filepath}`);

            // Also update "latest" for easy access
            fs.writeFileSync(path.join(evidenceDir, `latest_${type}.json`), JSON.stringify(data, null, 2));

        } catch (error) {
            console.error(pc.red(`⚠️ [VibeDebug] Failed to dump evidence: ${error}`));
        }
    }
}

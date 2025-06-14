import esbuild from 'esbuild';
import alias from 'esbuild-plugin-alias';
import { ESLint } from 'eslint';
import fs from 'fs';
import path from 'path';
import { userscriptHeader } from './src/userscript.meta.js'

const eslintPlugin = {
	name: 'eslint',
	setup({ onStart, onEnd }) {
		onStart(async () => {
			const eslint = new ESLint();
			const results = await eslint.lintFiles(['src/**/*.js']);
			const errors = [];
			const warnings = [];

			for (const result of results) {
				const lines = fs.readFileSync(result.filePath, 'utf8').split('\n');

				for (const message of result.messages) {
					const entry = {
						text: `${message.message} (${message.ruleId})`,
						location: {
							file: result.filePath,
							lineText: lines[message.line - 1] || '',
							line: message.line,
							column: message.column
						},
					};

					if (message.severity === 2) {
						errors.push(entry);
					} else if (message.severity === 1) {
						warnings.push(entry);
					}
				}
			}

			if (errors.length > 0 || warnings.length > 0) {
				return { errors, warnings };
			}
		
			return {};
		});

		onEnd((result) => {
			console.log(`[${(new Date()).toLocaleTimeString()}] Build ended with ${result.errors.length} error(s) and ${result.warnings.length} warning(s)`);
		});
	},
};

const __dirname = import.meta.dirname;
const buildOptions = {
	entryPoints: [ 'src/main.js' ],
	outfile: 'dist/code.user.js',
	bundle: true,
	format: 'iife',
	target: [ 'es2022' ],
	loader: { '.css': 'text' },
	banner: { js: userscriptHeader },
	plugins: [
		eslintPlugin,
		alias({
			'@components': path.resolve(__dirname, 'src/components'),
			'@core': path.resolve(__dirname, 'src/core'),
			'@cs2': path.resolve(__dirname, 'src/cs2'),
			'@css': path.resolve(__dirname, 'src/css'),
			'@utils': path.resolve(__dirname, 'src/utils'),
  		})
	]
};

if (process.argv.includes('--watch')) {
	console.log("Watching...");
	const ctx = await esbuild.context(buildOptions);
	await ctx.watch();
} else {
	console.log("Building...");
	await esbuild.build(buildOptions);
}

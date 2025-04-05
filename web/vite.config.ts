import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
/* import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator';

const defaultObfuscatorConfig = {
  excludes: [],
  enable: true,
  log: true,
  autoExcludeNodeModules: false,
  threadPool: false,
  options: {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    deadCodeInjection: false,
    debugProtection: true,
    debugProtectionInterval: 0,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    //Disable this if axios not working
    splitStrings: true,
    stringArray: true,
    //Disable this if axios not working
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 1,
    stringArrayEncoding: ['rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false,
  }
}; */
/* vitePluginBundleObfuscator(defaultObfuscatorConfig) */

// https://vite.dev/config/
export default defineConfig({
  //@ts-ignore
  plugins: [react()],
  assetsInclude: ['**/*.svg'],
  resolve: {
    alias: {
      '@images': '/resources/web/images', // Shortcut for images directory
    },
  },
  build: {
    outDir: '../../web/',
    assetsInlineLimit: 0, // Forces all assets, including SVGs, to be output as separate files
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]', // Clean output paths for assets
      },
    },
  },
  base: './',
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler', // or "modern", "legacy"
      },
    },
  },
})

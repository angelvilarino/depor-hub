const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*'] },
  // TypeScript ya verifica la resolución de módulos (TS2307). En este monorepo el resolver de
  // import/no-unresolved no encuentra paquetes que sí están instalados.
  { rules: { 'import/no-unresolved': 'off' } },
]);

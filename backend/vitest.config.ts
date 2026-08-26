import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    // Ejecuta los tests en serie: comparten la misma base de datos de test
    // y crean/limpian datos entre ellos.
    fileParallelism: false,
  },
});

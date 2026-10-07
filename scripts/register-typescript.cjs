const fs = require('node:fs');
const Module = require('node:module');
const { transformSync } = require('esbuild');
const load = Module._load;
Module._load = function(request, parent, main) {
  if (request === 'tsx/cjs') return {};
  return load.call(this, request, parent, main);
};
require.extensions['.ts'] = (module, filename) => module._compile(transformSync(
  fs.readFileSync(filename, 'utf8'),
  { loader: 'ts', format: 'cjs', target: 'es2020', sourcefile: filename }
).code, filename);

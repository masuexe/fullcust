// node:test runs registered tests automatically, with failures setting the exit code.
// Load suites in one process so the TypeScript require hook is shared explicitly.
const fs = require("node:fs");
const path = require("node:path");

for (const file of fs.readdirSync(__dirname).filter(file => file.endsWith(".test.cjs")).sort()) {
    require(path.join(__dirname, file));
}

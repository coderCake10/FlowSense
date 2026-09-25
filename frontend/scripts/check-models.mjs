// Checks that every building model the kiosk needs is installed, and that the
// Draco decoder the compressed models need is served by the app.
// See docs/setup/building-models.md.
//
//   npm run models:check                       # checks client/public/models
//   FLOWSENSE_MODELS_DIR=/path npm run models:check
import {
  existsSync,
  openSync,
  readSync,
  closeSync,
  statSync,
  readFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = join(root, "client/src/data/models.ts");
const dir = resolve(
  process.env.FLOWSENSE_MODELS_DIR ?? join(root, "client/public/models")
);

// MODEL_FILES in models.ts is the single list of required files.
const block = readFileSync(registry, "utf8").match(
  /MODEL_FILES\s*=\s*{([^}]*)}/
);
const files = [...(block?.[1] ?? "").matchAll(/"([^"]+\.glb)"/g)].map(
  m => m[1]
);
if (!files.length) {
  console.error(`No model files found in MODEL_FILES (${registry}).`);
  process.exit(2);
}

/** A binary glTF starts with the ASCII magic "glTF" and version 2. */
function glbHeader(path) {
  const fd = openSync(path, "r");
  const header = Buffer.alloc(12);
  readSync(fd, header, 0, 12, 0);
  closeSync(fd);
  return {
    magic: header.toString("ascii", 0, 4),
    version: header.readUInt32LE(4),
    length: header.readUInt32LE(8),
  };
}

console.log(`Models folder: ${dir}\n`);
let problems = 0;
for (const file of files) {
  const path = join(dir, file);
  if (!existsSync(path)) {
    console.log(`  MISSING  ${file}`);
    problems++;
    continue;
  }
  const size = statSync(path).size;
  const { magic, version, length } = glbHeader(path);
  if (magic !== "glTF" || version !== 2) {
    console.log(
      `  INVALID  ${file} (not a binary glTF 2.0 file; is it a .gltf, a Git LFS pointer, or a failed download?)`
    );
    problems++;
  } else if (length !== size) {
    console.log(
      `  INVALID  ${file} (truncated: header says ${length} bytes, file is ${size})`
    );
    problems++;
  } else {
    console.log(`  OK       ${file} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  }
}
// Compressed models need the decoder in client/public/draco (see models.ts).
const draco = join(root, "client/public/draco");
for (const file of ["draco_wasm_wrapper.js", "draco_decoder.wasm"]) {
  if (!existsSync(join(draco, file))) {
    console.log(`  MISSING  Draco decoder draco/${file}`);
    problems++;
  }
}
console.log(
  problems
    ? `\n${problems} problem(s) need attention. See docs/setup/building-models.md.`
    : `\nAll ${files.length} models and the Draco decoder are installed.`
);
process.exit(problems ? 1 : 0);

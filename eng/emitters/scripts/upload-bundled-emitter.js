// @ts-check
import { resolve } from "path";
import { bundleAndUploadStandalonePackage } from "../../../packages/bundle-uploader/dist/src/index.js";
import { repoRoot } from "../../common/scripts/helpers.js";

const packageRelativePath = process.argv[2];
if (!packageRelativePath) {
  console.error("Usage: node upload-bundled-emitter.js <package-path>");
  console.error("  e.g. node upload-bundled-emitter.js packages/http-client-csharp");
  process.exit(1);
}

// Strip leading "/" so resolve() doesn't treat it as an absolute path.
// Pipeline PackagePath values start with "/" (e.g. "/packages/http-client-csharp").
const packagePath = resolve(repoRoot, packageRelativePath.replace(/^\//, ""));

await bundleAndUploadStandalonePackage({ packagePath });

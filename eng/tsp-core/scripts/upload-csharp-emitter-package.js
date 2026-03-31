// @ts-check
// Standalone script to bundle and upload the http-client-csharp emitter
// to the playground package storage. Run from an ADO pipeline after
// building the emitter.
//
// This is separate from the core upload-bundler-packages.js because
// http-client-csharp is not in the pnpm workspace.

import { AzureCliCredential } from "@azure/identity";
import { createTypeSpecBundle } from "@typespec/bundler";
import { resolve } from "path";
import { join as joinUnix } from "path/posix";
import { repoRoot } from "../../common/scripts/helpers.js";

const credential = new AzureCliCredential();

// Dynamically import the uploader (it's in the bundle-uploader package which must be built first)
const { TypeSpecBundledPackageUploader } = await import(
  "../../../packages/bundle-uploader/dist/src/upload-browser-package.js"
);
const { getPackageVersion } = await import(
  "../../../packages/bundle-uploader/dist/src/index.js"
);

const packagePath = resolve(repoRoot, "packages/http-client-csharp");
const indexName = "typespec";
const indexVersion = await getPackageVersion(repoRoot, "@typespec/compiler");

console.log(`Bundling http-client-csharp emitter from: ${packagePath}`);
console.log(`Index version: ${indexVersion}`);

const bundle = await createTypeSpecBundle(packagePath);
const manifest = bundle.manifest;

const uploader = new TypeSpecBundledPackageUploader(credential);
await uploader.createIfNotExists();

const result = await uploader.upload(bundle);
if (result.status === "uploaded") {
  console.log(`✔ Bundle for ${manifest.name}@${manifest.version} uploaded.`);
} else {
  console.log(`Bundle for ${manifest.name} already exists for version ${manifest.version}.`);
}

// Update the index with the new import map entries
const existingIndex = await uploader.getIndex(indexName, indexVersion);
const importMap = { ...existingIndex?.imports };
for (const [key, value] of Object.entries(result.imports)) {
  importMap[joinUnix(manifest.name, key)] = value;
}

await uploader.updateIndex(indexName, {
  version: indexVersion,
  imports: importMap,
});
console.log(`✔ Updated index for version ${indexVersion}.`);

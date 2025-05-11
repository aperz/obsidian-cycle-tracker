import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.argv[2];
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

// Check if versions.json exists, create it if it doesn't
let versions = {};
try {
    versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch (error) {
    console.log("versions.json not found, creating a new one");
}

if (targetVersion) {
    // Update manifest version
    manifest.version = targetVersion;
    writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));

    // Update versions.json
    versions[targetVersion] = manifest.minAppVersion;
    writeFileSync("versions.json", JSON.stringify(versions, null, 2));

    console.log(`Version updated to ${targetVersion}`);
} else {
    console.error("No target version provided");
    process.exit(1);
}

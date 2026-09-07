const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const REQUIRED_FILES = [
  "model.onnx",
  "config.json",
  "voices/mf_asha.bin",
  "voices/mf_mukta.bin",
  "voices/af_heart.bin",
  "voices/af_nova.bin",
  "voices/mm_vivek.bin",
];

module.exports = function withTtsAssets(config) {
  return withDangerousMod(config, ["android", async (nextConfig) => {
    const source = path.join(
      nextConfig.modRequest.projectRoot,
      "assets",
      "tts",
    );
    const destination = path.join(
      nextConfig.modRequest.platformProjectRoot,
      "app",
      "src",
      "main",
      "assets",
      "assets",
      "tts",
    );

    for (const relativePath of REQUIRED_FILES) {
      const filePath = path.join(source, relativePath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        throw new Error(
          "Missing or empty TTS asset: " + relativePath,
        );
      }
    }

    fs.rmSync(destination, { recursive: true, force: true });
    fs.mkdirSync(destination, { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
    console.log("Embedded TTS assets in " + destination);

    return nextConfig;
  }]);
};

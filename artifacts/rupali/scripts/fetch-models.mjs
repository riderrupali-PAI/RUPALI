import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;

const ttsDir = join(root, "assets", "tts");
const voicesDir = join(ttsDir, "voices");

const modelBase =
  "https://huggingface.co/shreyask/bol-tts-marathi-onnx/resolve/main";

const voices = [
  "mf_asha",
  "mf_mukta",
  "af_heart",
  "af_nova",
  "mm_vivek"
];

await mkdir(voicesDir, {
  recursive: true
});

async function download(url, destination) {
  console.log(`Downloading: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Download failed with status ${response.status}: ${url}`
    );
  }

  const data = Buffer.from(
    await response.arrayBuffer()
  );

  await writeFile(destination, data);

  console.log(`Saved: ${destination}`);
}

await download(
  `${modelBase}/onnx/model.onnx?download=true`,
  join(ttsDir, "model.onnx")
);

await download(
  `${modelBase}/config.json?download=true`,
  join(ttsDir, "config.json")
);

await download(
  `${modelBase}/voice_speeds.json?download=true`,
  join(ttsDir, "voice_speeds.json")
);

for (const voice of voices) {
  const ptPath = join(
    voicesDir,
    `${voice}.pt`
  );

  const binPath = join(
    voicesDir,
    `${voice}.bin`
  );

  await download(
    `${modelBase}/voices/${voice}.pt?download=true`,
    ptPath
  );

  const pythonArguments = [
    "-c",
    [
      "import sys",
      "import torch",
      "import pathlib",
      "import struct",

      "tensor = torch.load(sys.argv[1], map_location='cpu', weights_only=True)",

      "tensor = tensor.detach().contiguous().view(-1).float().tolist()",

      "payload = struct.pack('<' + 'f' * len(tensor), *tensor)",

      "pathlib.Path(sys.argv[2]).write_bytes(payload)"
    ].join("; "),
    ptPath,
    binPath
  ];

  console.log(
    `Converting ${voice}.pt to ${voice}.bin`
  );

  execFileSync(
    "python",
    pythonArguments,
    {
      stdio: "inherit"
    }
  );

  await readFile(binPath);

  // Androidमध्ये .bin file वापरली जाते.
  // .pt fileची गरज नसल्यामुळे ती रिकामी केली जाते.
  await writeFile(ptPath, "");

  console.log(`Converted: ${voice}`);
}

console.log(
  `Downloaded model and ${voices.length} voicepacks to ${ttsDir}`
);
\nconst pluginsDir = join(root, "plugins");\nconst pluginPath = join(pluginsDir, "withTtsAssets.js");\n\nawait mkdir(pluginsDir, { recursive: true });\nawait writeFile(pluginPath, "const fs = require(\"fs\");\\nconst path = require(\"path\");\\nconst { withDangerousMod } = require(\"@expo/config-plugins\");\\n\\nmodule.exports = function withTtsAssets(config) {\\n  return withDangerousMod(config, [\"android\", async (config) => {\\n    const source = path.join(config.modRequest.projectRoot, \"assets\", \"tts\");\\n    const destination = path.join(\\n      config.modRequest.platformProjectRoot,\\n      \"app\", \"src\", \"main\", \"assets\", \"assets\", \"tts\",\\n    );\\n\\n    const requiredFiles = [\\n      \"model.onnx\",\\n      \"config.json\",\\n      \"voices/mf_asha.bin\",\\n      \"voices/mf_mukta.bin\",\\n      \"voices/af_heart.bin\",\\n      \"voices/af_nova.bin\",\\n      \"voices/mm_vivek.bin\",\\n    ];\\n\\n    for (const relativePath of requiredFiles) {\\n      const filePath = path.join(source, relativePath);\\n      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {\\n        throw new Error(\"Missing or empty TTS asset: \" + relativePath);\\n      }\\n    }\\n\\n    fs.rmSync(destination, { recursive: true, force: true });\\n    fs.mkdirSync(destination, { recursive: true });\\n    fs.cpSync(source, destination, { recursive: true });\\n    console.log(\"Embedded TTS assets in \" + destination);\\n    return config;\\n  }]);\\n};\\n");\n\nconst appJsonPath = join(root, "app.json");\nconst appConfig = JSON.parse(await readFile(appJsonPath, "utf8"));\nconst plugins = appConfig.expo.plugins ?? [];\nif (!plugins.includes("./plugins/withTtsAssets")) {\n  plugins.push("./plugins/withTtsAssets");\n  appConfig.expo.plugins = plugins;\n  await writeFile(appJsonPath, JSON.stringify(appConfig, null, 2) + "\n");\n}\n
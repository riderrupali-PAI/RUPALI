import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;

const ttsDir = join(root, 'assets', 'tts');
const voicesDir = join(ttsDir, 'voices');

const modelBase =
  'https://huggingface.co/shreyask/bol-tts-marathi-onnx/resolve/main';

const voices = [
  'mf_asha',
  'mf_mukta',
  'af_heart',
  'af_nova',
  'mm_vivek',
];

await mkdir(voicesDir, {
  recursive: true,
});

async function download(url, destination) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Download failed (${response.status}): ${url}`,
    );
  }

  await writeFile(
    destination,
    Buffer.from(
      await response.arrayBuffer(),
    ),
  );
}

await download(
  `${modelBase}/onnx/model.onnx?download=true`,
  join(ttsDir, 'model.onnx'),
);

await download(
  `${modelBase}/config.json?download=true`,
  join(ttsDir, 'config.json'),
);

await download(
  `${modelBase}/voice_speeds.json?download=true`,
  join(ttsDir, 'voice_speeds.json'),
);

for (const voice of voices) {
  const ptPath = join(
    voicesDir,
    `${voice}.pt`,
  );

  await download(
    `${modelBase}/voices/${voice}.pt?download=true`,
    ptPath,
  );

  const binPath = join(
    voicesDir,
    `${voice}.bin`,
  );

  const python = [
    '-c',
    [
      'import sys, torch, pathlib, struct',
      'tensor = torch.load(sys.argv[1], map_location="cpu", weights_only=True)',
      'tensor = tensor.detach().contiguous().view(-1).float().numpy().tolist()',
      'pathlib.Path(sys.argv[2]).write_bytes(struct.pack("<" + "f" * len(tensor), *tensor))',
    ].join('; '),
    ptPath,
    binPath,
  ];

  execFileSync(
    'python',
    python,
    {
      stdio: 'inherit',
    },
  );

  await readFile(binPath);

  await writeFile(ptPath, '');
}

console.log(
  `Downloaded model and ${voices.length} voicepacks to ${ttsDir}`,
);

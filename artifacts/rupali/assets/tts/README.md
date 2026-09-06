# RUPALI offline voice assets

The ONNX model is intentionally not committed to git because it is about 326 MB.

Before building Android, run:

pnpm --filter @workspace/rupali run fetch-models

The build script downloads the Apache 2.0
shreyask/bol-tts-marathi-onnx model and converts the five selected
.pt voicepacks to raw float32 .bin files.

Selected voices:

- mf_asha — Asha, Marathi-trained female
- mf_mukta — Mukta, Marathi-trained female
- af_heart — Svara, female crossover
- af_nova — Tara, female crossover
- mm_vivek — Vivek, Marathi-trained male

The model and its training data retain their upstream licenses and attribution.

package expo.modules.vishuofflinetts

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

class VishuOfflineTtsModule : Module() {
  private val executor = Executors.newSingleThreadExecutor()
  private val environment = OrtEnvironment.getEnvironment()

  private var session: OrtSession? = null
  private var vocab: Map<String, Long> = emptyMap()
  private var currentTrack: AudioTrack? = null
  private var running = false

  override fun definition() = ModuleDefinition {
    Name("VishuOfflineTts")

    AsyncFunction("getStatus") {
      mapOf(
        "available" to hasModelAssets(),
        "model" to "bol-tts-marathi-onnx",
        "sampleRate" to 24000,
      )
    }

    AsyncFunction("speak") {
        text: String,
        voiceId: String,
        speed: Double,
      ->
      if (!hasModelAssets()) {
        throw IllegalStateException(
          "ONNX model assets are missing."
        )
      }

      stopPlayback()

      executor.execute {
        try {
          running = true

          val audio = synthesize(
            text = text,
            voiceId = voiceId,
            speed = speed.toFloat(),
          )

          play(audio)
        } catch (_: Exception) {
          running = false
        } finally {
          running = false
        }
      }
    }

    AsyncFunction("stop") {
      stopPlayback()
    }

    OnDestroy {
      stopPlayback()
      executor.shutdownNow()
      session?.close()
      environment.close()
    }
  }

  private fun hasModelAssets(): Boolean {
    return assetExists("assets/tts/model.onnx") &&
      assetExists("assets/tts/config.json")
  }

  private fun synthesize(
    text: String,
    voiceId: String,
    speed: Float,
  ): FloatArray {
    val currentSession = ensureSession()

    val contentIds = phonemize(text)
      .mapNotNull { vocab[it] }
      .take(508)

    if (contentIds.isEmpty()) {
      throw IllegalArgumentException(
        "No Marathi phonemes were recognized"
      )
    }

    val input = LongArray(contentIds.size + 2)

    input[0] = 0L

    contentIds.forEachIndexed { index, value ->
      input[index + 1] = value
    }

    input[input.lastIndex] = 0L

    val style = readVoicepack(
      voiceId = voiceId,
      position = min(contentIds.size, 509),
    )

    val inputTensor = OnnxTensor.createTensor(
      environment,
      arrayOf(input),
    )

    val styleTensor = OnnxTensor.createTensor(
      environment,
      arrayOf(style),
    )

    val speedTensor = OnnxTensor.createTensor(
      environment,
      floatArrayOf(speed),
    )

    val results = currentSession.run(
      mapOf(
        "input_ids" to inputTensor,
        "style" to styleTensor,
        "speed" to speedTensor,
      )
    )

    inputTensor.close()
    styleTensor.close()
    speedTensor.close()

    val rawAudio = results[0].value as Array<*>
    val rawDurations = results[1].value as Array<*>

    val waveform = rawAudio[0] as FloatArray
    val durations = rawDurations[0] as LongArray

    results.close()

    val firstDuration = durations.firstOrNull()?.toInt() ?: 0
    val lastDuration = durations.lastOrNull()?.toInt() ?: 0

    val start = min(
      waveform.size,
      max(0, firstDuration) * 600,
    )

    val endTrim = max(0, lastDuration) * 600

    val end = max(
      start,
      waveform.size - endTrim,
    )

    return waveform.copyOfRange(start, end)
  }

  private fun ensureSession(): OrtSession {
    val existingSession = session

    if (existingSession != null && vocab.isNotEmpty()) {
      return existingSession
    }

    val modelBytes = openAsset(
      "assets/tts/model.onnx"
    ).readBytes()

    session = environment.createSession(modelBytes)

    val configText = openAsset(
      "assets/tts/config.json"
    ).bufferedReader().use {
      it.readText()
    }

    val config = JSONObject(configText)
    val vocabulary = config.getJSONObject("vocab")
    val map = mutableMapOf<String, Long>()

    vocabulary.keys().forEach { key ->
      map[key] = vocabulary.getLong(key)
    }

    vocab = map

    return requireNotNull(session)
  }

  private fun readVoicepack(
    voiceId: String,
    position: Int,
  ): FloatArray {
    val file = openAsset(
      "assets/tts/voices/$voiceId.bin"
    )

    val bytes = file.readBytes()

    if (bytes.isEmpty()) {
      throw IllegalStateException(
        "Voicepack is empty: $voiceId"
      )
    }

    val buffer = ByteBuffer
      .wrap(bytes)
      .order(ByteOrder.LITTLE_ENDIAN)

    val values = FloatArray(bytes.size / 4)

    for (index in values.indices) {
      values[index] = buffer.float
    }

    val vectorSize = 256
    val maxOffset = max(0, values.size - vectorSize)
    val requestedOffset = position * vectorSize
    val offset = min(requestedOffset, maxOffset)

    return values.copyOfRange(
      offset,
      offset + vectorSize,
    )
  }

  private fun play(audio: FloatArray) {
    if (audio.isEmpty()) {
      return
    }

    val minBufferSize = AudioTrack.getMinBufferSize(
      24000,
      AudioFormat.CHANNEL_OUT_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )

    val track = AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(
            AudioAttributes.CONTENT_TYPE_SPEECH
          )
          .build()
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setSampleRate(24000)
          .setEncoding(
            AudioFormat.ENCODING_PCM_16BIT
          )
          .setChannelMask(
            AudioFormat.CHANNEL_OUT_MONO
          )
          .build()
      )
      .setBufferSizeInBytes(
        max(minBufferSize, 8192)
      )
      .setTransferMode(
        AudioTrack.MODE_STREAM
      )
      .build()

    currentTrack = track

    val pcm = ShortArray(audio.size)

    audio.forEachIndexed { index, sample ->
      val safeSample = sample.coerceIn(-1f, 1f)

      pcm[index] = (
        safeSample * Short.MAX_VALUE
      ).toInt().toShort()
    }

    try {
      track.play()

      var cursor = 0

      while (cursor < pcm.size && running) {
        val written = track.write(
          pcm,
          cursor,
          min(4096, pcm.size - cursor),
        )

        if (written <= 0) {
          break
        }

        cursor += written
      }

      if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
        track.stop()
      }
    } finally {
      track.release()
      currentTrack = null
    }
  }

  private fun stopPlayback() {
    running = false

    currentTrack?.let { track ->
      try {
        track.pause()
        track.flush()
        track.release()
      } catch (_: Exception) {
        // AudioTrack may already be released.
      }
    }

    currentTrack = null
  }

  private fun phonemize(text: String): List<String> {
    val output = mutableListOf<String>()
    var suppressInherent = false

    text.forEach { char ->
      when (char) {
        'अ' -> output += "a"
        'आ' -> output += "aː"
        'इ' -> output += "i"
        'ई' -> output += "iː"
        'उ' -> output += "u"
        'ऊ' -> output += "uː"
        'ए' -> output += "eː"
        'ऐ' -> output += "ɛː"
        'ओ' -> output += "oː"
        'औ' -> output += "ɔː"
        'ऋ' -> output += "ɾi"

        'क' -> output += "k"
        'ख' -> output += "kʰ"
        'ग' -> output += "g"
        'घ' -> output += "gʰ"
        'ङ' -> output += "ŋ"

        'च' -> output += "t͡ʃ"
        'छ' -> output += "t͡ʃʰ"
        'ज' -> output += "d͡ʒ"
        'झ' -> output += "d͡ʒʰ"

        'ट' -> output += "ʈ"
        'ठ' -> output += "ʈʰ"
        'ड' -> output += "ɖ"
        'ढ' -> output += "ɖʰ"
        'ण' -> output += "ɳ"

        'त' -> output += "t"
        'थ' -> output += "tʰ"
        'द' -> output += "d"
        'ध' -> output += "dʰ"
        'न' -> output += "n"

        'प' -> output += "p"
        'फ' -> output += "pʰ"
        'ब' -> output += "b"
        'भ' -> output += "bʰ"
        'म' -> output += "m"

        'य' -> output += "j"
        'र' -> output += "ɾ"
        'ल' -> output += "l"
        'ळ' -> output += "ɭ"
        'व' -> output += "ʋ"

        'श' -> output += "ʃ"
        'ष' -> output += "ʂ"
        'स' -> output += "s"
        'ह' -> output += "h"

        'ा' -> output += "aː"
        'ि' -> output += "i"
        'ी' -> output += "iː"
        'ु' -> output += "u"
        'ू' -> output += "uː"
        'े' -> output += "eː"
        'ै' -> output += "ɛː"
        'ो' -> output += "oː"
        'ौ' -> output += "ɔː"
        'ृ' -> output += "i"

        'ं', 'ँ' -> output += "̃"
        'ः' -> output += "h"
        '्' -> suppressInherent = true

        ' ', '\n', '\t' -> output += " "
        '.', ',', '!', '?', '।' -> output += char.toString()

        else -> {
          if (char.isLetter()) {
            output += char.lowercaseChar().toString()
          }
        }
      }

      val consonants =
        "कखगघङचछजझटठडढणतथदधनपफबभमयरलळवशषसह"

      if (
        char in consonants &&
        !suppressInherent
      ) {
        output += "a"
      }

      if (char != '्') {
        suppressInherent = false
      }
    }

    return output
  }

  private fun assetExists(path: String): Boolean {
    return try {
      openAsset(path).close()
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun openAsset(path: String) =
    requireNotNull(appContext.reactContext)
      .assets
      .open(path)
}

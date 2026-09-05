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

    AsyncFunction(
      "speak"
    ) { text: String, voiceId: String, speed: Double ->
      if (!hasModelAssets()) {
        throw IllegalStateException(
          "ONNX model assets are missing. Run scripts/fetch-models.mjs before building."
        )
      }

      stopPlayback()

      executor.execute {
        try {
          running = true

          val audio = synthesize(
            text,
            voiceId,
            speed.toFloat()
          )

          play(audio)
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
      voiceId,
      min(contentIds.size, 509)
    )

    val inputTensor = OnnxTensor.createTensor(
      environment,
      arrayOf(input)
    )

    val styleTensor = OnnxTensor.createTensor(
      environment,
      arrayOf(style)
    )

    val speedTensor = OnnxTensor.createTensor( **…**

_This response is too long to display in full._

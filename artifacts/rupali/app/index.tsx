import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import {
  isNativeTtsAvailable,
  speakMarathi,
  stopMarathi,
  type VoiceId,
} from '@/modules/vishu-offline-tts';

type Voice = {
  id: VoiceId;
  name: string;
  devanagari: string;
  gender: 'स्त्री' | 'पुरुष';
  detail: string;
  color: string;
};

const VOICES: Voice[] = [
  {
    id: 'mf_asha',
    name: 'Asha',
    devanagari: 'आशा',
    gender: 'स्त्री',
    detail: 'Marathi trained',
    color: colors.light.warm,
  },
  {
    id: 'mf_mukta',
    name: 'Mukta',
    devanagari: 'मुक्ता',
    gender: 'स्त्री',
    detail: 'हळुवार आणि निवांत',
    color: colors.light.sage,
  },
  {
    id: 'af_heart',
    name: 'Svara',
    devanagari: 'स्वरा',
    gender: 'स्त्री',
    detail: 'उबदार crossover',
    color: colors.light.lavender,
  },
  {
    id: 'af_nova',
    name: 'Tara',
    devanagari: 'तारा',
    gender: 'स्त्री',
    detail: 'स्वच्छ आणि प्रसन्न',
    color: colors.light.warmSoft,
  },
  {
    id: 'mm_vivek',
    name: 'Vivek',
    devanagari: 'विवेक',
    gender: 'पुरुष',
    detail: 'Marathi trained',
    color: colors.light.sage,
  },
];

const SAMPLE_PHRASES = [
  'नमस्कार, मी रुपाली आहे.',
  'आजचा दिवस सुंदर जावो.',
  'चला, मराठीमध्ये बोलूया.',
];

const STORAGE_KEY = 'rupali-preferences-v1';
const DEFAULT_TEXT = 'नमस्कार, मी रुपाली आहे. चला, मराठीमध्ये बोलूया.';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [voiceId, setVoiceId] = useState<VoiceId>('mf_asha');
  const [speed, setSpeed] = useState<number>(1);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const selectedVoice = useMemo(
    () => VOICES.find((voice) => voice.id === voiceId) ?? VOICES[0],
    [voiceId],
  );

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!mounted || !stored) return;

        const preferences = JSON.parse(stored) as {
          text?: string;
          voiceId?: VoiceId;
          speed?: number;
        };

        if (preferences.text) {
          setText(preferences.text);
        }

        if (
          preferences.voiceId &&
          VOICES.some((voice) => voice.id === preferences.voiceId)
        ) {
          setVoiceId(preferences.voiceId);
        }

        if (
          preferences.speed &&
          [0.8, 1, 1.2].includes(preferences.speed)
        ) {
          setSpeed(preferences.speed);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setIsRestoring(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const persistPreferences = async (
    nextText: string,
    nextVoice: VoiceId,
    nextSpeed: number,
  ) => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        text: nextText,
        voiceId: nextVoice,
        speed: nextSpeed,
      }),
    );
  };

  const handleSpeak = async () => {
    Keyboard.dismiss();

    if (!text.trim()) {
      setError('कृपया आधी काहीतरी लिहा.');
      return;
    }

    setError('');
    await Haptics.selectionAsync();

    await persistPreferences(text, voiceId, speed);

    if (!isNativeTtsAvailable()) {
      setError('ऑफलाइन आवाजासाठी Android release build install करा.');
      return;
    }

    setIsSpeaking(true);

    try {
      await speakMarathi(text.trim(), voiceId, speed);
    } catch {
      setError('आवाज तयार करता आला नाही. model files तपासा.');
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleStop = async () => {
    await stopMarathi();
    setIsSpeaking(false);
  };

  const chooseVoice = async (nextVoice: VoiceId) => {
    await Haptics.selectionAsync();
    setVoiceId(nextVoice);
    await persistPreferences(text, nextVoice, speed);
  };

  const chooseSpeed = async (nextSpeed: number) => {
    await Haptics.selectionAsync();
    setSpeed(nextSpeed);
    await persistPreferences(text, voiceId, nextSpeed);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Feather
                name="volume-2"
                size={17}
                color={colors.light.ink}
              />
            </View>

            <Text style={styles.brand}>RUPALI</Text>

            <View style={styles.offlineBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.offlineText}>OFFLINE</Text>
            </View>
          </View>

          <Text style={styles.title}>मराठी बोलूया.</Text>

          <Text style={styles.subtitle}>
            तुझं वाक्य निवडलेल्या आवाजात, थेट phone वर.
          </Text>
        </View>

        <View style={styles.modelCard}>
          <View style={styles.modelIcon}>
            <Feather
              name="cpu"
              size={18}
              color={colors.light.sage}
            />
          </View>

          <View style={styles.modelCopy}>
            <Text style={styles.modelTitle}>
              Bol Marathi · Kokoro ONNX
            </Text>

            <Text style={styles.modelSub}>
              २४ kHz natural voices · internet लागत नाही
            </Text>
          </View>

          <View style={styles.readyPill}>
            <Text style={styles.readyText}>READY</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionLabel}>
            तुला काय बोलायचं आहे?
          </Text>

          <Text style={styles.characterCount}>
            {text.length}/500
          </Text>
        </View>

        <View style={styles.inputCard}>
          <TextInput
            value={text}
            onChangeText={(nextText) => {
              setText(nextText.slice(0, 500));
              setError('');
            }}
            multiline
            maxLength={500}
            placeholder="इथे मराठी लिहा..."
            placeholderTextColor={colors.light.mutedForeground}
            style={styles.textInput}
            textAlignVertical="top"
            testID="marathi-text-input"
          />

          <View style={styles.inputFooter}>
            <Text style={styles.inputHint}>
              देवनागरी मजकूर जास्त नैसर्गिक ऐकू येतो.
            </Text>

            {text.length > 0 ? (
              <Pressable
                onPress={() => setText('')}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.pressed,
                ]}
                testID="clear-text-button"
              >
                <Feather
                  name="x"
                  size={15}
                  color={colors.light.mutedForeground}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.samplesRow}
        >
          {SAMPLE_PHRASES.map((phrase) => (
            <Pressable
              key={phrase}
              onPress={() => setText(phrase)}
              style={({ pressed }) => [
                styles.sampleChip,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.sampleText}>{phrase}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionLabel}>आवाज निवड</Text>

          <Text style={styles.voiceCount}>
            {VOICES.length} आवाज
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.voicesRow}
        >
          {VOICES.map((voice) => {
            const selected = voice.id === selectedVoice.id;

            return (
              <Pressable
                key={voice.id}
                onPress={() => chooseVoice(voice.id)}
                style={({ pressed }) => [
                  styles.voiceCard,
                  selected && {
                    borderColor: voice.color,
                    backgroundColor: `${voice.color}18`,
                  },
                  pressed && styles.pressed,
                ]}
                testID={`voice-${voice.id}`}
              >
                <View
                  style={[
                    styles.voiceOrb,
                    { backgroundColor: `${voice.color}22` },
                  ]}
                >
                  <Text
                    style={[
                      styles.voiceInitial,
                      { color: voice.color },
                    ]}
                  >
                    {voice.devanagari.slice(0, 1)}
                  </Text>
                </View>

                <Text style={styles.voiceName}>
                  {voice.devanagari}
                </Text>

                <Text style={styles.voiceMeta}>
                  {voice.gender}
                </Text>

                {selected ? (
                  <View
                    style={[
                      styles.checkMark,
                      { backgroundColor: voice.color },
                    ]}
                  >
                    <Feather
                      name="check"
                      size={11}
                      color={colors.light.ink}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.controlRow}>
          <View>
            <Text style={styles.sectionLabel}>गती</Text>

            <Text style={styles.controlHint}>
              आवाजाचा pace
            </Text>
          </View>

          <View style={styles.speedControl}>
            {[0.8, 1, 1.2].map((option) => (
              <Pressable
                key={option}
                onPress={() => chooseSpeed(option)}
                style={({ pressed }) => [
                  styles.speedButton,
                  speed === option && styles.speedButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.speedText,
                    speed === option && styles.speedTextActive,
                  ]}
                >
                  {option === 1
                    ? 'सामान्य'
                    : option === 0.8
                      ? 'हळू'
                      : 'जलद'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather
              name="info"
              size={16}
              color={colors.light.destructive}
            />

            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={isSpeaking ? handleStop : handleSpeak}
          disabled={isRestoring}
          style={({ pressed }) => [
            styles.speakButton,
            isSpeaking && styles.stopButton,
            isRestoring && styles.disabledButton,
            pressed && styles.pressed,
          ]}
          testID="speak-button"
        >
          {isRestoring ? (
            <ActivityIndicator
              color={colors.light.primaryForeground}
            />
          ) : (
            <>
              <View style={styles.speakIcon}>
                <Feather
                  name={isSpeaking ? 'square' : 'play'}
                  size={18}
                  color={colors.light.primaryForeground}
                  fill={colors.light.primaryForeground}
                />
              </View>

              <Text style={styles.speakText}>
                {isSpeaking ? 'थांबवा' : 'ऐकवून दाखव'}
              </Text>

              <Text style={styles.speakVoice}>
                {selectedVoice.devanagari}
              </Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footerNote}>
          आवाज phone वरच तयार होतो · तुझा मजकूर कुठेही पाठवला जात नाही
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: {
    marginBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 18,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.warm,
  },
  brand: {
    color: colors.light.foreground,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.light.muted,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light.sage,
  },
  offlineText: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.light.foreground,
    fontSize: 39,
    lineHeight: 45,
    fontWeight: '700',
    letterSpacing: -1.4,
  },
  subtitle: {
    color: colors.light.mutedForeground,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 7,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 17,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 26,
  },
  modelIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.light.sage}18`,
  },
  modelCopy: {
    flex: 1,
    marginLeft: 11,
  },
  modelTitle: {
    color: colors.light.cardForeground,
    fontSize: 13,
    fontWeight: '600',
  },
  modelSub: {
    color: colors.light.mutedForeground,
    fontSize: 11,
    marginTop: 3,
  },
  readyPill: {
    backgroundColor: `${colors.light.sage}1F`,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  readyText: {
    color: colors.light.sage,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    color: colors.light.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  characterCount: {
    color: colors.light.mutedForeground,
    fontSize: 11,
  },
  inputCard: {
    minHeight: 146,
    padding: 15,
    borderRadius: 18,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  textInput: {
    flex: 1,
    minHeight: 92,
    color: colors.light.foreground,
    fontSize: 17,
    lineHeight: 26,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  inputHint: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  clearButton: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.secondary,
  },
  samplesRow: {
    gap: 8,
    paddingVertical: 13,
    paddingRight: 20,
  },
  sampleChip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.light.muted,
  },
  sampleText: {
    color: colors.light.mutedForeground,
    fontSize: 11,
  },
  voiceCount: {
    color: colors.light.sage,
    fontSize: 11,
    fontWeight: '600',
  },
  voicesRow: {
    gap: 10,
    paddingBottom: 24,
    paddingRight: 20,
  },
  voiceCard: {
    width: 91,
    minHeight: 113,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  voiceOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  voiceInitial: {
    fontSize: 19,
    fontWeight: '600',
  },
  voiceName: {
    color: colors.light.foreground,
    fontSize: 13,
    fontWeight: '600',
  },
  voiceMeta: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    marginTop: 3,
  },
  checkMark: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 17,
  },
  controlHint: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    marginTop: 3,
  },
  speedControl: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 11,
    backgroundColor: colors.light.muted,
  },
  speedButton: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 8,
  },
  speedButtonActive: {
    backgroundColor: colors.light.secondary,
  },
  speedText: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    fontWeight: '600',
  },
  speedTextActive: {
    color: colors.light.foreground,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: `${colors.light.destructive}14`,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: colors.light.destructive,
    fontSize: 12,
    lineHeight: 17,
  },
  speakButton: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    borderRadius: 18,
    backgroundColor: colors.light.primary,
  },
  stopButton: {
    backgroundColor: colors.light.destructive,
  },
  disabledButton: {
    opacity: 0.7,
  },
  speakIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.light.primaryForeground}18`,
  },
  speakText: {
    color: colors.light.primaryForeground,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 11,
  },
  speakVoice: {
    color: `${colors.light.primaryForeground}B8`,
    fontSize: 12,
    marginLeft: 'auto',
  },
  footerNote: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 14,
  },
  pressed: {
    opacity: 0.76,
  },
});

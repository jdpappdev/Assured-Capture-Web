import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface VoiceTranscriberProps {
  currentText: string;
  onTranscript: (newText: string) => void;
  disabled?: boolean;
}

type TranscriptionState = 'ready' | 'listening' | 'processing' | 'error';

// Declare SpeechRecognition interfaces for TypeScript
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResultItem;
    isFinal: boolean;
  };
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

export const VoiceTranscriber: React.FC<VoiceTranscriberProps> = ({
  currentText,
  onTranscript,
  disabled = false,
}) => {
  const [state, setState] = useState<TranscriptionState>('ready');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    // Check Web Speech Recognition support
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setErrorMessage(
        'Speech recognition is not natively supported by this browser. Manual typing is available.'
      );
      return;
    }

    try {
      const recognition: ISpeechRecognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setState('listening');
        setErrorMessage('');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let finalized = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalized += res[0].transcript + ' ';
          } else {
            interim += res[0].transcript;
          }
        }

        setInterimText(interim);

        if (finalized.trim()) {
          const trimmed = finalized.trim();
          const combined = currentText ? `${currentText.trim()} ${trimmed}` : trimmed;
          onTranscript(combined);
          setInterimText('');
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMessage('Microphone access was denied. Please allow microphone permissions in browser settings.');
        } else if (event.error === 'no-speech') {
          // No speech detected, keep ready
          return;
        } else {
          setErrorMessage(`Speech recognition error: ${event.error}`);
        }
        setState('error');
      };

      recognition.onend = () => {
        if (state === 'listening') {
          setState('ready');
        }
      };

      recognitionRef.current = recognition;
    } catch (e: any) {
      console.error('Speech recognition initialization error:', e);
      setIsSupported(false);
      setErrorMessage('Could not initialize microphone speech engine.');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [currentText, onTranscript]);

  const toggleRecording = async () => {
    if (!recognitionRef.current) {
      // If Web Speech is unsupported, alert user
      setErrorMessage('Speech recognition is unavailable on this browser. Please type the description above.');
      setState('error');
      return;
    }

    if (state === 'listening') {
      try {
        setState('processing');
        recognitionRef.current.stop();
        setTimeout(() => setState('ready'), 400);
      } catch (err) {
        console.warn(err);
        setState('ready');
      }
      return;
    }

    // Request permissions explicitly via getUserMedia if supported for robust permission prompt
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release immediate test stream
        stream.getTracks().forEach((track) => track.stop());
      }
      setErrorMessage('');
      recognitionRef.current.start();
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      setErrorMessage(
        'Microphone permission is required to transcribe speech. Please allow microphone access.'
      );
      setState('error');
    }
  };

  const retryVoice = () => {
    setState('ready');
    setErrorMessage('');
  };

  return (
    <div className="w-full space-y-3" id="voice-transcription-container">
      {/* Primary Outdoor Voice Button */}
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled}
        id="describe-by-voice-btn"
        className={`w-full min-h-[60px] px-6 py-4 rounded-xl font-bold text-lg tracking-wide transition-all shadow-md flex items-center justify-center gap-3 border-2 select-none active:scale-[0.99] ${
          state === 'listening'
            ? 'bg-red-600 text-white border-red-700 ring-4 ring-red-200 animate-pulse'
            : state === 'processing'
            ? 'bg-amber-600 text-white border-amber-700'
            : 'bg-stone-900 text-white border-stone-950 hover:bg-stone-800'
        }`}
      >
        {state === 'listening' ? (
          <>
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-white opacity-75"></span>
              <Mic className="w-7 h-7 relative z-10 text-white" />
            </div>
            <span>Listening... Tap to Stop</span>
          </>
        ) : state === 'processing' ? (
          <>
            <RefreshCw className="w-6 h-6 animate-spin text-white" />
            <span>Processing Voice...</span>
          </>
        ) : (
          <>
            <Mic className="w-7 h-7 text-amber-400" />
            <span>Describe by Voice 🎤</span>
          </>
        )}
      </button>

      {/* Real-time State & Status Feedback */}
      <div className="flex items-center justify-between px-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-stone-500 uppercase tracking-wider text-xs">
            Voice State:
          </span>
          {state === 'ready' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-200 text-stone-700">
              <span className="w-2 h-2 rounded-full bg-stone-500" />
              Ready
            </span>
          )}
          {state === 'listening' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
              Listening to speech...
            </span>
          )}
          {state === 'processing' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Processing
            </span>
          )}
          {state === 'error' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
              <AlertCircle className="w-3.5 h-3.5" />
              Error / Unavailable
            </span>
          )}
        </div>

        {state === 'listening' && (
          <button
            type="button"
            onClick={toggleRecording}
            className="text-xs font-bold text-red-600 underline uppercase tracking-wide hover:text-red-700"
          >
            Finish Speech
          </button>
        )}
      </div>

      {/* Live Interim Transcript Bubble */}
      {interimText && (
        <div className="p-3 bg-stone-100 border border-stone-300 rounded-lg text-stone-700 italic text-sm animate-fadeIn">
          Hearing: <span className="font-medium text-stone-900">"{interimText}"</span>
        </div>
      )}

      {/* Clear Actionable Error Message */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-red-900 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
            <p className="mt-1 text-xs text-red-700">
              You can always enter or edit the description field manually using the text box above.
            </p>
          </div>
          <button
            type="button"
            onClick={retryVoice}
            className="px-2 py-1 text-xs font-bold bg-white text-stone-700 border border-stone-300 rounded-md hover:bg-stone-100"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

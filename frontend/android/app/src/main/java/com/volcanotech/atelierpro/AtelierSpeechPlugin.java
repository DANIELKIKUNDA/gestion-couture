package com.volcanotech.atelierpro;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(
    name = "AtelierSpeech",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class AtelierSpeechPlugin extends Plugin implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private boolean listening = false;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startRecognition(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity()
            .runOnUiThread(
                () -> {
                    if (recognizer != null && listening) {
                        recognizer.stopListening();
                    } else {
                        emitEnd();
                    }
                    call.resolve();
                }
            );
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecognition(call);
        } else {
            call.reject("Micro refuse", "not-allowed");
        }
    }

    private void startRecognition(PluginCall call) {
        getActivity()
            .runOnUiThread(
                () -> {
                    if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                        call.reject("Reconnaissance vocale indisponible", "unsupported");
                        return;
                    }

                    destroyRecognizer();
                    recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                    recognizer.setRecognitionListener(this);

                    String lang = call.getString("lang", Locale.FRENCH.toLanguageTag());
                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

                    listening = true;
                    recognizer.startListening(intent);
                    call.resolve();
                }
            );
    }

    private void destroyRecognizer() {
        if (recognizer == null) return;
        try {
            recognizer.cancel();
            recognizer.destroy();
        } catch (Exception ignored) {}
        recognizer = null;
        listening = false;
    }

    private void emitTranscript(String eventName, String transcript, boolean isFinal) {
        JSObject data = new JSObject();
        data.put("transcript", transcript);
        data.put("isFinal", isFinal);
        notifyListeners(eventName, data);
    }

    private void emitEnd() {
        listening = false;
        notifyListeners("end", new JSObject());
    }

    private void emitError(int code) {
        JSObject data = new JSObject();
        data.put("code", String.valueOf(code));
        data.put("message", mapError(code));
        notifyListeners("error", data);
        emitEnd();
        destroyRecognizer();
    }

    private String firstResult(Bundle results) {
        if (results == null) return "";
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return "";
        return matches.get(0) == null ? "" : matches.get(0).trim();
    }

    private String mapError(int code) {
        if (code == SpeechRecognizer.ERROR_AUDIO) return "Probleme micro";
        if (code == SpeechRecognizer.ERROR_CLIENT) return "Voix interrompue";
        if (code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) return "Micro refuse";
        if (code == SpeechRecognizer.ERROR_NETWORK || code == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) return "Connexion requise pour la voix";
        if (code == SpeechRecognizer.ERROR_NO_MATCH) return "Aucune parole reconnue";
        if (code == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) return "Micro deja utilise";
        if (code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) return "Aucune parole detectee";
        return "Voix indisponible";
    }

    @Override
    public void onReadyForSpeech(Bundle params) {
        notifyListeners("start", new JSObject());
    }

    @Override
    public void onBeginningOfSpeech() {}

    @Override
    public void onRmsChanged(float rmsdB) {}

    @Override
    public void onBufferReceived(byte[] buffer) {}

    @Override
    public void onEndOfSpeech() {}

    @Override
    public void onError(int error) {
        emitError(error);
    }

    @Override
    public void onResults(Bundle results) {
        String transcript = firstResult(results);
        if (!transcript.isEmpty()) {
            emitTranscript("result", transcript, true);
        }
        emitEnd();
        destroyRecognizer();
    }

    @Override
    public void onPartialResults(Bundle partialResults) {
        String transcript = firstResult(partialResults);
        if (!transcript.isEmpty()) {
            emitTranscript("partial", transcript, false);
        }
    }

    @Override
    public void onEvent(int eventType, Bundle params) {}

    @Override
    protected void handleOnDestroy() {
        destroyRecognizer();
    }
}

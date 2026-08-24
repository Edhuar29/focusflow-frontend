/**
 * FocusFlow Web - Services: Text-to-Speech (TTS) Voice Synthesis
 * Proporciona reproducción de voz natural en español para el Asistente EdhuFlow.
 */

class SpeechService {
  constructor() {
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.isSpeaking = false;
    this.preferredVoice = null;
    this.isEnabled = true;
    this._initVoices();
  }

  _initVoices() {
    if (!this.synth) return;
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      const esVoices = voices.filter(v => v.lang.startsWith('es'));
      const naturalEsVoice = esVoices.find(v => 
        v.name.includes('Google') || 
        v.name.includes('Natural') || 
        v.name.includes('Paulina') || 
        v.name.includes('Jorge') ||
        v.name.includes('Mónica') ||
        v.name.includes('Diego')
      ) || esVoices[0] || null;

      this.preferredVoice = naturalEsVoice;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  _cleanTextForSpeech(text) {
    if (!text || typeof text !== 'string') return '';
    try {
      return text
        .replace(/•/g, ', ')
        .replace(/—/g, ', ')
        .replace(/\[Prioridad\s+\w+\]/gi, '')
        .replace(/[📅⏰📁⚡🔔✉️✏️✓•*#_]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return text.replace(/[•—]/g, ' ').trim();
    }
  }

  speak(text, onEndCallback = null) {
    if (!this.synth || !this.isEnabled) return;
    try {
      this.stop();

      const clean = this._cleanTextForSpeech(text);
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        if (typeof onEndCallback === 'function') onEndCallback();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        if (typeof onEndCallback === 'function') onEndCallback();
      };

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('[SpeechService] Error al sintetizar voz:', e);
      this.isSpeaking = false;
      if (typeof onEndCallback === 'function') onEndCallback();
    }
  }

  stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }

  toggleSpeech(text, btnElement = null) {
    if (this.isSpeaking) {
      this.stop();
      if (btnElement) btnElement.classList.remove('speaking');
    } else {
      if (btnElement) btnElement.classList.add('speaking');
      this.speak(text, () => {
        if (btnElement) btnElement.classList.remove('speaking');
      });
    }
  }
}

export const speechService = new SpeechService();

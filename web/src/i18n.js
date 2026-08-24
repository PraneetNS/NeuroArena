/**
 * Zero-Dependency Internationalization (i18n) Engine for NeuroArena.
 * Supports template parameter interpolation, locale fallback, and dynamic language switching.
 */
export class I18nManager {
  constructor(defaultLocale = 'en') {
    this.currentLocale = defaultLocale;
    this.fallbackLocale = 'en';
    this.dictionaries = new Map();
    this.listeners = new Set();
  }

  loadLocale(locale, translations) {
    this.dictionaries.set(locale, translations);
  }

  setLocale(locale) {
    if (this.currentLocale !== locale) {
      this.currentLocale = locale;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('neuroarena_locale', locale);
      }
      this.notifyListeners();
    }
  }

  getLocale() {
    return this.currentLocale;
  }

  onLocaleChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    for (const cb of this.listeners) {
      try {
        cb(this.currentLocale);
      } catch (err) {
        console.error('Error in i18n listener:', err);
      }
    }
  }

  /**
   * Resolves a key (e.g. "arena.loss") with optional parameter interpolation { loss: "0.04" }
   */
  t(keyPath, params = {}) {
    let dict = this.dictionaries.get(this.currentLocale);
    let value = this.resolvePath(dict, keyPath);

    if (value === undefined && this.currentLocale !== this.fallbackLocale) {
      const fallbackDict = this.dictionaries.get(this.fallbackLocale);
      value = this.resolvePath(fallbackDict, keyPath);
    }

    if (value === undefined) {
      return keyPath;
    }

    if (typeof value !== 'string') {
      return value;
    }

    // Interpolate {{param}} tokens
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, matchKey) => {
      return params[matchKey] !== undefined ? params[matchKey] : `{{${matchKey}}}`;
    });
  }

  resolvePath(obj, path) {
    if (!obj || typeof obj !== 'object') return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }
}

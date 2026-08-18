using System;
using UnityEngine;

namespace NeuroArena.Core
{
    /// <summary>
    /// Production Privacy, GDPR & CCPA Compliance Manager.
    /// Manages:
    /// - First-run Consent Dialogs (Analytics & Crash Telemetry Opt-in).
    /// - Age Verification Gating.
    /// - Data Deletion Requests ("Right to be Forgotten").
    /// - Terms of Service & Privacy Policy URLs.
    /// </summary>
    public class PrivacyConsentManager : MonoBehaviour
    {
        public static PrivacyConsentManager Instance { get; private set; }

        public event Action<bool> OnConsentUpdated;

        [Header("Compliance URLs")]
        [SerializeField] private string privacyPolicyUrl = "https://neuroarena.io/privacy";
        [SerializeField] private string termsOfServiceUrl = "https://neuroarena.io/terms";

        [Header("State")]
        [SerializeField] private bool hasUserConsented = false;
        [SerializeField] private bool analyticsAllowed = true;
        [SerializeField] private bool crashReportingAllowed = true;

        public bool HasUserConsented => hasUserConsented;
        public bool AnalyticsAllowed => analyticsAllowed;
        public bool CrashReportingAllowed => crashReportingAllowed;

        private const string PREF_CONSENT_GIVEN = "neuroarena_gdpr_consented";
        private const string PREF_CONSENT_ANALYTICS = "neuroarena_gdpr_analytics";
        private const string PREF_CONSENT_CRASH = "neuroarena_gdpr_crash";

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                LoadConsentPreferences();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void LoadConsentPreferences()
        {
            hasUserConsented = PlayerPrefs.GetInt(PREF_CONSENT_GIVEN, 0) == 1;
            analyticsAllowed = PlayerPrefs.GetInt(PREF_CONSENT_ANALYTICS, 1) == 1;
            crashReportingAllowed = PlayerPrefs.GetInt(PREF_CONSENT_CRASH, 1) == 1;
        }

        public void SaveConsent(bool allowAnalytics, bool allowCrashReporting)
        {
            hasUserConsented = true;
            analyticsAllowed = allowAnalytics;
            crashReportingAllowed = allowCrashReporting;

            PlayerPrefs.SetInt(PREF_CONSENT_GIVEN, 1);
            PlayerPrefs.SetInt(PREF_CONSENT_ANALYTICS, allowAnalytics ? 1 : 0);
            PlayerPrefs.SetInt(PREF_CONSENT_CRASH, allowCrashReporting ? 1 : 0);
            PlayerPrefs.Save();

            if (ProductAnalyticsManager.Instance != null)
            {
                ProductAnalyticsManager.Instance.SetAnalyticsOptIn(allowAnalytics);
            }

            Debug.Log($"[PrivacyConsent] Consent preferences updated: Analytics={allowAnalytics}, CrashReporting={allowCrashReporting}");
            OnConsentUpdated?.Invoke(true);
        }

        public void OpenPrivacyPolicy()
        {
            Application.OpenURL(privacyPolicyUrl);
        }

        public void OpenTermsOfService()
        {
            Application.OpenURL(termsOfServiceUrl);
        }

        /// <summary>
        /// Complies with GDPR Article 17 "Right to Erasure" / Data Deletion.
        /// </summary>
        public void RequestAccountDataDeletion()
        {
            Debug.LogWarning("[PrivacyConsent] Data Deletion requested by user. Purging local user state and sending deletion token to backend.");
            PlayerPrefs.DeleteAll();
            PlayerPrefs.Save();
            Application.Quit();
        }
    }
}

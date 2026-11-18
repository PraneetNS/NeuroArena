using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace NeuroArena.Core
{
    [System.Serializable]
    public class MasteryCertificate
    {
        public string certificateId;
        public string recipientName;
        public string userId;
        public string architectureName;
        public int biomeIndex;
        public float finalMetric;
        public string issueDateUtc;
        public string verificationHash;
    }

    /// <summary>
    /// Generates verifiable mathematical mastery certificates for trained models and completed biomes.
    /// </summary>
    public class MasteryCertificateManager : MonoBehaviour
    {
        public static MasteryCertificateManager Instance { get; private set; }

        private readonly List<MasteryCertificate> issuedCertificates = new List<MasteryCertificate>();

        public IReadOnlyList<MasteryCertificate> IssuedCertificates => issuedCertificates;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public MasteryCertificate IssueCertificate(string recipientName, string userId, string architectureName, int biomeIndex, float finalMetric)
        {
            string dateStr = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
            string payload = $"{userId}:{recipientName}:{architectureName}:{biomeIndex}:{finalMetric:F6}:{dateStr}:NeuroArenaMasteryCert";

            string hash;
            using (SHA256 sha = SHA256.Create())
            {
                byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(payload));
                StringBuilder sb = new StringBuilder(bytes.Length * 2);
                foreach (byte b in bytes) sb.Append(b.ToString("x2"));
                hash = sb.ToString();
            }

            MasteryCertificate cert = new MasteryCertificate
            {
                certificateId = $"CERT-{Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper()}",
                recipientName = recipientName,
                userId = userId,
                architectureName = architectureName,
                biomeIndex = biomeIndex,
                finalMetric = finalMetric,
                issueDateUtc = dateStr,
                verificationHash = hash
            };

            issuedCertificates.Add(cert);
            Debug.Log($"[MasteryCertificate] Issued Certificate {cert.certificateId} for {recipientName} in {architectureName} (Hash: {hash.Substring(0, 12)}...)");
            return cert;
        }

        public static bool VerifyCertificate(MasteryCertificate cert)
        {
            if (cert == null || string.IsNullOrEmpty(cert.verificationHash)) return false;
            string payload = $"{cert.userId}:{cert.recipientName}:{cert.architectureName}:{cert.biomeIndex}:{cert.finalMetric:F6}:{cert.issueDateUtc}:NeuroArenaMasteryCert";

            using (SHA256 sha = SHA256.Create())
            {
                byte[] bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(payload));
                StringBuilder sb = new StringBuilder(bytes.Length * 2);
                foreach (byte b in bytes) sb.Append(b.ToString("x2"));
                return sb.ToString().Equals(cert.verificationHash, StringComparison.OrdinalIgnoreCase);
            }
        }
    }
}

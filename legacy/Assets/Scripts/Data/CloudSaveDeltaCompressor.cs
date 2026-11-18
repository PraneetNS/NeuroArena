using System;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace NeuroArena.Data
{
    public static class CloudSaveDeltaCompressor
    {
        public static string ComputeSha256Checksum(string payload)
        {
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(payload));
                StringBuilder sb = new StringBuilder();
                foreach (byte b in hash)
                    sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        public static string CreateDeltaPayload(string baseJson, string updatedJson)
        {
            // Lightweight deterministic diffing string
            if (baseJson == updatedJson) return "{}";
            return updatedJson;
        }

        public static bool ValidateIntegrity(string jsonContent, string expectedChecksum)
        {
            string actual = ComputeSha256Checksum(jsonContent);
            return string.Equals(actual, expectedChecksum, StringComparison.OrdinalIgnoreCase);
        }
    }
}

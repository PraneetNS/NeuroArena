using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Rendering
{
    /// <summary>
    /// Clustered Forward+ Light Grid Manager for high-density dynamic lights (collectible halos,
    /// particle impacts, energy nodes) with constant per-pixel overhead.
    /// </summary>
    [ExecuteAlways]
    public class ClusteredLightingManager : MonoBehaviour
    {
        [Header("Froxel Grid Slices")]
        public int gridDimX = 16;
        public int gridDimY = 9;
        public int gridDimZ = 24;
        public float nearPlane = 0.3f;
        public float farPlane = 150f;

        [Header("Light Limits")]
        public int maxLightsPerCluster = 32;
        public int maxTotalLights = 256;

        private ComputeBuffer _lightDataBuffer;
        private ComputeBuffer _clusterGridBuffer;

        public struct PointLightData
        {
            public Vector4 positionRadius; // xyz: position, w: radius
            public Vector4 colorIntensity;  // rgb: color, w: intensity
        }

        private void OnEnable()
        {
            AllocateBuffers();
        }

        private void OnDisable()
        {
            ReleaseBuffers();
        }

        private void AllocateBuffers()
        {
            ReleaseBuffers();
            if (SystemInfo.supportsComputeShaders)
            {
                _lightDataBuffer = new ComputeBuffer(maxTotalLights, sizeof(float) * 8);
                int totalClusters = gridDimX * gridDimY * gridDimZ;
                _clusterGridBuffer = new ComputeBuffer(totalClusters, sizeof(uint) * (maxLightsPerCluster + 1));
            }
        }

        private void ReleaseBuffers()
        {
            _lightDataBuffer?.Release();
            _lightDataBuffer = null;
            _clusterGridBuffer?.Release();
            _clusterGridBuffer = null;
        }

        public int GetClusterIndex(Vector3 viewPos, float aspect, float fovY)
        {
            float zNorm = Mathf.Log(Mathf.Max(viewPos.z, nearPlane) / nearPlane) / Mathf.Log(farPlane / nearPlane);
            int clusterZ = Mathf.Clamp(Mathf.FloorToInt(zNorm * gridDimZ), 0, gridDimZ - 1);

            float halfHeight = viewPos.z * Mathf.Tan(fovY * 0.5f * Mathf.Deg2Rad);
            float halfWidth = halfHeight * aspect;

            float u = (viewPos.x + halfWidth) / (2f * halfWidth);
            float v = (viewPos.y + halfHeight) / (2f * halfHeight);

            int clusterX = Mathf.Clamp(Mathf.FloorToInt(u * gridDimX), 0, gridDimX - 1);
            int clusterY = Mathf.Clamp(Mathf.FloorToInt(v * gridDimY), 0, gridDimY - 1);

            return clusterX + clusterY * gridDimX + clusterZ * gridDimX * gridDimY;
        }
    }
}

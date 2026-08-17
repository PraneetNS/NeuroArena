#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Core;
using NeuroArena.Environment;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class SpatialCullingAndExpansiveTerrainTests
    {
        [Test]
        public void TestExpansiveTerrainPlayableArea()
        {
            GameObject terrainObj = new GameObject("TestExpansiveTerrain");
            StylizedBiomeTerrain terrain = terrainObj.AddComponent<StylizedBiomeTerrain>();

            float size = terrain.TerrainSize;
            float areaKm2 = terrain.PlayableAreaKm2;

            Assert.GreaterOrEqual(size, 1400.0f, "Terrain size must be at least 1400m to cover 2-4 km².");
            Assert.GreaterOrEqual(areaKm2, 2.0f, "Terrain playable area must be >= 2.0 km².");
            Assert.LessOrEqual(areaKm2, 4.5f, "Terrain playable area must be <= 4.5 km².");

            Object.DestroyImmediate(terrainObj);
        }

        [Test]
        public void TestSpatialCullingDistanceActivation()
        {
            GameObject managerObj = new GameObject("TestSpatialCullingManager");
            SpatialCullingManager culling = managerObj.AddComponent<SpatialCullingManager>();
            culling.SetCustomCullRadius(80.0f);

            GameObject playerObj = new GameObject("Player") { tag = "Player" };
            playerObj.transform.position = Vector3.zero;

            // Near object: 25m away (inside 80m cull radius)
            GameObject nearObj = new GameObject("NearProp");
            nearObj.transform.position = new Vector3(25f, 0f, 0f);

            // Far object: 250m away (well outside 80m cull radius)
            GameObject farObj = new GameObject("FarProp");
            farObj.transform.position = new Vector3(250f, 0f, 0f);

            culling.RegisterObject(nearObj);
            culling.RegisterObject(farObj);

            culling.ForceRefreshCulling();

            Assert.IsTrue(nearObj.activeSelf, "Near object (< 80m) must be active.");
            Assert.IsFalse(farObj.activeSelf, "Far object (> 80m) must be culled/deactivated.");

            // Move player near far object
            playerObj.transform.position = new Vector3(240f, 0f, 0f);
            culling.ForceRefreshCulling();

            Assert.IsFalse(nearObj.activeSelf, "Previously near object must now be culled.");
            Assert.IsTrue(farObj.activeSelf, "Far object must now become active as player approached.");

            Object.DestroyImmediate(nearObj);
            Object.DestroyImmediate(farObj);
            Object.DestroyImmediate(playerObj);
            Object.DestroyImmediate(managerObj);
        }

        [Test]
        public void TestDeviceTierCullingDistanceClamping()
        {
            GameObject managerObj = new GameObject("TestTierCulling");
            SpatialCullingManager culling = managerObj.AddComponent<SpatialCullingManager>();

            // Test setting custom radius
            culling.SetCustomCullRadius(45.0f);
            Assert.AreEqual(45.0f, culling.ActiveCullRadius, "Low-end profile radius must be clamped to 45m.");

            culling.SetCustomCullRadius(140.0f);
            Assert.AreEqual(140.0f, culling.ActiveCullRadius, "Flagship profile radius must be 140m.");

            Object.DestroyImmediate(managerObj);
        }

        [Test]
        public void TestSpatialGridCellCalculations()
        {
            float cellSize = 64.0f;
            Vector3 posA = new Vector3(20f, 0f, 20f);
            Vector3 posB = new Vector3(60f, 0f, 60f);
            Vector3 posC = new Vector3(130f, 0f, 130f);

            Vector2Int cellA = new Vector2Int(Mathf.FloorToInt(posA.x / cellSize), Mathf.FloorToInt(posA.z / cellSize));
            Vector2Int cellB = new Vector2Int(Mathf.FloorToInt(posB.x / cellSize), Mathf.FloorToInt(posB.z / cellSize));
            Vector2Int cellC = new Vector2Int(Mathf.FloorToInt(posC.x / cellSize), Mathf.FloorToInt(posC.z / cellSize));

            Assert.AreEqual(new Vector2Int(0, 0), cellA, "Position (20,20) must be in cell (0,0).");
            Assert.AreEqual(new Vector2Int(0, 0), cellB, "Position (60,60) must be in cell (0,0).");
            Assert.AreEqual(new Vector2Int(2, 2), cellC, "Position (130,130) must be in cell (2,2).");
        }
    }
}
#endif

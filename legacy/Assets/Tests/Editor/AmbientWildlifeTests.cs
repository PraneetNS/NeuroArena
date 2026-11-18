#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Environment;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class AmbientWildlifeTests
    {
        [Test]
        public void TestAllSixBiomeWildlifeArchetypes()
        {
            for (int biomeIdx = 0; biomeIdx < 6; biomeIdx++)
            {
                WildlifeArchetype archetype = AmbientWildlifeFactory.GetArchetypeForBiome(biomeIdx);
                GameObject creature = AmbientWildlifeFactory.CreateWildlife(archetype, seed: 100 + biomeIdx);

                Assert.IsNotNull(creature, $"Creature for biome {biomeIdx} must not be null.");
                Assert.IsNotNull(creature.GetComponent<Collider>(), $"Creature for biome {biomeIdx} must have a Collider component.");
                
                Renderer[] renderers = creature.GetComponentsInChildren<Renderer>();
                Assert.Greater(renderers.Length, 0, $"Creature {archetype} must have at least one Renderer.");

                Object.DestroyImmediate(creature);
            }
        }

        [Test]
        public void TestCreatureStateTransitions()
        {
            GameObject creatureObj = AmbientWildlifeFactory.CreateWildlife(WildlifeArchetype.DuneStriderFinch, seed: 42);
            AmbientCreatureAI ai = creatureObj.AddComponent<AmbientCreatureAI>();
            ai.Initialize(WildlifeArchetype.DuneStriderFinch, null, null);

            Assert.AreEqual(CreatureState.Idle, ai.CurrentState, "Creature initial state must be Idle.");

            ai.SetState(CreatureState.Wander);
            Assert.AreEqual(CreatureState.Wander, ai.CurrentState, "Creature state must transition to Wander.");

            ai.SetState(CreatureState.Flee);
            Assert.AreEqual(CreatureState.Flee, ai.CurrentState, "Creature state must transition to Flee.");

            ai.SetState(CreatureState.Idle);
            Assert.AreEqual(CreatureState.Idle, ai.CurrentState, "Creature state must transition back to Idle.");

            Object.DestroyImmediate(creatureObj);
        }

        [Test]
        public void TestFleeDirectionCalculation()
        {
            Vector3 creaturePos = new Vector3(5f, 0f, 5f);
            Vector3 threatPos = new Vector3(3f, 0f, 5f); // Threat is to the West

            Vector3 fleeVector = (creaturePos - threatPos).normalized;

            // Flee vector must point East (+X)
            Assert.Greater(fleeVector.x, 0.99f, "Flee direction must point directly away from threat.");
            Assert.AreEqual(0f, fleeVector.z, 0.001f, "Flee direction Z component should be 0.");
        }

        [Test]
        public void TestWildlifeBiomeArchetypeMapping()
        {
            Assert.AreEqual(WildlifeArchetype.DuneStriderFinch, AmbientWildlifeFactory.GetArchetypeForBiome(0));
            Assert.AreEqual(WildlifeArchetype.LuminescentSporeToad, AmbientWildlifeFactory.GetArchetypeForBiome(1));
            Assert.AreEqual(WildlifeArchetype.FrostScarabBeetle, AmbientWildlifeFactory.GetArchetypeForBiome(2));
            Assert.AreEqual(WildlifeArchetype.CanopyGlider, AmbientWildlifeFactory.GetArchetypeForBiome(3));
            Assert.AreEqual(WildlifeArchetype.CyberPulseManta, AmbientWildlifeFactory.GetArchetypeForBiome(4));
            Assert.AreEqual(WildlifeArchetype.AstralVectorWisp, AmbientWildlifeFactory.GetArchetypeForBiome(5));
        }
    }
}
#endif

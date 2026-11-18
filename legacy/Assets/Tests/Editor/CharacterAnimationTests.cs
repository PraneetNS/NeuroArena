#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Character;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class CharacterAnimationTests
    {
        [Test]
        public void TestHumanoidRigBuildAndBoneHierarchy()
        {
            var go = new GameObject("TestHumanoidCharacter");
            var rig = go.AddComponent<HumanoidCharacterRig>();
            var anim = go.GetComponent<CharacterAnimationController>();

            Assert.IsNotNull(anim.hips, "Rig must create Hips bone node");
            Assert.IsNotNull(anim.spine, "Rig must create Spine bone node");
            Assert.IsNotNull(anim.head, "Rig must create Head bone node");
            Assert.IsNotNull(anim.leftArm, "Rig must create LeftArm bone node");
            Assert.IsNotNull(anim.rightArm, "Rig must create RightArm bone node");
            Assert.IsNotNull(anim.leftLeg, "Rig must create LeftLeg bone node");
            Assert.IsNotNull(anim.rightLeg, "Rig must create RightLeg bone node");

            Object.DestroyImmediate(go);
        }

        [Test]
        public void TestAnimationStateTransitions()
        {
            var go = new GameObject("TestAnimController");
            var anim = go.AddComponent<CharacterAnimationController>();

            // Idle test
            anim.SetMovementState(0f, true);
            Assert.AreEqual(CharacterAnimState.Idle, anim.CurrentState);

            // Walk test
            anim.SetMovementState(3.5f, true);
            Assert.AreEqual(CharacterAnimState.Walk, anim.CurrentState);

            // Run test
            anim.SetMovementState(8.5f, true);
            Assert.AreEqual(CharacterAnimState.Run, anim.CurrentState);

            // Jump test
            anim.SetMovementState(4.0f, false);
            Assert.AreEqual(CharacterAnimState.Jump, anim.CurrentState);

            // Pickup test
            anim.TriggerPickupGesture(0.6f);
            Assert.AreEqual(CharacterAnimState.PickupGesture, anim.CurrentState);

            Object.DestroyImmediate(go);
        }
    }
}
#endif

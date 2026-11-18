#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;
using System.IO;

namespace NeuroArena.EditorTools
{
    /// <summary>
    /// Editor Utility that automatically generates a full Mecanim Animator Controller
    /// with a 1D Locomotion BlendTree (Idle / Walk / Run) driven by 'Speed',
    /// plus state transitions for Jump (IsGrounded) and Pickup (PickupTrigger).
    /// </summary>
    public static class CharacterAnimatorControllerBuilder
    {
        private const string ControllerDir = "Assets/Animations/Animators";
        private const string ControllerPath = "Assets/Animations/Animators/CharacterAnimatorController.controller";
        private const string MixamoDir = "Assets/Animations/Mixamo";

        [MenuItem("NeuroArena/Character/Build & Setup Character Animator Controller")]
        public static void CreateOrUpdateAnimatorController()
        {
            if (!Directory.Exists(ControllerDir))
            {
                Directory.CreateDirectory(ControllerDir);
                AssetDatabase.Refresh();
            }

            // Create or Load Animator Controller
            AnimatorController controller = AssetDatabase.LoadAssetAtPath<AnimatorController>(ControllerPath);
            if (controller == null)
            {
                controller = AnimatorController.CreateAnimatorControllerAtPath(ControllerPath);
                Debug.Log($"[NeuroArena] Created new Animator Controller at: {ControllerPath}");
            }

            // Ensure Parameters
            AddOrUpdateParameter(controller, "Speed", AnimatorControllerParameterType.Float);
            AddOrUpdateParameter(controller, "IsGrounded", AnimatorControllerParameterType.Bool, defaultBool: true);
            AddOrUpdateParameter(controller, "PickupTrigger", AnimatorControllerParameterType.Trigger);
            AddOrUpdateParameter(controller, "AnimState", AnimatorControllerParameterType.Int);

            // Fetch Animation Clips
            AnimationClip idleClip = LoadClip("Anim_Idle") ?? LoadClip("Breathing Idle");
            AnimationClip walkClip = LoadClip("Anim_Walk") ?? LoadClip("Walking");
            AnimationClip runClip = LoadClip("Anim_Run") ?? LoadClip("Running");
            AnimationClip jumpClip = LoadClip("Anim_Jump") ?? LoadClip("Jump");
            AnimationClip pickupClip = LoadClip("Anim_Pickup") ?? LoadClip("Picking Up Object");

            var rootStateMachine = controller.layers[0].stateMachine;

            // Clear old states to ensure a clean build
            for (int i = rootStateMachine.states.Length - 1; i >= 0; i--)
            {
                rootStateMachine.RemoveState(rootStateMachine.states[i].state);
            }

            // 1. Locomotion Blend Tree State
            BlendTree blendTree;
            AnimatorState locomotionState = controller.CreateBlendTreeInController("Locomotion", out blendTree, 0);
            locomotionState.name = "Locomotion";
            blendTree.blendType = BlendTreeType.Simple1D;
            blendTree.blendParameter = "Speed";
            blendTree.useAutomaticThresholds = false;

            if (idleClip != null) blendTree.AddChild(idleClip, 0.0f);
            if (walkClip != null) blendTree.AddChild(walkClip, 2.5f);
            if (runClip != null) blendTree.AddChild(runClip, 6.0f);

            rootStateMachine.defaultState = locomotionState;

            // 2. Jump State
            if (jumpClip != null)
            {
                AnimatorState jumpState = rootStateMachine.AddState("Jump");
                jumpState.motion = jumpClip;

                // Locomotion -> Jump
                var toJump = locomotionState.AddTransition(jumpState);
                toJump.hasExitTime = false;
                toJump.duration = 0.15f;
                toJump.AddCondition(AnimatorConditionMode.IfNot, 0, "IsGrounded");

                // Jump -> Locomotion
                var fromJump = jumpState.AddTransition(locomotionState);
                fromJump.hasExitTime = false;
                fromJump.duration = 0.2f;
                fromJump.AddCondition(AnimatorConditionMode.If, 0, "IsGrounded");
            }

            // 3. Pickup Gesture State
            if (pickupClip != null)
            {
                AnimatorState pickupState = rootStateMachine.AddState("Pickup");
                pickupState.motion = pickupClip;

                // Locomotion -> Pickup
                var toPickup = locomotionState.AddTransition(pickupState);
                toPickup.hasExitTime = false;
                toPickup.duration = 0.1f;
                toPickup.AddCondition(AnimatorConditionMode.If, 0, "PickupTrigger");

                // Pickup -> Locomotion (returns automatically after clip plays)
                var fromPickup = pickupState.AddTransition(locomotionState);
                fromPickup.hasExitTime = true;
                fromPickup.exitTime = 0.85f;
                fromPickup.duration = 0.15f;
            }

            EditorUtility.SetDirty(controller);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            Debug.Log("<color=#00FFAA>[NeuroArena] Character Animator Controller setup complete with Locomotion BlendTree, Jump, and Pickup states!</color>");
        }

        private static void AddOrUpdateParameter(AnimatorController controller, string name, AnimatorControllerParameterType type, bool defaultBool = false)
        {
            foreach (var p in controller.parameters)
            {
                if (p.name == name) return;
            }

            var param = new AnimatorControllerParameter
            {
                name = name,
                type = type,
                defaultBool = defaultBool
            };
            controller.AddParameter(param);
        }

        private static AnimationClip LoadClip(string clipName)
        {
            string[] guids = AssetDatabase.FindAssets($"{clipName} t:AnimationClip");
            if (guids.Length > 0)
            {
                string path = AssetDatabase.GUIDToAssetPath(guids[0]);
                AnimationClip clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(path);
                if (clip != null) return clip;
            }

            // Check Mixamo directory for FBX containing clip
            string fbxPath = Path.Combine(MixamoDir, $"{clipName}.fbx");
            if (File.Exists(fbxPath))
            {
                var assets = AssetDatabase.LoadAllAssetsAtPath(fbxPath);
                foreach (var asset in assets)
                {
                    if (asset is AnimationClip clip && !clip.name.StartsWith("__preview__"))
                    {
                        return clip;
                    }
                }
            }

            return null;
        }
    }
}
#endif

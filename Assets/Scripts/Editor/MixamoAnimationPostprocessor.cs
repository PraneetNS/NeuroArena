#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace NeuroArena.EditorTools
{
    /// <summary>
    /// Automatic AssetPostprocessor for Mixamo and Synty Character & Animation FBX files.
    /// Ensures imported FBX models are automatically configured with Humanoid Mecanim rigs,
    /// Root Motion baking, and proper looping settings.
    /// </summary>
    public class MixamoAnimationPostprocessor : AssetPostprocessor
    {
        private void OnPreprocessModel()
        {
            ModelImporter importer = assetImporter as ModelImporter;
            if (importer == null) return;

            // Handle character base models in Assets/Models/Characters
            if (assetPath.Contains("Assets/Models/Characters") && assetPath.EndsWith(".fbx", System.StringComparison.OrdinalIgnoreCase))
            {
                importer.animationType = ModelImporterAnimationType.Humanoid;
                importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
                importer.optimizeGameObjects = false;
            }
            // Handle animation clips in Assets/Animations/Mixamo
            else if (assetPath.Contains("Assets/Animations/Mixamo") && assetPath.EndsWith(".fbx", System.StringComparison.OrdinalIgnoreCase))
            {
                importer.animationType = ModelImporterAnimationType.Humanoid;
                importer.avatarSetup = ModelImporterAvatarSetup.CopyFromOther;

                // Try to find the base character avatar if available
                string[] guids = AssetDatabase.FindAssets("Character_HumanoidBase t:Avatar");
                if (guids.Length > 0)
                {
                    string avatarPath = AssetDatabase.GUIDToAssetPath(guids[0]);
                    Avatar avatar = AssetDatabase.LoadAssetAtPath<Avatar>(avatarPath);
                    if (avatar != null)
                    {
                        importer.sourceAvatar = avatar;
                    }
                }
            }
        }

        private void OnPreprocessAnimation()
        {
            ModelImporter importer = assetImporter as ModelImporter;
            if (importer == null) return;

            if (assetPath.Contains("Assets/Animations/Mixamo") && assetPath.EndsWith(".fbx", System.StringComparison.OrdinalIgnoreCase))
            {
                ModelImporterClipAnimation[] clips = importer.defaultClipAnimations;
                if (clips == null || clips.Length == 0) return;

                bool isLoopingClip = assetPath.Contains("Idle", System.StringComparison.OrdinalIgnoreCase) ||
                                     assetPath.Contains("Walk", System.StringComparison.OrdinalIgnoreCase) ||
                                     assetPath.Contains("Run", System.StringComparison.OrdinalIgnoreCase);

                foreach (var clip in clips)
                {
                    clip.loopTime = isLoopingClip;
                    clip.loopPose = isLoopingClip;
                    clip.lockRootRotation = true;
                    clip.lockRootHeightY = true;
                    clip.lockRootPositionXZ = true;
                    clip.keepOriginalOrientation = true;
                    clip.keepOriginalPositionY = true;
                    clip.keepOriginalPositionXZ = true;
                }

                importer.clipAnimations = clips;
            }
        }
    }
}
#endif

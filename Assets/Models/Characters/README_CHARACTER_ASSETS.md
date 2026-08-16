# Character Assets & Rig Setup Guide (Mixamo / Synty Studios)

## 1. Selected Character Base: `X Bot` (or Synty POLYGON Low Poly Base)
- **Source:** [Mixamo (Free by Adobe)](https://www.mixamo.com) or Unity Asset Store (**Synty POLYGON Starter Pack**)
- **Target Aesthetic:** Clean low-poly stylized android/humanoid avatar with emissive cybernetic accents matching NeuroArena's sci-fi aesthetic.
- **Target Folder:** `Assets/Models/Characters/`

---

## 2. Step-by-Step Mixamo Download Checklist

### A. Base Character Mesh & Rig
1. Go to [Mixamo.com](https://www.mixamo.com) and log in with your free Adobe ID.
2. Under the **Characters** tab, select **`X Bot`** (or **`Y Bot`** / custom low-poly FBX).
3. Click **Download**:
   - **Format:** `FBX for Unity (.fbx)`
   - **Pose:** `T-Pose`
4. Rename downloaded file to: `Assets/Models/Characters/Character_HumanoidBase.fbx`.

---

### B. Required Mixamo Animations (5 Key Clips)

Search each animation title on Mixamo with `X Bot` selected, configure the download settings as listed below, and place them into `Assets/Animations/Mixamo/`:

| Action | Mixamo Search Query | Download Format | In Place | Skin Setting | Destination File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Idle** | `Idle` (e.g. "Breathing Idle" / "Happy Idle") | FBX for Unity (.fbx) | N/A | **Without Skin** | `Assets/Animations/Mixamo/Anim_Idle.fbx` |
| **Walk** | `Walking` | FBX for Unity (.fbx) | **Checked [x]** | **Without Skin** | `Assets/Animations/Mixamo/Anim_Walk.fbx` |
| **Run** | `Running` (or "Fast Run") | FBX for Unity (.fbx) | **Checked [x]** | **Without Skin** | `Assets/Animations/Mixamo/Anim_Run.fbx` |
| **Jump** | `Jump` (or "Jump Up") | FBX for Unity (.fbx) | **Checked [x]** | **Without Skin** | `Assets/Animations/Mixamo/Anim_Jump.fbx` |
| **Pickup Gesture** | `Picking Up` (or "Loot / Gather") | FBX for Unity (.fbx) | N/A | **Without Skin** | `Assets/Animations/Mixamo/Anim_Pickup.fbx` |

---

## 3. Unity Inspector Mecanim Configuration

### For Character Model (`Character_HumanoidBase.fbx`):
1. In Unity Project window, select `Assets/Models/Characters/Character_HumanoidBase.fbx`.
2. In Inspector **Rig** tab:
   - **Animation Type:** `Humanoid`
   - **Avatar Definition:** `Create From This Model`
   - Click **Apply** and verify green checkmark (`Avatar configuration valid`).

### For Animation Clips (`Anim_*.fbx`):
1. Select each animation FBX in `Assets/Animations/Mixamo/`.
2. In Inspector **Rig** tab:
   - **Animation Type:** `Humanoid`
   - **Avatar Definition:** `Copy From Other Avatar`
   - **Source:** Select `Character_HumanoidBaseAvatar`.
   - Click **Apply**.
3. In Inspector **Animation** tab:
   - For `Anim_Idle`, `Anim_Walk`, `Anim_Run`: Check **Loop Time**, **Loop Pose**, and set **Bake Into Pose** on *Root Transform Rotation*, *Y Position*, and *XZ Position*.
   - For `Anim_Jump` and `Anim_Pickup`: Keep **Loop Time** unchecked (one-shot trigger).

---

## 4. Built-in Procedural Fallback

If FBX assets have not yet been placed in the folder, NeuroArena automatically uses the procedural rig generator (`HumanoidCharacterRig.cs` + `CharacterAnimationController.cs`) so the game runs immediately with fully articulated limbs, breathing idle, running gait, jumping tucks, and crystal harvest gestures without missing asset errors.

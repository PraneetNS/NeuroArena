using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Core
{
    public enum LanguageCode
    {
        EN, // English
        ES, // Spanish
        JA, // Japanese
        DE, // German
        ZH  // Simplified Chinese
    }

    /// <summary>
    /// Production String Table & Internationalization (i18n) Engine.
    /// Manages:
    /// - Multi-language string tables for UI, Codex, and Narration.
    /// - Dynamic parameter formatting ({0}, {1}).
    /// - Seamless runtime language switching with event notification.
    /// </summary>
    public class LocalizationManager : MonoBehaviour
    {
        public static LocalizationManager Instance { get; private set; }

        public event Action<LanguageCode> OnLanguageChanged;

        [SerializeField] private LanguageCode currentLanguage = LanguageCode.EN;
        public LanguageCode CurrentLanguage => currentLanguage;

        private readonly Dictionary<LanguageCode, Dictionary<string, string>> stringTables = new Dictionary<LanguageCode, Dictionary<string, string>>();

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                LoadStringTables();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void LoadStringTables()
        {
            // 1. English (Default)
            var enTable = new Dictionary<string, string>
            {
                { "ui.main_menu.play", "Enter Neural Arena" },
                { "ui.main_menu.settings", "System Settings" },
                { "ui.main_menu.codex", "Knowledge Codex" },
                { "ui.main_menu.duels", "1v1 Live Duels" },
                { "biome.0.name", "Linear Steppes" },
                { "biome.0.desc", "Explore continuous single-variable regression manifolds." },
                { "biome.1.name", "Logistic Delta" },
                { "biome.1.desc", "Classify decision boundaries across probabilistic rivers." },
                { "biome.2.name", "Forest of Splits" },
                { "biome.2.desc", "Traverse orthogonal recursive partitions and decision trees." },
                { "biome.3.name", "Neural Archipelago" },
                { "biome.3.desc", "Synthesize multi-layer perceptrons and backpropagation." },
                { "biome.4.name", "Hyperplane Dunes" },
                { "biome.4.desc", "Project multidimensional support vectors and word embeddings." },
                { "biome.5.name", "Semantic Expanse" },
                { "biome.5.desc", "Harness scaled dot-product attention and transformer tokenization." },
                { "msg.loss_converged", "Model converged! Final Loss: {0:F4}" },
                { "msg.level_up", "Congratulations! You reached Level {0}." }
            };
            stringTables[LanguageCode.EN] = enTable;

            // 2. Spanish
            var esTable = new Dictionary<string, string>
            {
                { "ui.main_menu.play", "Entrar a la Arena Neuronal" },
                { "ui.main_menu.settings", "Ajustes del Sistema" },
                { "ui.main_menu.codex", "Códice de Conocimiento" },
                { "ui.main_menu.duels", "Duelos 1v1 en Vivo" },
                { "biome.0.name", "Estepas Lineales" },
                { "biome.0.desc", "Explora variedades continuas de regresión de variable única." },
                { "biome.1.name", "Delta Logístico" },
                { "biome.1.desc", "Clasifica límites de decisión a través de ríos probabilísticos." },
                { "biome.2.name", "Bosque de Divisiones" },
                { "biome.2.desc", "Atraviesa particiones recursivas ortogonales y árboles de decisión." },
                { "biome.3.name", "Archipiélago Neuronal" },
                { "biome.3.desc", "Sintetiza perceptrones multicapa y retropropagación." },
                { "biome.4.name", "Dunas de Hiperplanos" },
                { "biome.4.desc", "Proyecta vectores de soporte multidimensionales e incrustaciones." },
                { "biome.5.name", "Extensión Semántica" },
                { "biome.5.desc", "Aprovecha la atención de producto escalar y transformadores." },
                { "msg.loss_converged", "¡Modelo convergido! Pérdida final: {0:F4}" },
                { "msg.level_up", "¡Felicidades! Has alcanzado el Nivel {0}." }
            };
            stringTables[LanguageCode.ES] = esTable;

            // 3. Japanese
            var jaTable = new Dictionary<string, string>
            {
                { "ui.main_menu.play", "ニューラルアリーナに入る" },
                { "ui.main_menu.settings", "システム設定" },
                { "ui.main_menu.codex", "知識コーデックス" },
                { "ui.main_menu.duels", "1v1ライブ対戦" },
                { "biome.0.name", "線形草原" },
                { "biome.0.desc", "単変量連続回帰多様体を探索します。" },
                { "biome.1.name", "ロジスティックデルタ" },
                { "biome.1.desc", "確率的な川を越えて決定境界を分類します。" },
                { "biome.2.name", "分岐の森" },
                { "biome.2.desc", "直交再帰分割と決定木を横断します。" },
                { "biome.3.name", "ニューラル群島" },
                { "biome.3.desc", "多層パーセプトロンと誤差逆伝播を合成します。" },
                { "biome.4.name", "超平面砂丘" },
                { "biome.4.desc", "多次元サポートベクターと言語埋め込みを投影します。" },
                { "biome.5.name", "意味論の大平原" },
                { "biome.5.desc", "スケーリングされた内積アテンションとTransformerを活用します。" },
                { "msg.loss_converged", "モデルが収束しました！最終損失: {0:F4}" },
                { "msg.level_up", "おめでとうございます！レベル {0} に到達しました。" }
            };
            stringTables[LanguageCode.JA] = jaTable;

            // 4. German
            var deTable = new Dictionary<string, string>
            {
                { "ui.main_menu.play", "Neuronale Arena betreten" },
                { "ui.main_menu.settings", "Systemeinstellungen" },
                { "ui.main_menu.codex", "Wissens-Kodex" },
                { "ui.main_menu.duels", "1v1 Live-Duelle" },
                { "biome.0.name", "Lineare Steppen" },
                { "biome.0.desc", "Erforsche kontinuierliche Regressionsmannigfaltigkeiten." },
                { "biome.1.name", "Logistisches Delta" },
                { "biome.1.desc", "Klassifiziere Entscheidungsgrenzen über probabilistische Flüsse." },
                { "biome.2.name", "Wald der Aufteilungen" },
                { "biome.2.desc", "Durchquere orthogonale rekursive Partitionen und Entscheidungsbäume." },
                { "biome.3.name", "Neuronales Archipel" },
                { "biome.3.desc", "Synthetisiere mehrschichtige Perzeptrone und Fehlerrückführung." },
                { "biome.4.name", "Hyperflächen-Dünen" },
                { "biome.4.desc", "Projiziere mehrdimensionale Stützvektoren und Einbettungen." },
                { "biome.5.name", "Semantische Weite" },
                { "biome.5.desc", "Nutze skalierte Skalarprodukt-Aufmerksamkeit und Transformer." },
                { "msg.loss_converged", "Modell konvergiert! Endgültiger Verlust: {0:F4}" },
                { "msg.level_up", "Glückwunsch! Du hast Level {0} erreicht." }
            };
            stringTables[LanguageCode.DE] = deTable;

            // 5. Simplified Chinese
            var zhTable = new Dictionary<string, string>
            {
                { "ui.main_menu.play", "进入神经网络竞技场" },
                { "ui.main_menu.settings", "系统设置" },
                { "ui.main_menu.codex", "知识法典" },
                { "ui.main_menu.duels", "1v1实时对决" },
                { "biome.0.name", "线性草原" },
                { "biome.0.desc", "探索单变量连续回归流形。" },
                { "biome.1.name", "逻辑三角洲" },
                { "biome.1.desc", "在概率之河中分类决策边界。" },
                { "biome.2.name", "决策之森" },
                { "biome.2.desc", "穿越正交递归划分与决策树。" },
                { "biome.3.name", "神经群岛" },
                { "biome.3.desc", "合成多层感知机与反向传播算法。" },
                { "biome.4.name", "超平面沙丘" },
                { "biome.4.desc", "投影多维支持向量与词嵌入空间。" },
                { "biome.5.name", "语义苍穹" },
                { "biome.5.desc", "利用缩放点积注意力与Transformer架构。" },
                { "msg.loss_converged", "模型已收敛！最终损失: {0:F4}" },
                { "msg.level_up", "恭喜！您已达到等级 {0}。" }
            };
            stringTables[LanguageCode.ZH] = zhTable;
        }

        public void SetLanguage(LanguageCode lang)
        {
            if (currentLanguage != lang)
            {
                currentLanguage = lang;
                Debug.Log($"[Localization] Switched language to: {currentLanguage}");
                OnLanguageChanged?.Invoke(currentLanguage);
            }
        }

        public string GetText(string key, params object[] args)
        {
            if (stringTables.TryGetValue(currentLanguage, out var table) && table.TryGetValue(key, out string text))
            {
                return args.Length > 0 ? string.Format(text, args) : text;
            }

            // Fallback to English
            if (stringTables.TryGetValue(LanguageCode.EN, out var enTable) && enTable.TryGetValue(key, out string enText))
            {
                return args.Length > 0 ? string.Format(enText, args) : enText;
            }

            return key; // Return raw key if completely missing
        }
    }
}

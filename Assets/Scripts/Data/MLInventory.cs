using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Data
{
    /// <summary>
    /// Player Inventory & Dataset Storage.
    /// Manages 1D continuous regression, 2D discrete classification, and Biome 3 Train/Val polynomial datasets.
    /// </summary>
    public class MLInventory : MonoBehaviour
    {
        public static MLInventory Instance { get; private set; }

        public event Action OnInventoryChanged;
        public event Action<DataPoint> OnDataPointAdded;
        public event Action<ClassificationSample> OnClassificationSampleAdded;
        public event Action<DatasetStatistics> OnDatasetStatsChanged;

        [Header("Biome 1 Resources (Linear Regression)")]
        [SerializeField] private int featureCrystalsCount = 0;
        [SerializeField] private int targetShardsCount = 0;
        [SerializeField] private int weightResiduesCount = 0;
        [SerializeField] private int biasSparksCount = 0;
        [SerializeField] private int stepFluidCount = 0;

        [Header("Biome 2 Resources (Logistic Regression)")]
        [SerializeField] private int sigmoidMembranesCount = 0;
        [SerializeField] private int class0SporesCount = 0;
        [SerializeField] private int class1SporesCount = 0;
        [SerializeField] private int crossEntropyVialsCount = 0;

        [Header("Biome 3 Resources (Regularization & Polynomials)")]
        [SerializeField] private int trainFrostCoresCount = 0;
        [SerializeField] private int valSnowEchoesCount = 0;
        [SerializeField] private int l2RidgeRunesCount = 0;
        [SerializeField] private int l1LassoRibbonsCount = 0;
        [SerializeField] private int polyCatalystsCount = 0;

        [Header("Collected Empirical Datasets")]
        [SerializeField] private List<DataPoint> dataset = new List<DataPoint>();
        [SerializeField] private List<ClassificationSample> classificationDataset = new List<ClassificationSample>();
        [SerializeField] private List<DataPoint> tundraDataset = new List<DataPoint>();

        private Queue<float> pendingFeatures = new Queue<float>();
        private Queue<float> pendingTargets = new Queue<float>();
        private DatasetStatistics cachedStats = DatasetStatistics.Empty;

        public int FeatureCrystalsCount => featureCrystalsCount;
        public int FeatureCrystalXCount => featureCrystalsCount;
        public int TargetShardsCount => targetShardsCount;
        public int TargetShardYCount => targetShardsCount;
        public int PairedSamplesCount => dataset.Count;
        public int PairedDataPointCount => dataset.Count;
        public int ClassificationSamplesCount => classificationDataset.Count;
        public int TundraSamplesCount => tundraDataset.Count;
        public int TrainFrostCoresCount => trainFrostCoresCount;
        public int ValSnowEchoesCount => valSnowEchoesCount;

        public IReadOnlyList<DataPoint> Dataset => dataset.AsReadOnly();
        public IReadOnlyList<ClassificationSample> ClassificationDataset => classificationDataset.AsReadOnly();
        public IReadOnlyList<DataPoint> TundraDataset => tundraDataset.AsReadOnly();
        public DatasetStatistics LiveStats => cachedStats;
        public DatasetHealthMetrics LiveHealth => cachedHealth;

        public event Action<DatasetStatistics> OnDatasetStatsChanged;
        public event Action<DatasetHealthMetrics> OnDatasetHealthChanged;
        private DatasetStatistics cachedStats;
        private DatasetHealthMetrics cachedHealth = DatasetHealthMetrics.Default;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            RecalculateStats();
        }

        public DatasetStatistics RecalculateStats()
        {
            if (classificationDataset.Count > 0)
            {
                int n = classificationDataset.Count;
                int c0 = 0, c1 = 0;
                float minX = float.MaxValue, maxX = float.MinValue;
                float minY = float.MaxValue, maxY = float.MinValue;
                float sumX = 0f, sumY = 0f;

                for (int i = 0; i < n; i++)
                {
                    var s = classificationDataset[i];
                    if (s.labelY < 0.5f) c0++; else c1++;
                    if (s.x1 < minX) minX = s.x1;
                    if (s.x1 > maxX) maxX = s.x1;
                    if (s.x2 < minY) minY = s.x2;
                    if (s.x2 > maxY) maxY = s.x2;
                    sumX += s.x1;
                    sumY += s.x2;
                }

                float meanX = sumX / n;
                float meanY = sumY / n;
                float varX = 0f, varY = 0f;

                for (int i = 0; i < n; i++)
                {
                    float dx = classificationDataset[i].x1 - meanX;
                    float dy = classificationDataset[i].x2 - meanY;
                    varX += dx * dx;
                    varY += dy * dy;
                }

                cachedStats = new DatasetStatistics
                {
                    sampleCount = n,
                    minX = n > 0 ? minX : 0f,
                    maxX = n > 0 ? maxX : 0f,
                    minY = n > 0 ? minY : 0f,
                    maxY = n > 0 ? maxY : 0f,
                    meanX = meanX,
                    stdDevX = Mathf.Sqrt(varX / Mathf.Max(1, n)),
                    meanY = meanY,
                    stdDevY = Mathf.Sqrt(varY / Mathf.Max(1, n)),
                    class0Count = c0,
                    class1Count = c1,
                    class0Ratio = n > 0 ? (float)c0 / n : 0f,
                    class1Ratio = n > 0 ? (float)c1 / n : 0f,
                    pearsonR = 0f,
                    isClassification = true
                };
            }
            else
            {
                var src = tundraDataset.Count > 0 ? tundraDataset : dataset;
                int n = src.Count;
                if (n == 0)
                {
                    cachedStats = DatasetStatistics.Empty;
                }
                else
                {
                    float minX = float.MaxValue, maxX = float.MinValue;
                    float minY = float.MaxValue, maxY = float.MinValue;
                    float sumX = 0f, sumY = 0f;

                    for (int i = 0; i < n; i++)
                    {
                        var dp = src[i];
                        if (dp.x < minX) minX = dp.x;
                        if (dp.x > maxX) maxX = dp.x;
                        if (dp.y < minY) minY = dp.y;
                        if (dp.y > maxY) maxY = dp.y;
                        sumX += dp.x;
                        sumY += dp.y;
                    }

                    float meanX = sumX / n;
                    float meanY = sumY / n;
                    float varX = 0f, varY = 0f, covXY = 0f;

                    for (int i = 0; i < n; i++)
                    {
                        float dx = src[i].x - meanX;
                        float dy = src[i].y - meanY;
                        varX += dx * dx;
                        varY += dy * dy;
                        covXY += dx * dy;
                    }

                    float stdX = Mathf.Sqrt(varX / Mathf.Max(1, n));
                    float stdY = Mathf.Sqrt(varY / Mathf.Max(1, n));
                    float r = (stdX > 1e-6f && stdY > 1e-6f) ? (covXY / (n * stdX * stdY)) : 0f;

                    cachedStats = new DatasetStatistics
                    {
                        sampleCount = n,
                        minX = minX,
                        maxX = maxX,
                        minY = minY,
                        maxY = maxY,
                        meanX = meanX,
                        stdDevX = stdX,
                        meanY = meanY,
                        stdDevY = stdY,
                        class0Count = 0,
                        class1Count = 0,
                        class0Ratio = 0f,
                        class1Ratio = 0f,
                        pearsonR = Mathf.Clamp(r, -1f, 1f),
                        isClassification = false
                    };
                }
            }

            ComputeDatasetHealth();
            OnDatasetStatsChanged?.Invoke(cachedStats);
            OnDatasetHealthChanged?.Invoke(cachedHealth);
            return cachedStats;
        }

        private void ComputeDatasetHealth()
        {
            int n = cachedStats.sampleCount;
            if (n == 0)
            {
                cachedHealth = DatasetHealthMetrics.Default;
                return;
            }

            float balance = 100f;
            float cleanliness = 100f;
            float coverage = 100f;
            int outliers = 0;
            List<string> defects = new List<string>();

            // 1. Balance Score
            if (cachedStats.isClassification)
            {
                float skew = Mathf.Abs(cachedStats.class0Ratio - cachedStats.class1Ratio);
                balance = Mathf.Clamp01(1.0f - skew) * 100f;
                if (balance < 60f) defects.Add($"Class Imbalance ({(cachedStats.class0Ratio * 100f):F0}/{(cachedStats.class1Ratio * 100f):F0})");
            }
            else
            {
                // Feature dispersion symmetry
                float span = cachedStats.maxX - cachedStats.minX;
                balance = Mathf.Clamp01(cachedStats.stdDevX / Mathf.Max(1f, span * 0.4f)) * 100f;
            }

            // 2. Outlier Cleanliness
            if (!cachedStats.isClassification && dataset.Count > 0)
            {
                for (int i = 0; i < dataset.Count; i++)
                {
                    float expectedY = 2.45f * dataset[i].x + 1.15f;
                    if (Mathf.Abs(dataset[i].y - expectedY) > 5.5f) outliers++;
                }
                float outlierRatio = (float)outliers / dataset.Count;
                cleanliness = Mathf.Clamp01(1.0f - outlierRatio * 3.5f) * 100f;
                if (outliers > 0) defects.Add($"{outliers} High Outlier(s)");
            }

            // 3. Domain Coverage
            float domainSpan = cachedStats.maxX - cachedStats.minX;
            float spanScore = Mathf.Clamp01(domainSpan / 7.5f);
            float countScore = Mathf.Clamp01((float)n / 10f);
            coverage = (spanScore * 0.65f + countScore * 0.35f) * 100f;
            if (coverage < 60f) defects.Add("Narrow Feature Domain (Risk of Extrapolation)");

            // 4. Aggregate Health Score
            float totalScore = balance * 0.35f + cleanliness * 0.35f + coverage * 0.30f;
            totalScore = Mathf.Clamp(totalScore, 5f, 100f);

            string grade = totalScore >= 85f ? "EXCELLENT" : (totalScore >= 70f ? "GOOD" : (totalScore >= 50f ? "FAIR" : "CRITICAL / SKEWED"));
            string defectSummary = defects.Count > 0 ? string.Join(" • ", defects) : "Clean & Balanced Empirical Dataset";
            string forecast = totalScore >= 80f ? "High Generalization (Expected Test Accuracy > 90%)" :
                              (totalScore >= 55f ? "Moderate Generalization (Expected Test Accuracy ~75-85%)" :
                              "Severe Generalization Failure Predicted on Held-Out Test Set (<65%)");

            cachedHealth = new DatasetHealthMetrics
            {
                healthScore = totalScore,
                balanceScore = balance,
                cleanlinessScore = cleanliness,
                coverageScore = coverage,
                outlierCount = outliers,
                healthGrade = grade,
                primaryDefect = defectSummary,
                expectedGeneralization = forecast
            };
        }

        public void AddFeatureValue(float x, string biome = "Linear Steppes")
        {
            featureCrystalsCount++;

            if (pendingTargets.Count > 0)
            {
                float y = pendingTargets.Dequeue();
                RegisterDataPoint(new DataPoint(x, y, biome));
            }
            else
            {
                pendingFeatures.Enqueue(x);
                RegisterDataPoint(new DataPoint(x, 2.45f * x + 1.15f + UnityEngine.Random.Range(-0.35f, 0.35f), biome));
            }

            RecalculateStats();
            OnInventoryChanged?.Invoke();
        }

        public void AddTargetValue(float y, string biome = "Linear Steppes")
        {
            targetShardsCount++;

            if (pendingFeatures.Count > 0)
            {
                float x = pendingFeatures.Dequeue();
                RegisterDataPoint(new DataPoint(x, y, biome));
            }
            else
            {
                pendingTargets.Enqueue(y);
                float inferredX = (y - 1.15f) / 2.45f + UnityEngine.Random.Range(-0.15f, 0.15f);
                RegisterDataPoint(new DataPoint(inferredX, y, biome));
            }

            RecalculateStats();
            OnInventoryChanged?.Invoke();
        }

        public void AddDataPair(float x, float y, string biome = "Linear Steppes")
        {
            featureCrystalsCount++;
            targetShardsCount++;
            RegisterDataPoint(new DataPoint(x, y, biome));
            RecalculateStats();
            OnInventoryChanged?.Invoke();
        }

        public void AddClassificationSample(float x1, float x2, float labelY)
        {
            if (labelY > 0.5f) class1SporesCount++;
            else class0SporesCount++;

            ClassificationSample sample = new ClassificationSample(x1, x2, labelY);
            classificationDataset.Add(sample);
            OnClassificationSampleAdded?.Invoke(sample);
            RecalculateStats();
            OnInventoryChanged?.Invoke();
        }

        public void AddTundraSample(float x, float y, bool isVal)
        {
            if (isVal) valSnowEchoesCount++;
            else trainFrostCoresCount++;

            DataPoint dp = new DataPoint(x, y, "Variance Tundra", isVal);
            tundraDataset.Add(dp);
            OnDataPointAdded?.Invoke(dp);
            RecalculateStats();
            OnInventoryChanged?.Invoke();
        }

        public void AddResource(MLResourceType type, int amount = 1)
        {
            switch (type)
            {
                case MLResourceType.WeightResidue_W: weightResiduesCount += amount; break;
                case MLResourceType.BiasSpark_B: biasSparksCount += amount; break;
                case MLResourceType.StepFluid_Alpha: stepFluidCount += amount; break;
                case MLResourceType.SigmoidMembrane_Sigma: sigmoidMembranesCount += amount; break;
                case MLResourceType.Class0_PurpleSpore: class0SporesCount += amount; break;
                case MLResourceType.Class1_AzureSpore: class1SporesCount += amount; break;
                case MLResourceType.CrossEntropyVial: crossEntropyVialsCount += amount; break;
                case MLResourceType.L2_RidgeRune: l2RidgeRunesCount += amount; break;
                case MLResourceType.L1_LassoRibbon: l1LassoRibbonsCount += amount; break;
                case MLResourceType.PolyCatalyst: polyCatalystsCount += amount; break;
            }
            RecalculateStats();
            OnInventoryChanged?.Invoke();
        }

        private void RegisterDataPoint(DataPoint dp)
        {
            dataset.Add(dp);
            OnDataPointAdded?.Invoke(dp);
        }

        public float[] GetXArray()
        {
            float[] arr = new float[dataset.Count];
            for (int i = 0; i < dataset.Count; i++) arr[i] = dataset[i].x;
            return arr;
        }

        public float[] GetYArray()
        {
            float[] arr = new float[dataset.Count];
            for (int i = 0; i < dataset.Count; i++) arr[i] = dataset[i].y;
            return arr;
        }

        public void GetClassificationArrays(out float[] X1, out float[] X2, out float[] Y)
        {
            int count = classificationDataset.Count;
            X1 = new float[count];
            X2 = new float[count];
            Y = new float[count];

            for (int i = 0; i < count; i++)
            {
                X1[i] = classificationDataset[i].x1;
                X2[i] = classificationDataset[i].x2;
                Y[i] = classificationDataset[i].labelY;
            }
        }

        public void GetTundraTrainValArrays(float splitRatio, out float[] xTrain, out float[] yTrain, out float[] xVal, out float[] yVal)
        {
            List<DataPoint> trainList = new List<DataPoint>();
            List<DataPoint> valList = new List<DataPoint>();

            if (tundraDataset.Count > 0)
            {
                for (int i = 0; i < tundraDataset.Count; i++)
                {
                    if (tundraDataset[i].isValidation) valList.Add(tundraDataset[i]);
                    else trainList.Add(tundraDataset[i]);
                }
            }

            // Fallback split if dataset is generic
            if (trainList.Count == 0 || valList.Count == 0)
            {
                var source = tundraDataset.Count > 0 ? tundraDataset : dataset;
                int splitIndex = Mathf.FloorToInt(source.Count * splitRatio);
                for (int i = 0; i < source.Count; i++)
                {
                    if (i < splitIndex) trainList.Add(source[i]);
                    else valList.Add(source[i]);
                }
            }

            xTrain = new float[trainList.Count];
            yTrain = new float[trainList.Count];
            for (int i = 0; i < trainList.Count; i++) { xTrain[i] = trainList[i].x; yTrain[i] = trainList[i].y; }

            xVal = new float[valList.Count];
            yVal = new float[valList.Count];
            for (int i = 0; i < valList.Count; i++) { xVal[i] = valList[i].x; yVal[i] = valList[i].y; }
        }

        public void ExportToSaveData(GameSaveData saveData)
        {
            saveData.featureCrystalsCount = featureCrystalsCount;
            saveData.targetShardsCount = targetShardsCount;
            saveData.weightResiduesCount = weightResiduesCount;
            saveData.biasSparksCount = biasSparksCount;
            saveData.stepFluidCount = stepFluidCount;
            saveData.sigmoidMembranesCount = sigmoidMembranesCount;
            saveData.class0SporesCount = class0SporesCount;
            saveData.class1SporesCount = class1SporesCount;
            saveData.crossEntropyVialsCount = crossEntropyVialsCount;
            saveData.collectedDataset = new List<DataPoint>(dataset);
        }

        public void ImportFromSaveData(GameSaveData saveData)
        {
            featureCrystalsCount = saveData.featureCrystalsCount;
            targetShardsCount = saveData.targetShardsCount;
            weightResiduesCount = saveData.weightResiduesCount;
            biasSparksCount = saveData.biasSparksCount;
            stepFluidCount = saveData.stepFluidCount;
            sigmoidMembranesCount = saveData.sigmoidMembranesCount;
            class0SporesCount = saveData.class0SporesCount;
            class1SporesCount = saveData.class1SporesCount;
            crossEntropyVialsCount = saveData.crossEntropyVialsCount;
            dataset = new List<DataPoint>(saveData.collectedDataset);
            RecalculateStats();
            OnInventoryChanged?.Invoke();
        }

        public void ResetInventory()
        {
            featureCrystalsCount = 0;
            targetShardsCount = 0;
            weightResiduesCount = 0;
            biasSparksCount = 0;
            stepFluidCount = 0;
            sigmoidMembranesCount = 0;
            class0SporesCount = 0;
            class1SporesCount = 0;
            crossEntropyVialsCount = 0;
            trainFrostCoresCount = 0;
            valSnowEchoesCount = 0;
            dataset.Clear();
            classificationDataset.Clear();
            tundraDataset.Clear();
            pendingFeatures.Clear();
            pendingTargets.Clear();
            RecalculateStats();
            OnInventoryChanged?.Invoke();
        }
    }
}

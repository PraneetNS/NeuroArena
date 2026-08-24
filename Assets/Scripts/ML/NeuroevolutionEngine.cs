using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public struct GenomeGene
    {
        public string parameterName;
        public float value;
        public float minValue;
        public float maxValue;
        public float mutationRate;
    }

    [Serializable]
    public class IndividualGenome
    {
        public string genomeId;
        public List<GenomeGene> genes = new List<GenomeGene>();
        public float rawFitness;
        public float adjustedFitness;
        public int speciesId;
        public int generation;

        public IndividualGenome Clone()
        {
            var clone = new IndividualGenome
            {
                genomeId = Guid.NewGuid().ToString().Substring(0, 8),
                rawFitness = this.rawFitness,
                adjustedFitness = this.adjustedFitness,
                speciesId = this.speciesId,
                generation = this.generation
            };
            foreach (var g in genes)
            {
                clone.genes.Add(new GenomeGene
                {
                    parameterName = g.parameterName,
                    value = g.value,
                    minValue = g.minValue,
                    maxValue = g.maxValue,
                    mutationRate = g.mutationRate
                });
            }
            return clone;
        }

        public float GetGene(string name, float fallback = 0f)
        {
            for (int i = 0; i < genes.Count; i++)
            {
                if (genes[i].parameterName == name) return genes[i].value;
            }
            return fallback;
        }
    }

    [Serializable]
    public class NeuroevolutionConfig
    {
        public int populationSize = 32;
        public float mutationChance = 0.15f;
        public float mutationStrength = 0.2f;
        public float crossoverRate = 0.75f;
        public float elitismRatio = 0.1f;
        public int tournamentSize = 4;
        public float speciationThreshold = 0.35f;
    }

    /// <summary>
    /// Genetic Algorithm & Neuroevolution Hyperparameter Optimizer.
    /// Evolves neural architecture hyperparameters and agent decision weights across generations
    /// with speciation, tournament selection, uniform/blend crossover, and elite retention.
    /// </summary>
    public class NeuroevolutionEngine
    {
        public NeuroevolutionConfig Config { get; private set; }
        public List<IndividualGenome> Population { get; private set; } = new List<IndividualGenome>();
        public int CurrentGeneration { get; private set; } = 0;
        public IndividualGenome BestGenomeEver { get; private set; }

        public NeuroevolutionEngine(NeuroevolutionConfig config = null)
        {
            Config = config ?? new NeuroevolutionConfig();
        }

        public void InitializePopulation(List<GenomeGene> templateGenes)
        {
            Population.Clear();
            CurrentGeneration = 0;
            var rand = new System.Random();

            for (int i = 0; i < Config.populationSize; i++)
            {
                var genome = new IndividualGenome
                {
                    genomeId = Guid.NewGuid().ToString().Substring(0, 8),
                    generation = 0
                };

                foreach (var tg in templateGenes)
                {
                    float initVal = (float)(tg.minValue + rand.NextDouble() * (tg.maxValue - tg.minValue));
                    genome.genes.Add(new GenomeGene
                    {
                        parameterName = tg.parameterName,
                        value = initVal,
                        minValue = tg.minValue,
                        maxValue = tg.maxValue,
                        mutationRate = tg.mutationRate > 0 ? tg.mutationRate : Config.mutationChance
                    });
                }
                Population.Add(genome);
            }
        }

        public IndividualGenome StepGeneration(Func<IndividualGenome, float> fitnessEvaluator)
        {
            var rand = new System.Random();

            // Evaluate fitness
            for (int i = 0; i < Population.Count; i++)
            {
                Population[i].rawFitness = fitnessEvaluator(Population[i]);
                if (BestGenomeEver == null || Population[i].rawFitness > BestGenomeEver.rawFitness)
                {
                    BestGenomeEver = Population[i].Clone();
                }
            }

            // Sort population by raw fitness descending
            Population.Sort((a, b) => b.rawFitness.CompareTo(a.rawFitness));

            int eliteCount = Mathf.Max(1, Mathf.RoundToInt(Config.populationSize * Config.elitismRatio));
            var nextGeneration = new List<IndividualGenome>();

            // Retain elites
            for (int i = 0; i < eliteCount && i < Population.Count; i++)
            {
                var elite = Population[i].Clone();
                elite.generation = CurrentGeneration + 1;
                nextGeneration.Add(elite);
            }

            // Fill remaining population with offspring
            while (nextGeneration.Count < Config.populationSize)
            {
                var parentA = TournamentSelect(Config.tournamentSize, rand);
                var parentB = TournamentSelect(Config.tournamentSize, rand);

                IndividualGenome offspring;
                if (rand.NextDouble() < Config.crossoverRate)
                {
                    offspring = Crossover(parentA, parentB, rand);
                }
                else
                {
                    offspring = parentA.Clone();
                }

                Mutate(offspring, rand);
                offspring.generation = CurrentGeneration + 1;
                nextGeneration.Add(offspring);
            }

            Population = nextGeneration;
            CurrentGeneration++;
            return BestGenomeEver;
        }

        private IndividualGenome TournamentSelect(int size, System.Random rand)
        {
            IndividualGenome best = null;
            for (int i = 0; i < size; i++)
            {
                int idx = rand.Next(Population.Count);
                var candidate = Population[idx];
                if (best == null || candidate.rawFitness > best.rawFitness)
                {
                    best = candidate;
                }
            }
            return best ?? Population[0];
        }

        private IndividualGenome Crossover(IndividualGenome p1, IndividualGenome p2, System.Random rand)
        {
            var child = new IndividualGenome
            {
                genomeId = Guid.NewGuid().ToString().Substring(0, 8)
            };

            for (int i = 0; i < p1.genes.Count; i++)
            {
                var g1 = p1.genes[i];
                var g2 = p2.genes[i];

                // Blend crossover (BLX-alpha with alpha=0.5)
                float alpha = 0.5f;
                float minV = Mathf.Min(g1.value, g2.value);
                float maxV = Mathf.Max(g1.value, g2.value);
                float range = maxV - minV;
                float lower = minV - range * alpha;
                float upper = maxV + range * alpha;
                float childVal = Mathf.Clamp((float)(lower + rand.NextDouble() * (upper - lower)), g1.minValue, g1.maxValue);

                child.genes.Add(new GenomeGene
                {
                    parameterName = g1.parameterName,
                    value = childVal,
                    minValue = g1.minValue,
                    maxValue = g1.maxValue,
                    mutationRate = (g1.mutationRate + g2.mutationRate) * 0.5f
                });
            }
            return child;
        }

        private void Mutate(IndividualGenome genome, System.Random rand)
        {
            for (int i = 0; i < genome.genes.Count; i++)
            {
                var gene = genome.genes[i];
                if (rand.NextDouble() < gene.mutationRate)
                {
                    // Gaussian perturbation
                    double u1 = 1.0 - rand.NextDouble();
                    double u2 = 1.0 - rand.NextDouble();
                    double randStdNormal = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
                    float delta = (float)(randStdNormal * (gene.maxValue - gene.minValue) * Config.mutationStrength);

                    gene.value = Mathf.Clamp(gene.value + delta, gene.minValue, gene.maxValue);
                    genome.genes[i] = gene;
                }
            }
        }
    }
}

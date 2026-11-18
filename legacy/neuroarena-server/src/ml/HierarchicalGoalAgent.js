/**
 * HierarchicalGoalAgent.js
 *
 * Implements Hierarchical Goal-Conditioned Reinforcement Learning with
 * Hindsight Experience Replay (HER).
 *
 * Architecture:
 * - High-Level Manager Policy: Selects intermediate target state sub-goals g in S every c steps.
 * - Low-Level Worker Policy: Outputs fine-grained motor controls a conditioned on (s, g).
 * - Hindsight Experience Replay: Re-labels sparse-reward failed trajectories with actually
 *   achieved terminal states s_T as virtual goals, transforming zero-reward rollouts into positive gradients.
 *
 * References:
 * - Andrychowicz et al. (NeurIPS 2017) "Hindsight Experience Replay"
 * - Nachum et al. (NeurIPS 2018) "Data-Efficient Hierarchical Reinforcement Learning"
 */

class HierarchicalGoalAgent {
    /**
     * @param {Object} options
     * @param {number} [options.stateDim=6] - Dimension of state representation
     * @param {number} [options.actionDim=3] - Dimension of primitive action vector
     * @param {number} [options.goalPeriod=10] - Number of worker steps before manager sets new sub-goal
     * @param {number} [options.herRatio=4] - HER relabeling ratio per actual trajectory
     * @param {number} [options.distanceThreshold=1.5] - L2 distance for sparse binary goal attainment
     */
    constructor(options = {}) {
        this.stateDim = options.stateDim || 6;
        this.actionDim = options.actionDim || 3;
        this.goalPeriod = options.goalPeriod || 10;
        this.herRatio = options.herRatio || 4;
        this.distanceThreshold = options.distanceThreshold || 1.5;

        // Linear policy parameter weights for manager and worker
        // Manager: s -> sub-goal g (dimension = stateDim)
        this.managerWeights = Array.from({ length: this.stateDim }, () => new Float32Array(this.stateDim));
        // Worker: [s, g] -> action a (dimension = actionDim)
        this.workerWeights = Array.from({ length: this.stateDim * 2 }, () => new Float32Array(this.actionDim));

        this.replayBuffer = [];
        this.maxBufferSize = 2000;
        this.initializeWeights();
    }

    initializeWeights() {
        for (let i = 0; i < this.stateDim; i++) {
            for (let j = 0; j < this.stateDim; j++) {
                this.managerWeights[i][j] = (i === j) ? 1.0 : (Math.random() - 0.5) * 0.1;
            }
        }
        for (let i = 0; i < this.stateDim * 2; i++) {
            for (let j = 0; j < this.actionDim; j++) {
                this.workerWeights[i][j] = (Math.random() - 0.5) * 0.2;
            }
        }
    }

    /**
     * Manager policy: predicts sub-goal g_t given current state s_t
     */
    predictSubGoal(state) {
        const subGoal = new Float32Array(this.stateDim);
        for (let j = 0; j < this.stateDim; j++) {
            let sum = 0;
            for (let i = 0; i < this.stateDim; i++) {
                sum += state[i] * this.managerWeights[i][j];
            }
            subGoal[j] = sum;
        }
        return subGoal;
    }

    /**
     * Worker policy: predicts primitive action a_t given state s_t and sub-goal g_t
     */
    predictWorkerAction(state, subGoal) {
        const inputVec = new Float32Array(this.stateDim * 2);
        for (let i = 0; i < this.stateDim; i++) {
            inputVec[i] = state[i];
            inputVec[i + this.stateDim] = subGoal[i] - state[i]; // Relative goal offset
        }

        const action = new Float32Array(this.actionDim);
        for (let j = 0; j < this.actionDim; j++) {
            let sum = 0;
            for (let i = 0; i < this.stateDim * 2; i++) {
                sum += inputVec[i] * this.workerWeights[i][j];
            }
            action[j] = Math.tanh(sum); // Bounded motor output [-1, +1]
        }
        return action;
    }

    /**
     * Sparse binary reward: 0 if within Euclidean distance threshold, -1 otherwise
     */
    computeSparseReward(state, goal) {
        let distSq = 0;
        for (let i = 0; i < this.stateDim; i++) {
            const diff = state[i] - goal[i];
            distSq += diff * diff;
        }
        return Math.sqrt(distSq) <= this.distanceThreshold ? 0.0 : -1.0;
    }

    /**
     * Processes an episode trajectory using Hindsight Experience Replay (HER)
     * For every failed trajectory, samples future states as achieved goals and inserts
     * synthetic successful experiences with reward = 0 into the replay buffer.
     *
     * @param {Array<{state: Float32Array, action: Float32Array, nextState: Float32Array, goal: Float32Array}>} trajectory
     * @returns {Object} { originalTransitions: number, herTransitionsAdded: number, bufferSize: number }
     */
    storeTrajectoryWithHER(trajectory) {
        const T = trajectory.length;
        if (T === 0) return { originalTransitions: 0, herTransitionsAdded: 0, bufferSize: this.replayBuffer.length };

        let herAdded = 0;

        // 1. Store original transitions
        for (let t = 0; t < T; t++) {
            const step = trajectory[t];
            const reward = this.computeSparseReward(step.nextState, step.goal);
            this.pushToBuffer({ ...step, reward, isHindsight: false });
        }

        // 2. Apply HER: 'future' strategy
        for (let t = 0; t < T; t++) {
            for (let k = 0; k < this.herRatio; k++) {
                // Sample future index in [t, T - 1]
                const futureIdx = t + Math.floor(Math.random() * (T - t));
                const syntheticGoal = trajectory[futureIdx].nextState;

                const step = trajectory[t];
                const syntheticReward = this.computeSparseReward(step.nextState, syntheticGoal);

                this.pushToBuffer({
                    state: step.state,
                    action: step.action,
                    nextState: step.nextState,
                    goal: syntheticGoal,
                    reward: syntheticReward,
                    isHindsight: true
                });
                herAdded++;
            }
        }

        return {
            originalTransitions: T,
            herTransitionsAdded: herAdded,
            bufferSize: this.replayBuffer.length
        };
    }

    pushToBuffer(transition) {
        if (this.replayBuffer.length >= this.maxBufferSize) {
            this.replayBuffer.shift();
        }
        this.replayBuffer.push(transition);
    }

    getReplayStatistics() {
        const total = this.replayBuffer.length;
        const hindsightCount = this.replayBuffer.filter(t => t.isHindsight).length;
        const successCount = this.replayBuffer.filter(t => t.reward === 0.0).length;

        return {
            totalTransitions: total,
            hindsightRatio: total > 0 ? (hindsightCount / total) : 0,
            successRate: total > 0 ? (successCount / total) : 0
        };
    }
}

module.exports = HierarchicalGoalAgent;

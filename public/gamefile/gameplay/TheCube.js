/**
 * TheCube.js
 * Ultra-Lightweight Quantum Superposition Simulation for Game AI
 * Zero dependencies, minimal footprint, on-demand evaluation ("เห็นค่อยคิด ค่อยทำ").
 */
(function(global) {
  'use strict';

  const GOLDEN_PHASE = 2.399963229728653; // (3 - sqrt(5)) * pi

  /**
   * Qubit
   * Collapses an array of candidate actions [{ action, weight, target, ... }]
   * using simulated quantum phase interference and Born rule measurement.
   */
  function Qubit(candidates, options) {
    if (!candidates || candidates.length === 0) return null;
    const len = candidates.length;
    if (len === 1) return candidates[0];

    const opts = options || {};
    const temperature = (opts.temperature !== undefined) ? opts.temperature : 0.15;
    const agentPhase = (opts.agentPhase !== undefined) ? opts.agentPhase : (Date.now() * 0.001);
    const interference = (opts.interferencePower !== undefined) ? opts.interferencePower : 0.25;

    let totalProb = 0.0;
    const probs = new Float32Array(len);

    for (let i = 0; i < len; i++) {
      const c = candidates[i];
      let w = (c && c.weight !== undefined) ? Math.max(0.0001, c.weight) : 0.0001;

      if (temperature > 0.01) {
        w = Math.exp(Math.min(8.0, w / (temperature + 0.05)));
      }

      const phase = agentPhase + i * GOLDEN_PHASE;
      const waveFactor = 1.0 + interference * Math.cos(phase);
      const effectiveWeight = Math.max(0.00001, w * waveFactor);

      probs[i] = effectiveWeight;
      totalProb += effectiveWeight;
    }

    if (totalProb <= 0.0) {
      return candidates[Math.floor(Math.random() * len)];
    }

    const threshold = Math.random() * totalProb;
    let accumulated = 0.0;
    let selectedIdx = len - 1;

    for (let i = 0; i < len; i++) {
      accumulated += probs[i];
      if (threshold <= accumulated) {
        selectedIdx = i;
        break;
      }
    }

    return candidates[selectedIdx];
  }

  const TheCube = {
    Qubit: Qubit,
    compute: Qubit,
    collapse: Qubit,
    GOLDEN_PHASE: GOLDEN_PHASE
  };

  global.Qubit = Qubit;
  global.TheCube = TheCube;
  global.computeQuantumSuperpositionAI = Qubit;

})(typeof window !== 'undefined' ? window : globalThis);

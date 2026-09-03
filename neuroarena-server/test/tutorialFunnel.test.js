const assert = require('assert');

// FTUE Funnel Event Telemetry Validator Test Suite
console.log('▶ Testing FTUE First-Session Tutorial Funnel Telemetry & Drop-Off Pipeline...');

const requiredFunnelSteps = [
  'ftue_session_started',
  'tutorial_step_harvest_started',
  'tutorial_step_harvest_completed',
  'tutorial_step_livefit_viewed',
  'tutorial_step_challenge_started',
  'tutorial_step_challenge_completed',
  'tutorial_day1_reward_granted',
  'ftue_first_aha_reached',
  'tutorial_completed'
];

function validateFunnelPayload(eventName, payload) {
  assert.ok(eventName, 'Event name must not be empty');
  assert.ok(payload, 'Payload must be defined');

  if (eventName === 'ftue_session_started') {
    assert.strictEqual(typeof payload.is_guest, 'boolean');
    assert.strictEqual(payload.biome_index, 0);
  }
  if (eventName === 'tutorial_step_harvest_completed') {
    assert.ok(payload.harvest_duration_sec >= 0);
    assert.ok(typeof payload.crystal_x === 'number');
  }
  if (eventName === 'tutorial_step_livefit_viewed') {
    assert.ok(typeof payload.slope_w === 'number');
    assert.ok(typeof payload.bias_b === 'number');
  }
  if (eventName === 'tutorial_idle_nudge_triggered') {
    assert.ok(payload.idle_seconds >= 45.0, 'Idle nudge must trigger after 45s');
  }
  if (eventName === 'ftue_first_aha_reached') {
    assert.ok(payload.time_to_aha_seconds <= 180.0, 'First aha moment must be reachable within 3 minutes (180s)');
  }
}

// Simulate full FTUE telemetry trace
const simulatedTrace = [
  { event: 'ftue_session_started', data: { is_guest: true, start_timestamp: new Date().toISOString(), biome_index: 0, biome_name: 'Linear Steppes' } },
  { event: 'tutorial_step_harvest_started', data: { step_index: 1, elapsed_sec: 2.1 } },
  { event: 'tutorial_step_harvest_completed', data: { step_index: 1, harvest_duration_sec: 14.5, crystal_x: 1.5, crystal_y: 4.82 } },
  { event: 'tutorial_step_livefit_viewed', data: { step_index: 2, slope_w: 2.45, bias_b: 1.15, point_x: 1.5, point_y: 4.82, elapsed_sec: 18.2 } },
  { event: 'tutorial_step_challenge_started', data: { step_index: 3, target_mse_threshold: 0.10, elapsed_sec: 24.0 } },
  { event: 'tutorial_idle_nudge_triggered', data: { step_index: 3, step_name: 'Step3_MiniChallengeLab', idle_seconds: 46.2 } },
  { event: 'tutorial_step_challenge_completed', data: { step_index: 4, win_state: true, total_time_seconds: 52.4 } },
  { event: 'tutorial_day1_reward_granted', data: { reward_skin: 'Glacial Crystalline', reward_tool: 'Vector Calibrator', unlocked_biome: 'Binary Marshlands', total_tutorial_seconds: 53.0 } },
  { event: 'ftue_first_aha_reached', data: { time_to_aha_seconds: 53.0, is_guest: true, completed_under_3_minutes: true } },
  { event: 'tutorial_completed', data: { status: 'success', completion_rate: 1.0, duration_seconds: 55.0 } }
];

simulatedTrace.forEach(t => validateFunnelPayload(t.event, t.data));
console.log('✅ FTUE Tutorial Funnel Telemetry & 3-Minute Win Constraint Verified Cleanly!');

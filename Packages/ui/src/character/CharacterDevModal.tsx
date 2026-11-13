/**
 * Character Development & Animation Inspection Modal.
 * Dev Route: /#/character-dev
 * 
 * Features:
 * - Rig specifications: CC0 Skinned Model (Quaternius), 2,908 tris, 29 bones
 * - Real-time animation switcher with smooth cross-fading:
 *   idle, walk, run, jump, land, gather, turn_in_place, wave, duck, death, hitreact
 * - Playback speed rate controller (0.1x to 2.5x)
 * - Speed-matched Foot IK ground-conforming toggle
 * - Verlet scarf wind reaction slider
 * - Lantern point light intensity controller
 */

import React, { useState, useEffect } from 'react';
import { Player } from '@na/engine';
import { Button } from '../components/Button.js';
import { Badge } from '../components/Badge.js';

export interface CharacterDevModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
}

export const CharacterDevModal: React.FC<CharacterDevModalProps> = ({
  isOpen,
  onClose,
  player
}) => {
  const [activeAnim, setActiveAnim] = useState<string>('idle');
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);
  const [footIKEnabled, setFootIKEnabledState] = useState<boolean>(true);
  const [scarfWind, setScarfWindState] = useState<number>(1.0);
  const [lanternIntensity, setLanternIntensityState] = useState<number>(2.2);

  useEffect(() => {
    if (player) {
      setActiveAnim(player.activeAnimName || 'idle');
      setFootIKEnabledState(player.isFootIKEnabled);
      setPlaybackSpeedState(player.playbackSpeed);
      setScarfWindState(player.scarfWindStrength);
      if (player.lanternLight) {
        setLanternIntensityState(player.lanternLight.intensity);
      }
    }
  }, [player, isOpen]);

  if (!isOpen) return null;

  const animationList = [
    { id: 'idle', label: 'Idle', group: 'Locomotion' },
    { id: 'walk', label: 'Walk', group: 'Locomotion' },
    { id: 'run', label: 'Run', group: 'Locomotion' },
    { id: 'jump', label: 'Jump', group: 'Airborne' },
    { id: 'land', label: 'Land', group: 'Airborne' },
    { id: 'gather', label: 'Gather / Punch', group: 'Actions' },
    { id: 'turn_in_place', label: 'Turn in Place', group: 'Locomotion' },
    { id: 'wave', label: 'Wave', group: 'Emotes' },
    { id: 'duck', label: 'Duck / Crouch', group: 'Actions' },
    { id: 'hitreact', label: 'Hit React', group: 'Combat' },
    { id: 'death', label: 'Collapse', group: 'Combat' }
  ];

  const handlePlayAnimation = (animId: string) => {
    if (player) {
      player.playAnimation(animId, 0.2);
      setActiveAnim(animId);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeedState(newSpeed);
    if (player) {
      player.setPlaybackSpeed(newSpeed);
    }
  };

  const handleToggleFootIK = () => {
    const nextVal = !footIKEnabled;
    setFootIKEnabledState(nextVal);
    if (player) {
      player.setFootIKEnabled(nextVal);
    }
  };

  const handleScarfWindChange = (newWind: number) => {
    setScarfWindState(newWind);
    if (player) {
      player.scarfWindStrength = newWind;
    }
  };

  const handleLanternIntensityChange = (newIntensity: number) => {
    setLanternIntensityState(newIntensity);
    if (player && player.lanternLight) {
      player.lanternLight.intensity = newIntensity;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#f8fafc',
        fontFamily: "'IBM Plex Sans', sans-serif"
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#090d16'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🧙</span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: '#f1f5f9'
                }}
              >
                Character Studio & Blend Tree
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                Quaternius CC0 Rigged Scholar • AnimationMixer & Speed-Matched Foot IK
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant="success">CC0 Public Domain</Badge>
            <Badge variant="neutral">2,908 Tris</Badge>
            <Badge variant="neutral">29 Bones</Badge>
            <Button size="sm" variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Body Content */}
        <div
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}
        >
          {/* Rig Metadata Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              backgroundColor: '#1e293b',
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #334155'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                Geometry Budget
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#38bdf8' }}>
                2,908 / 10,000 tris
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                Skeleton Joints
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#38bdf8' }}>
                29 / 60 bones
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                Payload Size
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#f59e0b' }}>
                453 KB glTF Binary
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
                Active State
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#10b981' }}>
                {activeAnim.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Animation Actions Grid */}
          <div>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🎬</span> Animation Clips (Cross-Fade Blend Tree)
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '10px'
              }}
            >
              {animationList.map((anim) => {
                const isActive = activeAnim === anim.id;
                return (
                  <button
                    key={anim.id}
                    onClick={() => handlePlayAnimation(anim.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: isActive ? '1px solid #38bdf8' : '1px solid #334155',
                      backgroundColor: isActive ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
                      color: isActive ? '#38bdf8' : '#e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>
                      {anim.group}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>
                      {anim.label}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#38bdf8',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ● Active Action
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tuning Sliders & IK Controls */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              backgroundColor: '#161f30',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid #1e293b'
            }}
          >
            {/* Speed Matching & Foot IK */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginBottom: '6px'
                  }}
                >
                  <span style={{ color: '#cbd5e1' }}>Animation Time Scale</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{playbackSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.5"
                  step="0.05"
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                    CPU Terrain Foot IK
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Speed-matched ankle height & slope conform
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={footIKEnabled ? 'primary' : 'secondary'}
                  onClick={handleToggleFootIK}
                >
                  {footIKEnabled ? 'IK Enabled' : 'Disabled'}
                </Button>
              </div>
            </div>

            {/* Scarf & Carried Lantern */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginBottom: '6px'
                  }}
                >
                  <span style={{ color: '#cbd5e1' }}>Verlet Scarf Wind Drag</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{scarfWind.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="3.0"
                  step="0.1"
                  value={scarfWind}
                  onChange={(e) => handleScarfWindChange(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#f59e0b' }}
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginBottom: '6px'
                  }}
                >
                  <span style={{ color: '#cbd5e1' }}>Hand Lantern Amber Light</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{lanternIntensity.toFixed(1)} lm</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="5.0"
                  step="0.2"
                  value={lanternIntensity}
                  onChange={(e) => handleLanternIntensityChange(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#f59e0b' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#090d16'
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Route: <code style={{ color: '#94a3b8' }}>/#/character-dev</code> • Fully Integrated with Third-Person Camera
          </div>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

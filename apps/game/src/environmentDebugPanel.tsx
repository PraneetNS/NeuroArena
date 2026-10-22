/**
 * Environment & Graphics Debug Panel for NeuroArena.
 * Built with packages/ui design system: Panel, Slider, Toggle, Button, Badge.
 * Provides live controls for:
 * - Time of day (0 to 24h) and golden-hour inspection
 * - Feature toggles: Sky, Clouds, Sun, Fog, Light Shafts, Grass, Foliage, Water, Post-Processing
 * - Wind strength & Water level
 * - Quality tier controls (Low, Medium, High)
 */

import React, { useState, useEffect } from 'react';
import {
  Panel,
  PanelHeader,
  PanelBody,
  PanelFooter,
  Button,
  Slider,
  Toggle,
  Badge,
  KeyHint
} from '@na/ui';
import { EnvironmentManager } from '@na/engine';

export interface EnvironmentDebugProps {
  environment: EnvironmentManager;
  isOpen: boolean;
  onClose: () => void;
  onQualityChange: (tier: 'low' | 'medium' | 'high') => void;
}

export const EnvironmentDebugPanel: React.FC<EnvironmentDebugProps> = ({
  environment,
  isOpen,
  onClose,
  onQualityChange
}) => {
  const [timeHours, setTimeHours] = useState(environment.timeOfDay.timeHours);
  const [isPaused, setIsPaused] = useState(environment.timeOfDay.isPaused);
  const [windStrength, setWindStrength] = useState(environment.windStrength);
  const [waterLevel, setWaterLevel] = useState(environment.water.waterLevel);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');

  // Feature Toggles
  const [features, setFeatures] = useState({ ...environment.features });
  const [postConfig, setPostConfig] = useState({ ...environment.postProcessing.config });

  // Sync state periodically with time of day progression
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeHours(environment.timeOfDay.timeHours);
    }, 250);
    return () => clearInterval(interval);
  }, [environment]);

  if (!isOpen) return null;

  const handleTimeChange = (hours: number) => {
    setTimeHours(hours);
    environment.timeOfDay.setTime(hours);
  };

  const handleWindChange = (val: number) => {
    setWindStrength(val);
    environment.windStrength = val;
  };

  const handleWaterLevelChange = (val: number) => {
    setWaterLevel(val);
    environment.water.setWaterLevel(val);
  };

  const handleToggleFeature = (key: keyof typeof features) => {
    const nextVal = !features[key];
    setFeatures((prev) => ({ ...prev, [key]: nextVal }));
    environment.setFeature(key, nextVal);
  };

  const handleTogglePost = (key: keyof typeof postConfig) => {
    environment.postProcessing.toggleEffect(key as any);
    setPostConfig({ ...environment.postProcessing.config });
  };

  const handleTierSelect = (tier: 'low' | 'medium' | 'high') => {
    setQuality(tier);
    onQualityChange(tier);
    setFeatures({ ...environment.features });
    setPostConfig({ ...environment.postProcessing.config });
  };

  const formatTime = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.floor((h - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const isGoldenHour = environment.timeOfDay.getState().isGoldenHour;

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        width: '380px',
        maxHeight: 'calc(100vh - 2rem)',
        overflowY: 'auto',
        zIndex: 1000,
        pointerEvents: 'auto'
      }}
    >
      <Panel variant="raised">
        <PanelHeader
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Environment Debug</span>
              {isGoldenHour && <Badge variant="accent">Golden Hour</Badge>}
            </div>
          }
          subtitle="TSL Atmosphere & Painterly Engine"
          action={
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          }
        />

        <PanelBody style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Quality Tier Selector */}
          <div>
            <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
              QUALITY TIER
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['low', 'medium', 'high'] as const).map((tier) => (
                <Button
                  key={tier}
                  variant={quality === tier ? 'primary' : 'secondary'}
                  size="sm"
                  style={{ flex: 1, textTransform: 'capitalize' }}
                  onClick={() => handleTierSelect(tier)}
                >
                  {tier}
                </Button>
              ))}
            </div>
          </div>

          {/* Time of Day Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                TIME OF DAY ({formatTime(timeHours)})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const nextPause = !isPaused;
                  setIsPaused(nextPause);
                  environment.timeOfDay.isPaused = nextPause;
                }}
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </Button>
            </div>
            <Slider
              value={Math.round(timeHours * 10) / 10}
              min={0}
              max={24}
              step={0.1}
              unit="h"
              onChange={handleTimeChange}
            />
            {/* Quick Time Presets */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => handleTimeChange(7.0)}>
                Dawn (7h)
              </Button>
              <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => handleTimeChange(12.0)}>
                Noon (12h)
              </Button>
              <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => handleTimeChange(18.2)}>
                Golden (18h)
              </Button>
              <Button variant="ghost" size="sm" style={{ flex: 1 }} onClick={() => handleTimeChange(23.5)}>
                Night (23h)
              </Button>
            </div>
          </div>

          {/* Environment Parameters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Slider
              label="Wind Strength & Gusts"
              value={Math.round(windStrength * 100) / 100}
              min={0}
              max={2.0}
              step={0.05}
              onChange={handleWindChange}
            />
            <Slider
              label="Water Basin Elevation"
              value={Math.round(waterLevel * 10) / 10}
              min={0}
              max={25.0}
              step={0.5}
              unit="m"
              onChange={handleWaterLevelChange}
            />
          </div>

          {/* Environment Feature Toggles */}
          <div>
            <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
              ENVIRONMENT SYSTEMS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Toggle
                label="Sky Atmosphere"
                checked={features.sky}
                onChange={() => handleToggleFeature('sky')}
              />
              <Toggle
                label="Drifting Clouds"
                checked={features.clouds}
                onChange={() => handleToggleFeature('clouds')}
              />
              <Toggle
                label="Dynamic Sun"
                checked={features.sun}
                onChange={() => handleToggleFeature('sun')}
              />
              <Toggle
                label="Height Fog"
                checked={features.fog}
                onChange={() => handleToggleFeature('fog')}
              />
              <Toggle
                label="Light Shafts"
                checked={features.lightShafts}
                onChange={() => handleToggleFeature('lightShafts')}
              />
              <Toggle
                label="Instanced Grass"
                checked={features.grass}
                onChange={() => handleToggleFeature('grass')}
              />
              <Toggle
                label="Trees & Rocks"
                checked={features.foliage}
                onChange={() => handleToggleFeature('foliage')}
              />
              <Toggle
                label="Water Plane"
                checked={features.water}
                onChange={() => handleToggleFeature('water')}
              />
            </div>
          </div>

          {/* Post-Processing Toggles */}
          <div>
            <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
              POST-PROCESSING PASSES
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Toggle
                label="Bloom Glow"
                checked={postConfig.enableBloom}
                onChange={() => handleTogglePost('enableBloom')}
              />
              <Toggle
                label="Color Grade LUT"
                checked={postConfig.enableColorGrade}
                onChange={() => handleTogglePost('enableColorGrade')}
              />
              <Toggle
                label="Vignette Falloff"
                checked={postConfig.enableVignette}
                onChange={() => handleTogglePost('enableVignette')}
              />
              <Toggle
                label="Depth of Field"
                checked={postConfig.enableDepthOfField}
                onChange={() => handleTogglePost('enableDepthOfField')}
              />
              <Toggle
                label="FXAA Antialias"
                checked={postConfig.enableAntialiasing}
                onChange={() => handleTogglePost('enableAntialiasing')}
              />
              <Toggle
                label="GTAO Ambient Occ"
                checked={postConfig.enableGTAO}
                onChange={() => handleTogglePost('enableGTAO')}
              />
            </div>
          </div>
        </PanelBody>

        <PanelFooter>
          <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginRight: 'auto' }}>
            Hotkeys: <KeyHint>F</KeyHint> Free-Fly | <KeyHint>G</KeyHint> Toggle Debug
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
};

/**
 * Mirrored TypeScript definitions for Step 7 Timeline & Keyframe Automation
 * matching `src-tauri/src/timeline/mod.rs`.
 */

export type AutomationLaneId = 'pan' | 'distance' | 'elevation' | 'reverb' | 'volume';

export type CurveType =
  | { type: 'linear' }
  | { type: 'hold' }
  | { type: 'bezier'; c1_x: number; c1_y: number; c2_x: number; c2_y: number };

export interface Keyframe {
  id: string;
  time: number; // seconds
  value: number;
  curve: CurveType;
}

export interface AutomationLane {
  id: AutomationLaneId;
  name: string;
  color: string;
  unit: string;
  min_value: number;
  max_value: number;
  default_value: number;
  enabled: boolean;
  keyframes: Keyframe[];
}

export interface TimelineState {
  lanes: AutomationLane[];
  loop_enabled: boolean;
  snap_to_grid: boolean;
  grid_interval: number;
}

export interface TimelinePresetInfo {
  id: string;
  name: string;
  description: string;
  badge: string;
}

export const TIMELINE_PRESETS: TimelinePresetInfo[] = [
  {
    id: 'classic_orbit',
    name: 'Classic Orbit',
    description: 'Smooth 360° circular orbit with distance & reverb depth',
    badge: '4.0s cycle',
  },
  {
    id: 'slow_spin',
    name: 'Slow Spin',
    description: 'Wide 12-second panoramic rotation in lush ambient space',
    badge: '12.0s spin',
  },
  {
    id: 'front_to_back',
    name: 'Front to Back',
    description: 'Dives overhead from front near to deep rear acoustic shadow',
    badge: 'Vertical flyby',
  },
  {
    id: 'head_circle',
    name: 'Head Circle',
    description: 'Fast 2-second close-orbit corkscrew around the ears',
    badge: '2.0s corkscrew',
  },
  {
    id: 'deep_space',
    name: 'Deep Space',
    description: 'Gradual departure from intimate intimacy into vast reverb void',
    badge: 'Receding void',
  },
];

export const LANE_CONFIG: Record<AutomationLaneId, { name: string; color: string; unit: string; min: number; max: number; default: number }> = {
  pan: {
    name: 'Pan / Azimuth',
    color: '#06b6d4', // Cyan
    unit: 'deg',
    min: -1.0,
    max: 1.0,
    default: 0.0,
  },
  distance: {
    name: '3D Distance',
    color: '#10b981', // Emerald
    unit: '%',
    min: 0.0,
    max: 1.0,
    default: 0.0,
  },
  elevation: {
    name: '3D Elevation',
    color: '#8b5cf6', // Purple
    unit: 'elev',
    min: -1.0,
    max: 1.0,
    default: 0.0,
  },
  reverb: {
    name: 'Reverb Amount',
    color: '#f59e0b', // Amber
    unit: '%',
    min: 0.0,
    max: 1.0,
    default: 0.30,
  },
  volume: {
    name: 'Master Volume',
    color: '#ef4444', // Red
    unit: 'x',
    min: 0.0,
    max: 2.0,
    default: 1.0,
  },
};

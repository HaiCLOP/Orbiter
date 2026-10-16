import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useTimelineStore } from '../store/timelineStore';

// Preload the high-quality 3D knob asset generated via Blender MCP
useGLTF.preload('/models/knob.glb');

/* =========================================================================
   3D Knob Mesh & Rigging Component
   ========================================================================= */
interface KnobMeshProps {
  value: number;
  min: number;
  max: number;
  isContinuous?: boolean; // true for 360° Azimuth, false for 270° sweep
  color?: string; // Indicator accent color
  isDragging: boolean;
}

const KnobMesh: React.FC<KnobMeshProps> = ({
  value,
  min,
  max,
  isContinuous = false,
  color = '#38bdf8',
}) => {
  const gltf = useGLTF('/models/knob.glb');
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const rotorRef = useRef<THREE.Object3D | null>(null);
  const targetRotationZ = useRef<number>(0);
  const currentRotationZ = useRef<number>(0);

  // Locate the rotating part (Knob_Rotor) and accent materials
  useEffect(() => {
    let rotor: THREE.Object3D | null = null;
    sceneClone.traverse((child) => {
      if (child.name === 'Knob_Rotor') {
        rotor = child;
      }
      if (child instanceof THREE.Mesh) {
        // Clone materials so each knob instance has independent tint
        if (child.material) {
          child.material = child.material.clone();
          if (child.name.includes('Indicator') && color) {
            if ('emissive' in child.material) {
              (child.material as THREE.MeshStandardMaterial).emissive.set(color);
              (child.material as THREE.MeshStandardMaterial).color.set(color);
            }
          }
        }
      }
    });
    rotorRef.current = rotor;
  }, [sceneClone, color]);

  // Compute rotation angle based on knob mode
  useEffect(() => {
    if (isContinuous) {
      // 360° Continuous Azimuth: 0 radians at top (Front), clockwise rotation
      // In Blender, rotor rotates around Z; negative Z is clockwise looking down
      targetRotationZ.current = -value;
    } else {
      // Standard 270° sweep (-135° to +135°)
      const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
      const deg = -135 + norm * 270;
      targetRotationZ.current = -THREE.MathUtils.degToRad(deg);
    }
  }, [value, min, max, isContinuous]);

  // Smooth lerp rotation for liquid motion feel
  useFrame((_, delta) => {
    if (!rotorRef.current) return;
    const lerpFactor = Math.min(1, delta * 24);
    currentRotationZ.current += (targetRotationZ.current - currentRotationZ.current) * lerpFactor;
    rotorRef.current.rotation.z = currentRotationZ.current;
  });

  return (
    <group rotation={[-Math.PI / 2.7, 0, 0]} position={[0, -0.05, 0]}>
      {/* Lights tailored to highlight the tactile knurling and diamond chamfer */}
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 4, 5]} intensity={2.6} color="#ffffff" />
      <directionalLight position={[-4, 2, 3]} intensity={1.2} color="#94a3b8" />
      <pointLight position={[0, 1.5, 2.5]} intensity={1.8} color={color} distance={4} />

      <primitive object={sceneClone} scale={0.88} />
    </group>
  );
};

/* =========================================================================
   Reusable Knob3D Control Container
   ========================================================================= */
export interface Knob3DProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  isContinuous?: boolean;
  isCenterZero?: boolean;
  color?: string;
  laneId?: 'pan' | 'distance' | 'elevation' | 'volume' | 'reverb';
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
}

export const Knob3D: React.FC<Knob3DProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  defaultValue = 0,
  isContinuous = false,
  isCenterZero = false,
  color = '#38bdf8',
  laneId,
  formatValue,
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);
  const { setLaneEnabled, timeline } = useTimelineStore();

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Option B handoff: Drop active keyframe lane to manual mode on knob grab
    if (laneId && timeline) {
      const lane = timeline.lanes.find((l) => l.id === laneId);
      if (lane && lane.enabled && lane.keyframes.length > 0) {
        setLaneEnabled(laneId, false);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dy = dragStartY.current - e.clientY;
    const sensitivity = e.shiftKey ? 0.2 : 1.0;
    const range = max - min;
    const delta = (dy / 140) * range * sensitivity;

    let next = dragStartValue.current + delta;
    if (isContinuous) {
      next = ((next % range) + range) % range;
    } else {
      next = Math.max(min, Math.min(max, next));
    }

    if (step > 0) {
      next = Math.round(next / step) * step;
    }
    onChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const range = max - min;
    const stepSize = (range / 100) * (e.shiftKey ? 0.2 : 1.0);
    const delta = e.deltaY < 0 ? stepSize : -stepSize;

    let next = value + delta;
    if (isContinuous) {
      next = ((next % range) + range) % range;
    } else {
      next = Math.max(min, Math.min(max, next));
    }

    if (step > 0) {
      next = Math.round(next / step) * step;
    }

    // Option B handoff
    if (laneId && timeline) {
      const lane = timeline.lanes.find((l) => l.id === laneId);
      if (lane && lane.enabled && lane.keyframes.length > 0) {
        setLaneEnabled(laneId, false);
      }
    }
    onChange(next);
  };

  const handleDoubleClick = () => {
    onChange(defaultValue);
    if (laneId && timeline) {
      const lane = timeline.lanes.find((l) => l.id === laneId);
      if (lane && lane.enabled && lane.keyframes.length > 0) {
        setLaneEnabled(laneId, false);
      }
    }
  };

  const displayFormatted = useCallback(() => {
    if (formatValue) return formatValue(value);
    if (isCenterZero) {
      if (Math.abs(value) < 0.02) return 'C (Center)';
      if (value < 0) return `L ${Math.round(Math.abs(value) * 100)}%`;
      return `R ${Math.round(value * 100)}%`;
    }
    return `${Math.round(value)}${unit}`;
  }, [value, unit, isCenterZero, formatValue]);

  return (
    <div
      className="flex flex-col items-center select-none group"
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      title={`${label} — Drag vertically or scroll to adjust. Double-click to reset.`}
    >
      {/* Header Label */}
      <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 group-hover:text-zinc-200 transition-colors mb-1">
        {label}
      </span>

      {/* 3D WebGL Knob Canvas */}
      <div
        className={`w-20 h-20 relative cursor-ns-resize rounded-full transition-transform ${
          isDragging ? 'scale-105' : 'hover:scale-[1.02]'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <Canvas
          camera={{ fov: 36, position: [0, 0, 4.3] }}
          gl={{ powerPreference: 'high-performance', antialias: true, alpha: true }}
          className="w-full h-full pointer-events-none"
        >
          <KnobMesh
            value={value}
            min={min}
            max={max}
            isContinuous={isContinuous}
            color={color}
            isDragging={isDragging}
          />
        </Canvas>
      </div>

      {/* Value Readout Badge */}
      <div className="mt-1 glass-pill px-2.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums text-zinc-300 border border-white/[0.06] group-hover:border-white/15 transition-all flex items-center gap-1 shadow-xs">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span>{displayFormatted()}</span>
      </div>
    </div>
  );
};

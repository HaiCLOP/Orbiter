import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useTrackStore } from '../store/trackStore';
import { useTimelineStore } from '../store/timelineStore';

interface SpatialRadar3DProps {
  viewMode: '3D' | 'Top' | 'Front' | 'Side';
}

// Module-level cache for GLTF listener head model
let cachedGltfScene: THREE.Group | null = null;
let gltfLoadingPromise: Promise<THREE.Group> | null = null;

function loadOrGetGltf(): Promise<THREE.Group> {
  if (cachedGltfScene) {
    return Promise.resolve(cachedGltfScene.clone());
  }
  if (!gltfLoadingPromise) {
    gltfLoadingPromise = new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        '/models/listener_head.glb',
        (gltf) => {
          cachedGltfScene = gltf.scene;
          resolve(gltf.scene.clone());
        },
        undefined,
        (err) => reject(err)
      );
    });
  }
  return gltfLoadingPromise.then((scene) => scene.clone());
}

/* =========================================================================
   1. Camera Rig with Liquid Spring Transitions & Mouse Parallax
   ========================================================================= */
interface CameraRigProps {
  viewMode: '3D' | 'Top' | 'Front' | 'Side';
  isDragging: boolean;
}

const CameraRig: React.FC<CameraRigProps> = ({ viewMode, isDragging }) => {
  const { camera } = useThree();
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const cameraConfigs = useMemo<Record<'3D' | 'Top' | 'Front' | 'Side', { pos: THREE.Vector3; look: THREE.Vector3 }>>(() => ({
    '3D': { pos: new THREE.Vector3(0, 2.4, 4.2), look: new THREE.Vector3(0, 0.15, 0) },
    'Top': { pos: new THREE.Vector3(0, 5.0, 0.001), look: new THREE.Vector3(0, 0, 0) },
    'Front': { pos: new THREE.Vector3(0, 0.2, 4.6), look: new THREE.Vector3(0, 0.1, 0) },
    'Side': { pos: new THREE.Vector3(4.6, 0.2, 0), look: new THREE.Vector3(0, 0.1, 0) },
  }), []);

  const currentCamPos = useRef(cameraConfigs[viewMode].pos.clone());
  const currentCamLook = useRef(cameraConfigs[viewMode].look.clone());

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging || viewMode !== '3D') return;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      mouseRef.current.targetX = nx * 0.35;
      mouseRef.current.targetY = ny * 0.25;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isDragging, viewMode]);

  useFrame(() => {
    const target = cameraConfigs[viewMode];
    currentCamPos.current.lerp(target.pos, 0.08);
    currentCamLook.current.lerp(target.look, 0.08);

    mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
    mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

    if (viewMode === '3D' && !isDragging) {
      camera.position.x = currentCamPos.current.x + mouseRef.current.x * 1.5;
      camera.position.y = currentCamPos.current.y - mouseRef.current.y * 1.0;
      camera.position.z = currentCamPos.current.z;
    } else {
      camera.position.copy(currentCamPos.current);
    }
    camera.lookAt(currentCamLook.current);
  });

  return null;
};

/* =========================================================================
   2. Studio Lighting Rig
   ========================================================================= */
const StudioLights: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.7} color="#ffffff" />
      <directionalLight position={[2.5, 4.5, 3.5]} intensity={1.8} color="#fff8ee" />
      <directionalLight position={[-3, 2, 2]} intensity={0.85} color="#cfd8dc" />
      <directionalLight position={[0, 3, -3.5]} intensity={1.4} color="#e2e8f0" />
    </>
  );
};

/* =========================================================================
   3. Apple Space Gray / Titanium Center Head Model
   ========================================================================= */
interface CenterHeadProps {
  azimuth: number;
  elevation: number;
  enabled: boolean;
}

const CenterHeadModel: React.FC<CenterHeadProps> = ({ azimuth, elevation, enabled }) => {
  const headGroupRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

  // Materials
  const materials = useMemo(() => {
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x16181f,
      metalness: 0.65,
      roughness: 0.35,
    });
    const hpCupMat = new THREE.MeshStandardMaterial({
      color: 0x242732,
      metalness: 0.88,
      roughness: 0.18,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x121318,
      metalness: 0.1,
      roughness: 0.85,
    });
    return { headMat, hpCupMat, cushionMat };
  }, []);

  useEffect(() => {
    let mounted = true;
    loadOrGetGltf()
      .then((loadedScene) => {
        if (!mounted) return;
        loadedScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const name = mesh.name.toLowerCase();
            if (name.includes('ear') || name.includes('cup') || name.includes('headphone')) {
              mesh.material = materials.hpCupMat;
            } else if (name.includes('cushion') || name.includes('foam')) {
              mesh.material = materials.cushionMat;
            } else {
              mesh.material = materials.headMat;
            }
          }
        });
        loadedScene.scale.set(0.55, 0.55, 0.55);
        loadedScene.position.set(0, 0, 0);
        setModel(loadedScene);
      })
      .catch((err) => {
        console.warn('Retaining procedural Apple head fallback:', err);
      });

    return () => {
      mounted = false;
    };
  }, [materials]);

  // Subtle micro-look toward the sound source
  useFrame(() => {
    if (!headGroupRef.current) return;
    if (enabled) {
      headGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        headGroupRef.current.rotation.y,
        -azimuth * 0.1,
        0.08
      );
      headGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        headGroupRef.current.rotation.x,
        -elevation * 0.06,
        0.08
      );
    } else {
      headGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        headGroupRef.current.rotation.y,
        0,
        0.08
      );
      headGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        headGroupRef.current.rotation.x,
        0,
        0.08
      );
    }
  });

  return (
    <group ref={headGroupRef}>
      {model ? (
        <primitive object={model} />
      ) : (
        /* Synchronous procedural fallback mannequin */
        <group>
          {/* Skull */}
          <mesh scale={[0.85, 1.15, 1.0]}>
            <sphereGeometry args={[0.48, 32, 24]} />
            <primitive object={materials.headMat} attach="material" />
          </mesh>
          {/* Left Earcup */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.46, 0.02, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.12, 24]} />
            <primitive object={materials.hpCupMat} attach="material" />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[-0.41, 0.02, 0]}>
            <torusGeometry args={[0.18, 0.05, 16, 24]} />
            <primitive object={materials.cushionMat} attach="material" />
          </mesh>
          {/* Right Earcup */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.46, 0.02, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.12, 24]} />
            <primitive object={materials.hpCupMat} attach="material" />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[0.41, 0.02, 0]}>
            <torusGeometry args={[0.18, 0.05, 16, 24]} />
            <primitive object={materials.cushionMat} attach="material" />
          </mesh>
          {/* Headband */}
          <mesh position={[0, 0.05, 0]}>
            <torusGeometry args={[0.51, 0.035, 16, 32, Math.PI]} />
            <primitive object={materials.hpCupMat} attach="material" />
          </mesh>
        </group>
      )}
    </group>
  );
};

/* =========================================================================
   4. Polar Radar Grid System (Concentric rings + Crosshairs)
   ========================================================================= */
const PolarRadarGrid: React.FC = () => {
  const radii = [0.9, 1.4, 1.9, 2.4];
  const crossPoints = useMemo(() => [
    new THREE.Vector3(-2.4, 0, 0),
    new THREE.Vector3(2.4, 0, 0),
    new THREE.Vector3(0, 0, -2.4),
    new THREE.Vector3(0, 0, 2.4),
  ], []);

  const crossGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(crossPoints), [crossPoints]);
  const crossLines = useMemo(
    () => new THREE.LineSegments(crossGeo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06 })),
    [crossGeo]
  );

  return (
    <group>
      {radii.map((r, idx) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r - 0.005, r + 0.005, 72]} />
          <meshBasicMaterial
            color={idx === 1 ? '#38bdf8' : '#ffffff'}
            transparent
            opacity={idx === 1 ? 0.16 : 0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <primitive object={crossLines} />
    </group>
  );
};

/* =========================================================================
   5. Dynamic Orbit Hairline Ring
   ========================================================================= */
interface OrbitRingProps {
  radius: number;
  elevationY: number;
}

const DynamicOrbitRing: React.FC<OrbitRingProps> = ({ radius, elevationY }) => {
  const lineObject = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 72;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.24 });
    return new THREE.Line(geo, mat);
  }, []);

  useFrame(() => {
    lineObject.scale.set(radius, 1, radius);
    lineObject.position.set(0, elevationY, 0);
  });

  return <primitive object={lineObject} />;
};

/* =========================================================================
   6. Draggable 3D Sound Source Dot with Spherical Raycasting & Wheel
   ========================================================================= */
interface DraggableDotProps {
  azimuth: number;
  distance: number;
  elevation: number;
  setIsDragging: (dragging: boolean) => void;
}

const DraggableSourceDot: React.FC<DraggableDotProps> = ({
  azimuth,
  distance,
  elevation,
  setIsDragging,
}) => {
  const { setAzimuth, setDistance, setElevation } = useTrackStore();
  const { setLaneEnabled, timeline } = useTimelineStore();
  const { raycaster, camera } = useThree();

  const isDraggingRef = useRef(false);
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());

  // Orbit coordinates
  const orbitRadius = 0.9 + 1.3 * Math.max(0, Math.min(1, distance));
  const elevY = Math.max(-1, Math.min(1, elevation)) * 0.65;

  const satX = orbitRadius * Math.sin(azimuth);
  const satZ = -orbitRadius * Math.cos(azimuth);

  // Contralateral reflection point
  const echoRadius = orbitRadius * 0.6;
  const echoX = -echoRadius * Math.sin(azimuth);
  const echoY = -elevY * 0.4;
  const echoZ = echoRadius * Math.cos(azimuth);

  // Option B: Drop lanes to manual mode on drag start
  const dropLanesToManual = useCallback(() => {
    if (!timeline) return;
    const panLane = timeline.lanes.find((l) => l.id === 'pan');
    const distLane = timeline.lanes.find((l) => l.id === 'distance');
    const elevLane = timeline.lanes.find((l) => l.id === 'elevation');

    if (panLane && panLane.enabled && panLane.keyframes.length > 0) {
      setLaneEnabled('pan', false);
    }
    if (distLane && distLane.enabled && distLane.keyframes.length > 0) {
      setLaneEnabled('distance', false);
    }
    if (elevLane && elevLane.enabled && elevLane.keyframes.length > 0) {
      setLaneEnabled('elevation', false);
    }
  }, [timeline, setLaneEnabled]);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsDragging(true);
    e.target.setPointerCapture(e.pointerId);

    // Establish drag plane facing camera at dot position
    const dotPos = new THREE.Vector3(satX, elevY, satZ);
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(cameraDir.negate(), dotPos);

    dropLanesToManual();
  };

  const handlePointerMove = (e: any) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();

    // 1. Spherical raycasting: Cast against an invisible sphere of current orbit radius
    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), orbitRadius);
    const hitPoint = new THREE.Vector3();
    const hit = raycaster.ray.intersectSphere(sphere, hitPoint);

    if (hit) {
      // Calculate spherical Azimuth: front is -Z, right is +X
      let newAzimuth = Math.atan2(hitPoint.x, -hitPoint.z);
      if (newAzimuth < 0) newAzimuth += 2 * Math.PI;

      // Calculate Elevation [-1.0, 1.0]
      const clampedNormY = Math.max(-1, Math.min(1, hitPoint.y / 0.65));

      setAzimuth(newAzimuth);
      setElevation(clampedNormY);
    } else {
      // Fallback to planar drag if ray misses sphere
      const planeHit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlaneRef.current, planeHit)) {
        let newAzimuth = Math.atan2(planeHit.x, -planeHit.z);
        if (newAzimuth < 0) newAzimuth += 2 * Math.PI;
        setAzimuth(newAzimuth);
      }
    }
  };

  const handlePointerUp = (e: any) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release capture error
    }
  };

  // Scroll wheel on canvas adjusts Distance
  const handleWheel = (e: any) => {
    e.stopPropagation();
    const delta = e.deltaY * -0.0012;
    const newDist = Math.max(0, Math.min(1, distance + delta));
    setDistance(newDist);
    dropLanesToManual();
  };

  return (
    <group onWheel={handleWheel}>
      {/* Dynamic Orbit Ring */}
      <DynamicOrbitRing radius={orbitRadius} elevationY={elevY} />

      {/* Invisible Large Pick Collider around Dot */}
      <mesh
        position={[satX, elevY, satZ]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Visible Source Dot (Apple Electric Sky) */}
      <group position={[satX, elevY, satZ]}>
        <mesh>
          <sphereGeometry args={[0.08, 32, 32]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={1.2}
            roughness={0.15}
            metalness={0.5}
          />
        </mesh>
        {/* Soft Translucent Aura */}
        <mesh>
          <sphereGeometry args={[0.13, 24, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} />
        </mesh>
      </group>

      {/* Binaural Contralateral Echo Dot */}
      <mesh position={[echoX, echoY, echoZ]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.45} />
      </mesh>
    </group>
  );
};

/* =========================================================================
   MAIN EXPORT: 3D Spatial Hologram with Draggable Dot
   ========================================================================= */
export const SpatialRadar3D: React.FC<SpatialRadar3DProps> = ({ viewMode }) => {
  const { azimuth, spatialParams } = useTrackStore();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="w-full h-full relative select-none flex flex-col overflow-hidden bg-transparent cursor-grab active:cursor-grabbing">
      <Canvas
        camera={{ fov: 40, near: 0.1, far: 100, position: [0, 2.4, 4.2] }}
        gl={{ powerPreference: 'high-performance', antialias: true, alpha: true }}
        className="w-full h-full"
      >
        <CameraRig viewMode={viewMode} isDragging={isDragging} />
        <StudioLights />
        <CenterHeadModel
          azimuth={azimuth}
          elevation={spatialParams.elevation ?? 0}
          enabled={spatialParams.enabled}
        />
        <PolarRadarGrid />
        <DraggableSourceDot
          azimuth={azimuth}
          distance={spatialParams.distance ?? 0}
          elevation={spatialParams.elevation ?? 0}
          setIsDragging={setIsDragging}
        />
      </Canvas>
    </div>
  );
};

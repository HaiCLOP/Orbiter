import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useTrackStore } from '../store/trackStore';

interface SpatialRadar3DProps {
  viewMode: '3D' | 'Top' | 'Front' | 'Side';
}

// Module-level GLTF cache so tab switching is instantaneous with zero network/file I/O
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

export const SpatialRadar3D: React.FC<SpatialRadar3DProps> = ({ viewMode }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { isPlaying, azimuth, spatialParams } = useTrackStore();

  // Dynamic references updated without restarting the WebGL engine or re-fetching GLB
  const isPlayingRef = useRef<boolean>(isPlaying);
  const azimuthRef = useRef<number>(azimuth);
  const spatialParamsRef = useRef(spatialParams);
  const viewModeRef = useRef<'3D' | 'Top' | 'Front' | 'Side'>(viewMode);

  // Sync refs on props/store updates
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    azimuthRef.current = azimuth;
  }, [azimuth]);

  useEffect(() => {
    spatialParamsRef.current = spatialParams;
  }, [spatialParams]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Mount WebGL Engine ONCE
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 300;
    let height = container.clientHeight || 200;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);

    const cameraTargets: Record<'3D' | 'Top' | 'Front' | 'Side', { pos: THREE.Vector3; look: THREE.Vector3 }> = {
      '3D': { pos: new THREE.Vector3(0, 2.4, 4.2), look: new THREE.Vector3(0, 0.15, 0) },
      'Top': { pos: new THREE.Vector3(0, 5.0, 0.01), look: new THREE.Vector3(0, 0, 0) },
      'Front': { pos: new THREE.Vector3(0, 0.2, 4.6), look: new THREE.Vector3(0, 0.1, 0) },
      'Side': { pos: new THREE.Vector3(4.6, 0.2, 0), look: new THREE.Vector3(0, 0.1, 0) },
    };

    const currentCamPos = cameraTargets[viewModeRef.current].pos.clone();
    const currentCamLook = cameraTargets[viewModeRef.current].look.clone();
    camera.position.copy(currentCamPos);
    camera.lookAt(currentCamLook);

    // 2. High-Performance Hardware WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Apple Studio Lighting (Stable, Physical, No Strobing)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.8);
    keyLight.position.set(2.5, 4.5, 3.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xcfd8dc, 0.85);
    fillLight.position.set(-3, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe2e8f0, 1.4);
    rimLight.position.set(0, 3, -3.5);
    scene.add(rimLight);

    // 4. Subtle Apple Pro Audio Polar Grid
    const gridGroup = new THREE.Group();
    const radii = [0.9, 1.4, 1.9, 2.4];
    radii.forEach((r, idx) => {
      const ringGeo = new THREE.RingGeometry(r - 0.005, r + 0.005, 72);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === 1 ? 0x38bdf8 : 0xffffff,
        transparent: true,
        opacity: idx === 1 ? 0.18 : 0.06,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      gridGroup.add(ringMesh);
    });

    // Crosshair axes (Front/Back, Left/Right)
    const crossMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
    });
    const crossPoints = [
      new THREE.Vector3(-2.4, 0, 0),
      new THREE.Vector3(2.4, 0, 0),
      new THREE.Vector3(0, 0, -2.4),
      new THREE.Vector3(0, 0, 2.4),
    ];
    const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPoints);
    const crossLines = new THREE.LineSegments(crossGeo, crossMat);
    gridGroup.add(crossLines);
    scene.add(gridGroup);

    // 5. Stylized Head & Headphones Container
    const headGroup = new THREE.Group();
    scene.add(headGroup);

    // Apple Space Gray / Obsidian Mannequin Materials
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

    // Procedural Fallback Mannequin (Mounted synchronously while GLTF is ready)
    const fallbackMesh = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.48, 36, 28), headMat);
    skull.scale.set(0.85, 1.15, 1.0);
    fallbackMesh.add(skull);

    // Ear cups
    const leftCup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 28), hpCupMat);
    leftCup.rotation.z = Math.PI / 2;
    leftCup.position.set(-0.46, 0.02, 0);
    fallbackMesh.add(leftCup);

    const leftCushion = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 16, 28), cushionMat);
    leftCushion.rotation.y = Math.PI / 2;
    leftCushion.position.set(-0.41, 0.02, 0);
    fallbackMesh.add(leftCushion);

    const rightCup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 28), hpCupMat);
    rightCup.rotation.z = Math.PI / 2;
    rightCup.position.set(0.46, 0.02, 0);
    fallbackMesh.add(rightCup);

    const rightCushion = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 16, 28), cushionMat);
    rightCushion.rotation.y = Math.PI / 2;
    rightCushion.position.set(0.41, 0.02, 0);
    fallbackMesh.add(rightCushion);

    // Headband
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.035, 16, 36, Math.PI), hpCupMat);
    band.position.set(0, 0.05, 0);
    fallbackMesh.add(band);

    headGroup.add(fallbackMesh);

    // Load or reuse cached GLB model seamlessly
    loadOrGetGltf()
      .then((model) => {
        // Style imported meshes with Apple anodized titanium materials
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const name = mesh.name.toLowerCase();
            if (name.includes('ear') || name.includes('cup') || name.includes('headphone')) {
              mesh.material = hpCupMat;
            } else if (name.includes('cushion') || name.includes('foam')) {
              mesh.material = cushionMat;
            } else {
              mesh.material = headMat;
            }
          }
        });
        model.scale.set(0.55, 0.55, 0.55);
        model.position.set(0, 0, 0);

        // Swap out fallback cleanly
        while (headGroup.children.length > 0) {
          headGroup.remove(headGroup.children[0]);
        }
        headGroup.add(model);
      })
      .catch((e) => {
        console.warn('Retaining procedural Apple mannequin head:', e);
      });

    // 6. Sound Source Satellite (Steady, Crisp, Luminous Apple Accent)
    const satelliteGroup = new THREE.Group();
    scene.add(satelliteGroup);

    // Primary Core Orb
    const satGeo = new THREE.SphereGeometry(0.08, 32, 32);
    const satMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
      roughness: 0.15,
      metalness: 0.5,
    });
    const satMesh = new THREE.Mesh(satGeo, satMat);
    satelliteGroup.add(satMesh);

    // Refined translucent outer glass shell (no pulsing strobe)
    const haloGeo = new THREE.SphereGeometry(0.14, 24, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    satelliteGroup.add(haloMesh);

    // Binaural Contralateral Indicator (Small, subtle echo bead)
    const echoGeo = new THREE.SphereGeometry(0.035, 16, 16);
    const echoMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.5,
    });
    const echoMesh = new THREE.Mesh(echoGeo, echoMat);
    scene.add(echoMesh);

    // Dynamic Orbit Trajectory Hairline
    const orbitPoints: THREE.Vector3[] = [];
    const segments = 72;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    scene.add(orbitLine);

    // 7. Interactive Apple-Style Parallax on Mouse Move
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      mouse.targetX = nx * 0.35;
      mouse.targetY = ny * 0.25;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // 8. Rock-Solid 60/120 FPS Render Loop
    let animId: number;
    let visualAngle = azimuthRef.current;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Smooth mouse parallax damping
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      // Fluid camera transition between view modes
      const targetMode = viewModeRef.current;
      const targetConfig = cameraTargets[targetMode];
      currentCamPos.lerp(targetConfig.pos, 0.08);
      currentCamLook.lerp(targetConfig.look, 0.08);

      if (targetMode === '3D') {
        camera.position.x = currentCamPos.x + mouse.x * 1.5;
        camera.position.y = currentCamPos.y - mouse.y * 1.0;
        camera.position.z = currentCamPos.z;
      } else {
        camera.position.copy(currentCamPos);
      }
      camera.lookAt(currentCamLook);

      // Angle interpolation
      const params = spatialParamsRef.current;
      if (isPlayingRef.current && params.enabled) {
        const delta = 2 * Math.PI * params.rotation_speed * dt;
        visualAngle = (visualAngle + delta) % (2 * Math.PI);
      } else {
        // Damped blend toward latest rust audio azimuth
        const diff = azimuthRef.current - visualAngle;
        visualAngle += diff * 0.2;
      }

      const dist = Math.max(0, Math.min(1, params.distance ?? 0));
      const elev = Math.max(-1, Math.min(1, params.elevation ?? 0));

      // Dynamic orbit distance radius: 0.9m to 2.2m
      const orbitRadius = 0.9 + 1.3 * dist;
      const elevY = elev * 0.65;

      // Position sound source
      const satX = orbitRadius * Math.sin(visualAngle);
      const satZ = -orbitRadius * Math.cos(visualAngle);
      satelliteGroup.position.set(satX, elevY, satZ);

      // Position contralateral reflection
      const echoRadius = orbitRadius * 0.6;
      echoMesh.position.set(-echoRadius * Math.sin(visualAngle), -elevY * 0.4, echoRadius * Math.cos(visualAngle));

      // Adjust dynamic orbit line scale & elevation
      orbitLine.scale.set(orbitRadius, 1, orbitRadius);
      orbitLine.position.y = elevY;

      // Subtle, refined head micro-tracking (Apple Spatial Audio behavior)
      if (params.enabled) {
        headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, -visualAngle * 0.1, 0.08);
        headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, -elev * 0.06, 0.08);
      } else {
        headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, 0, 0.08);
        headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, 0, 0.08);
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    // Auto-resize handler
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 300;
      height = container.clientHeight || 200;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // Run ONCE on mount — eliminates all lag, flickering, and GLB reload storms!

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none"
    />
  );
};

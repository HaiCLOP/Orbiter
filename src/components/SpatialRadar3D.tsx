import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useTrackStore } from '../store/trackStore';

interface SpatialRadar3DProps {
  viewMode: '3D' | 'Top' | 'Front' | 'Side';
}

export const SpatialRadar3D: React.FC<SpatialRadar3DProps> = ({ viewMode }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { isPlaying, azimuth, spatialParams } = useTrackStore();

  const visualAngleRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  // Track azimuth from Rust engine
  useEffect(() => {
    visualAngleRef.current = azimuth;
  }, [azimuth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);

    // Initial camera position
    const setCameraForView = (mode: '3D' | 'Top' | 'Front' | 'Side') => {
      switch (mode) {
        case 'Top':
          camera.position.set(0, 5.2, 0.01);
          camera.lookAt(0, 0, 0);
          break;
        case 'Front':
          camera.position.set(0, 0.2, 4.8);
          camera.lookAt(0, 0, 0);
          break;
        case 'Side':
          camera.position.set(4.8, 0.2, 0);
          camera.lookAt(0, 0, 0);
          break;
        case '3D':
        default:
          camera.position.set(0, 2.6, 4.4);
          camera.lookAt(0, 0.1, 0);
          break;
      }
    };
    setCameraForView(viewMode);

    // 2. High-Precision Renderer
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

    // 3. Apple-Style Vibrant Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0x1e1b4b, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 6, 4);
    scene.add(keyLight);

    // Glowing Cyan Rim Light
    const cyanRim = new THREE.PointLight(0x06b6d4, 4.0, 10);
    cyanRim.position.set(-3, 2, -2);
    scene.add(cyanRim);

    // Glowing Purple/Indigo Backlight
    const purpleRim = new THREE.PointLight(0xa855f7, 3.5, 10);
    purpleRim.position.set(3, 1, -3);
    scene.add(purpleRim);

    // 4. Concentric Orbital Grid Rings in 3D
    const ringsGroup = new THREE.Group();
    const ringRadii = [0.8, 1.4, 2.0, 2.5];
    ringRadii.forEach((r, idx) => {
      const ringGeo = new THREE.RingGeometry(r - 0.008, r + 0.008, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === ringRadii.length - 1 ? 0x06b6d4 : 0xffffff,
        transparent: true,
        opacity: idx === ringRadii.length - 1 ? 0.35 : 0.08,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringsGroup.add(ringMesh);
    });
    scene.add(ringsGroup);

    // 5. Stylized 3D Listener Head (Procedural Fallback + GLTF Loader)
    const headGroup = new THREE.Group();
    scene.add(headGroup);

    // Build procedural fallback immediately so canvas is never empty
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      metalness: 0.85,
      roughness: 0.25,
    });
    const fallbackHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 24),
      fallbackMat
    );
    fallbackHead.scale.set(0.85, 1.15, 1.0);
    headGroup.add(fallbackHead);

    // Fallback headphones
    const hpMat = new THREE.MeshStandardMaterial({
      color: 0x1e2538,
      metalness: 0.95,
      roughness: 0.15,
    });

    const leftCup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24), hpMat);
    leftCup.rotation.z = Math.PI / 2;
    leftCup.position.set(-0.48, 0, 0);
    headGroup.add(leftCup);

    const rightCup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24), hpMat);
    rightCup.rotation.z = Math.PI / 2;
    rightCup.position.set(0.48, 0, 0);
    headGroup.add(rightCup);

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.04, 16, 32, Math.PI), hpMat);
    band.position.set(0, 0.05, 0);
    headGroup.add(band);

    // Load custom Blender-generated GLB model
    const loader = new GLTFLoader();
    loader.load(
      '/models/listener_head.glb',
      (gltf) => {
        // Remove procedural fallback and insert Blender model
        while (headGroup.children.length > 0) {
          headGroup.remove(headGroup.children[0]);
        }
        const model = gltf.scene;
        model.scale.set(0.55, 0.55, 0.55);
        model.position.set(0, 0, 0);
        headGroup.add(model);
      },
      undefined,
      (err) => {
        // Silently keep procedural fallback if network loading fails
        console.warn('Using procedural 3D head fallback:', err);
      }
    );

    // 6. Sound Source 3D Satellite & Aura
    const satelliteGroup = new THREE.Group();
    scene.add(satelliteGroup);

    // Core glowing sphere
    const satGeo = new THREE.SphereGeometry(0.09, 32, 32);
    const satMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.5,
      roughness: 0.1,
    });
    const satMesh = new THREE.Mesh(satGeo, satMat);
    satelliteGroup.add(satMesh);

    // Pulsing aura halo
    const auraGeo = new THREE.SphereGeometry(0.22, 24, 24);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    satelliteGroup.add(auraMesh);

    // Secondary contralateral echo dot (AirPods binaural cue reflection)
    const echoGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const echoMat = new THREE.MeshBasicMaterial({
      color: 0xec4899,
      transparent: true,
      opacity: 0.7,
    });
    const echoMesh = new THREE.Mesh(echoGeo, echoMat);
    scene.add(echoMesh);

    // Orbit path ring (dynamic radius matching distance parameter)
    const orbitPathGeo = new THREE.BufferGeometry();
    const orbitPathPoints: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      orbitPathPoints.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
    }
    orbitPathGeo.setFromPoints(orbitPathPoints);
    const orbitPathMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35,
    });
    const orbitPathLine = new THREE.Line(orbitPathGeo, orbitPathMat);
    scene.add(orbitPathLine);

    // 7. Mouse tracking for subtle Apple-style interactive parallax
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;
      mouseRef.current.targetX = normX * 0.4;
      mouseRef.current.targetY = normY * 0.3;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // 8. 60/120 FPS Animation Loop
    let animId: number;
    const animate = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Smooth mouse parallax damping
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      if (viewMode === '3D') {
        camera.position.x = mouseRef.current.x * 2.0;
        camera.position.y = 2.6 - mouseRef.current.y * 1.5;
        camera.lookAt(0, 0.1, 0);
      }

      // Live angle progression
      if (isPlaying && spatialParams.enabled) {
        const delta = 2 * Math.PI * spatialParams.rotation_speed * dt;
        visualAngleRef.current = (visualAngleRef.current + delta) % (2 * Math.PI);
      } else if (!isPlaying) {
        visualAngleRef.current = azimuth;
      }

      const currentAngle = visualAngleRef.current;
      const dist = Math.max(0, Math.min(1, spatialParams.distance ?? 0));
      const elev = Math.max(-1, Math.min(1, spatialParams.elevation ?? 0));

      // Dynamic orbit distance radius: 0.9m to 2.3m
      const orbitRadius = 0.9 + 1.4 * dist;
      const elevY = elev * 0.75; // Elevation vertical displacement

      // Dynamic satellite positioning in true 3D space
      // Front is -Z, Right is +X
      const satX = orbitRadius * Math.sin(currentAngle);
      const satZ = -orbitRadius * Math.cos(currentAngle);
      satelliteGroup.position.set(satX, elevY, satZ);

      // Echo reflection point
      const echoRadius = orbitRadius * 0.55;
      echoMesh.position.set(-echoRadius * Math.sin(currentAngle), -elevY * 0.5, echoRadius * Math.cos(currentAngle));

      // Update dynamic orbit line scale & elevation
      orbitPathLine.scale.set(orbitRadius, 1, orbitRadius);
      orbitPathLine.position.y = elevY;

      // Color dynamics based on elevation
      let themeColor = 0x06b6d4; // Cyan (Neutral)
      if (elev > 0.05) themeColor = 0x10b981; // Emerald (High)
      else if (elev < -0.05) themeColor = 0xa855f7; // Purple (Low)

      satMat.color.setHex(themeColor);
      satMat.emissive.setHex(themeColor);
      auraMat.color.setHex(themeColor);
      orbitPathMat.color.setHex(themeColor);

      // Pulsing aura animation
      const pulseScale = 1 + 0.15 * Math.sin(now * 0.006);
      auraMesh.scale.set(pulseScale, pulseScale, pulseScale);

      // Head subtly looks toward the active satellite when playing
      if (spatialParams.enabled) {
        headGroup.rotation.y = -currentAngle * 0.12;
        headGroup.rotation.x = -elev * 0.08;
      } else {
        headGroup.rotation.y = 0;
        headGroup.rotation.x = 0;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    // Auto-resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
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
  }, [viewMode, isPlaying, spatialParams, azimuth]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none"
    />
  );
};

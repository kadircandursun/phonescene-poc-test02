import * as THREE from 'three';
import { OrientationTracker } from './orientation';
import { SixDofTracker, type SixDofSample } from './pose';

export type SceneId = 'loft' | 'studio';

/**
 * Procedural indoor room.
 * Default: 3DoF rotation (TEST 03–04). Optional 6DoF position when pose samples arrive.
 */
export class VirtualRoom {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly orientation = new OrientationTracker();
  readonly sixDof = new SixDofTracker();
  private readonly camQuat = new THREE.Quaternion();
  private readonly camPos = new THREE.Vector3();
  private readonly restPosition = new THREE.Vector3();
  private readonly restQuaternion = new THREE.Quaternion();
  private roomRoot: THREE.Group | null = null;
  private sceneId: SceneId = 'loft';
  /** When true and 6DoF samples exist, position+rotation from SixDofTracker. */
  preferSixDof = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#c9d6e2');
    this.scene.fog = new THREE.Fog('#c9d6e2', 10, 22);

    this.camera = new THREE.PerspectiveCamera(58, 9 / 16, 0.1, 40);
    // Selfie hold: real window is often *behind* the user. Match that —
    // stand near the window wall, look into the room (+Z); window stays at −Z behind.
    this.camera.position.set(0, 1.5, -2.15);
    this.camera.lookAt(0, 1.35, 1.8);
    this.restPosition.copy(this.camera.position);
    this.restQuaternion.copy(this.camera.quaternion);
    // Lock "phone upright selfie" rest pose to this forward room view.
    this.orientation.setRestQuaternion(this.restQuaternion.clone());

    this.buildScene('loft');
  }

  setSize(width: number, height: number) {
    const w = Math.max(2, Math.floor(width));
    const h = Math.max(2, Math.floor(height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setScene(id: SceneId) {
    if (id === this.sceneId) return;
    this.buildScene(id);
  }

  private buildScene(id: SceneId) {
    if (this.roomRoot) {
      this.scene.remove(this.roomRoot);
      this.roomRoot.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
    }

    this.sceneId = id;
    this.roomRoot = id === 'studio' ? buildStudio() : buildLoft();
    this.scene.add(this.roomRoot);

    // Lights — window-driven daylight + soft fill
    const hemi = new THREE.HemisphereLight(0xe8f2ff, 0x5a4a3a, 0.7);
    this.roomRoot.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
    sun.position.set(0.4, 3.2, -4.5); // from the window wall
    sun.target.position.set(0, 1.2, 0);
    this.roomRoot.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.roomRoot.add(sun);
    const fill = new THREE.PointLight(0xffd8b0, 0.45, 10);
    fill.position.set(-1.6, 2.4, 1.2);
    this.roomRoot.add(fill);
  }

  pushSixDof(sample: SixDofSample) {
    this.sixDof.update(sample);
  }

  recenter() {
    this.orientation.recenter();
    this.sixDof.recenter();
  }

  setFovY(degrees: number) {
    if (!Number.isFinite(degrees) || degrees < 20 || degrees > 120) return;
    this.camera.fov = degrees;
    this.camera.updateProjectionMatrix();
  }

  render() {
    if (this.preferSixDof && this.sixDof.hasPoseSample) {
      const applied = this.sixDof.applyToCamera(
        this.restPosition,
        this.restQuaternion,
        this.camPos,
        this.camQuat,
      );
      if (applied) {
        this.camera.position.copy(this.camPos);
        this.camera.quaternion.copy(this.camQuat);
        this.renderer.render(this.scene, this.camera);
        return;
      }
    }

    // 3DoF fallback — rotation only, restore rest position.
    this.camera.position.copy(this.restPosition);
    this.orientation.getCameraQuaternion(this.camQuat);
    this.camera.quaternion.copy(this.camQuat);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}

function mat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });
}

function box(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  shadow = true,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

function buildLoft(): THREE.Group {
  const root = new THREE.Group();
  const plaster = mat('#ebe6dc', { roughness: 0.92 });
  const plasterWarm = mat('#e2d8c8', { roughness: 0.9 });
  const woodDark = mat('#5c3d24', { roughness: 0.7 });
  const woodMid = mat('#8b5a2b', { roughness: 0.65 });
  const sofaCloth = mat('#3e5c52', { roughness: 0.95 });
  const sofaDark = mat('#2f463f', { roughness: 0.95 });
  const trim = mat('#f4efe6', { roughness: 0.85 });
  const metal = mat('#3a3f45', { roughness: 0.35, metalness: 0.55 });

  // Shell — slightly larger so window reads as “outside”
  box(root, 7.2, 0.12, 7.2, 0, -0.02, 0, woodDark); // subfloor
  box(root, 7, 3.1, 0.1, 0, 1.55, -3.45, plaster, false); // back (window wall)
  box(root, 0.1, 3.1, 7, -3.45, 1.55, 0, plasterWarm, false);
  box(root, 0.1, 3.1, 7, 3.45, 1.55, 0, plasterWarm, false);
  box(root, 7, 0.1, 7, 0, 3.15, 0, mat('#f7f3ea', { roughness: 0.95 }), false);

  // Wood plank floor (stripes = strong motion parallax when walking)
  for (let i = -6; i <= 6; i += 1) {
    const tone = i % 2 === 0 ? '#9a7045' : '#8a6238';
    box(root, 0.48, 0.04, 6.8, i * 0.5, 0.02, 0, mat(tone, { roughness: 0.82 }));
  }
  // Rug under seating
  box(root, 2.8, 0.03, 2.0, -0.15, 0.05, 0.85, mat('#6e3b2e', { roughness: 1 }));

  // Baseboards + crown hint
  box(root, 6.9, 0.12, 0.06, 0, 0.1, -3.38, trim, false);
  box(root, 0.06, 0.12, 6.9, -3.38, 0.1, 0, trim, false);
  box(root, 0.06, 0.12, 6.9, 3.38, 0.1, 0, trim, false);

  // Big readable window (center of back wall) + outdoor depth
  box(root, 3.1, 2.05, 0.12, 0, 1.75, -3.38, woodMid, false); // frame
  box(root, 0.1, 1.85, 0.08, 0, 1.75, -3.32, woodMid, false); // mullion V
  box(root, 2.85, 0.1, 0.08, 0, 1.75, -3.32, woodMid, false); // mullion H
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2.85, 1.85),
    new THREE.MeshBasicMaterial({ color: '#8ec5ff' }),
  );
  sky.position.set(0, 1.75, -3.28);
  root.add(sky);
  // Soft outdoor “buildings” for depth beyond glass
  box(root, 0.9, 1.2, 0.05, -0.85, 1.35, -3.22, mat('#6d7d8c', { roughness: 1 }), false);
  box(root, 0.7, 0.95, 0.05, 0.95, 1.2, -3.22, mat('#7a8894', { roughness: 1 }), false);
  const sun = new THREE.PointLight(0xfff0d0, 1.35, 12, 2);
  sun.position.set(0, 2.1, -3.0);
  root.add(sun);
  // Sill + curtains
  box(root, 3.2, 0.08, 0.28, 0, 0.78, -3.25, woodMid, false);
  box(root, 0.35, 2.1, 0.12, -1.55, 1.75, -3.3, mat('#d9cfc0', { roughness: 1 }), false);
  box(root, 0.35, 2.1, 0.12, 1.55, 1.75, -3.3, mat('#d9cfc0', { roughness: 1 }), false);

  // Sofa facing the window (you sit here → window is “ahead”)
  box(root, 2.6, 0.42, 1.0, -0.1, 0.32, 1.75, sofaCloth);
  box(root, 2.6, 0.58, 0.22, -0.1, 0.72, 1.28, sofaDark);
  box(root, 0.22, 0.58, 1.0, -1.3, 0.72, 1.75, sofaDark);
  box(root, 0.22, 0.58, 1.0, 1.1, 0.72, 1.75, sofaDark);
  box(root, 0.55, 0.18, 0.4, -0.7, 0.62, 1.65, mat('#c4b59a')); // cushion
  box(root, 0.55, 0.18, 0.4, 0.45, 0.62, 1.65, mat('#c4b59a'));

  // Coffee table + lamp (near-field scale cues)
  box(root, 1.2, 0.06, 0.6, -0.1, 0.42, 0.55, woodMid);
  box(root, 0.07, 0.38, 0.07, -0.55, 0.22, 0.35, metal);
  box(root, 0.07, 0.38, 0.07, 0.35, 0.22, 0.35, metal);
  box(root, 0.07, 0.38, 0.07, -0.55, 0.22, 0.75, metal);
  box(root, 0.07, 0.38, 0.07, 0.35, 0.22, 0.75, metal);
  box(root, 0.12, 0.55, 0.12, 0.95, 0.35, 0.55, metal);
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.2, 20),
    mat('#f0e6d2', { roughness: 0.9 }),
  );
  lampShade.position.set(0.95, 0.72, 0.55);
  root.add(lampShade);
  const lampLight = new THREE.PointLight(0xffd9a8, 0.55, 4, 2);
  lampLight.position.set(0.95, 0.85, 0.55);
  root.add(lampLight);

  // Bookshelf on right — stacked “books” for parallax
  box(root, 1.0, 2.0, 0.4, 2.55, 1.05, -2.4, woodDark);
  for (let row = 0; row < 4; row++) {
    for (let b = 0; b < 5; b++) {
      const colors = ['#8b3a3a', '#3a5a8b', '#3a7a5a', '#8b6a3a', '#5a3a7a'];
      box(
        root,
        0.12,
        0.28,
        0.28,
        2.25 + b * 0.14,
        0.35 + row * 0.45,
        -2.35,
        mat(colors[b], { roughness: 0.85 }),
        false,
      );
    }
  }

  // Left plant + door (side landmark so left/right walking is obvious)
  box(root, 0.32, 0.55, 0.32, -2.55, 0.32, -1.6, mat('#4a3422'));
  const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), mat('#3f9a5c'));
  foliage.position.set(-2.55, 1.05, -1.6);
  foliage.castShadow = true;
  root.add(foliage);
  box(root, 1.05, 2.2, 0.08, -3.38, 1.15, 1.4, woodMid, false); // door
  box(root, 0.08, 0.08, 0.08, -3.28, 1.15, 1.05, metal, false); // knob

  // Mid-room depth props
  box(root, 0.45, 0.45, 0.45, 1.7, 0.28, -0.2, mat('#c45c3a'));
  box(root, 0.35, 1.2, 0.35, -2.5, 0.65, 0.35, mat('#6a7380'));

  return root;
}

function buildStudio(): THREE.Group {
  const root = new THREE.Group();
  box(root, 7, 0.08, 7, 0, 0, 0, mat('#2b2f36'));
  box(root, 7, 3.2, 0.08, 0, 1.6, -3.4, mat('#f2f2f0'), false);
  box(root, 0.08, 3.2, 7, -3.4, 1.6, 0, mat('#ecece8'), false);
  box(root, 0.08, 3.2, 7, 3.4, 1.6, 0, mat('#ecece8'), false);
  box(root, 7, 0.08, 7, 0, 3.2, 0, mat('#ffffff'), false);

  // Softbox glow
  const soft = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.6),
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  );
  soft.position.set(-2.8, 1.8, -1);
  soft.rotation.y = Math.PI / 2;
  root.add(soft);

  box(root, 1.6, 0.7, 0.7, 0, 0.45, -1.8, mat('#111111')); // stool/block
  box(root, 2.4, 0.05, 1.2, 1.5, 0.9, 1.2, mat('#cfcfcf')); // desk
  box(root, 0.5, 0.9, 0.5, 2.2, 0.45, -2.5, mat('#5b7cfa'));
  return root;
}

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
    this.scene.background = new THREE.Color('#1a2228');
    this.scene.fog = new THREE.Fog('#1a2228', 8, 18);

    this.camera = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 40);
    this.camera.position.set(0, 1.55, 2.2);
    this.camera.lookAt(0, 1.35, -1);
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

    // Lights
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x334433, 0.55);
    this.roomRoot.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
    sun.position.set(2.5, 4, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.roomRoot.add(sun);
    const lamp = new THREE.PointLight(0xffc988, 0.7, 8);
    lamp.position.set(-1.4, 2.2, -1.2);
    this.roomRoot.add(lamp);
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
  const floor = mat('#6b5a45');
  const wall = mat('#d9d2c5');
  const accent = mat('#3d5a4c');
  const wood = mat('#8a6239');
  const dark = mat('#2a2f33');

  // Room shell (inner size ~6x3x6)
  box(root, 6, 0.08, 6, 0, 0, 0, floor);
  box(root, 6, 3, 0.08, 0, 1.5, -3, wall, false); // back
  box(root, 0.08, 3, 6, -3, 1.5, 0, wall, false);
  box(root, 0.08, 3, 6, 3, 1.5, 0, accent, false);
  box(root, 6, 0.08, 6, 0, 3, 0, mat('#e8e4dc'), false); // ceiling

  // Window + glow
  const windowFrame = box(root, 2.2, 1.4, 0.06, 0, 1.7, -2.96, dark, false);
  void windowFrame;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.1),
    new THREE.MeshBasicMaterial({ color: '#b8d7ff' }),
  );
  glow.position.set(0, 1.7, -2.92);
  root.add(glow);

  // Sofa (near)
  box(root, 2.2, 0.45, 0.9, -0.2, 0.35, 1.6, mat('#4f6d60'));
  box(root, 2.2, 0.55, 0.2, -0.2, 0.7, 1.2, mat('#3f584e'));
  box(root, 0.2, 0.55, 0.9, -1.2, 0.7, 1.6, mat('#3f584e'));
  box(root, 0.2, 0.55, 0.9, 0.8, 0.7, 1.6, mat('#3f584e'));

  // Coffee table
  box(root, 1.1, 0.08, 0.55, -0.1, 0.4, 0.6, wood);
  box(root, 0.08, 0.36, 0.08, -0.55, 0.2, 0.4, dark);
  box(root, 0.08, 0.36, 0.08, 0.35, 0.2, 0.4, dark);
  box(root, 0.08, 0.36, 0.08, -0.55, 0.2, 0.8, dark);
  box(root, 0.08, 0.36, 0.08, 0.35, 0.2, 0.8, dark);

  // Far bookshelf + plant references for parallax
  box(root, 0.9, 1.8, 0.35, 2.2, 0.95, -2.3, wood);
  box(root, 0.28, 0.7, 0.28, -2.2, 0.4, -1.8, mat('#2f6b45'));
  const plantTop = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), mat('#3f9a5c'));
  plantTop.position.set(-2.2, 1.0, -1.8);
  plantTop.castShadow = true;
  root.add(plantTop);

  // Depth markers
  box(root, 0.35, 0.35, 0.35, 1.6, 0.25, -0.4, mat('#c45c3a'));
  box(root, 0.25, 1.1, 0.25, -2.4, 0.6, 0.2, mat('#7a8490'));

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

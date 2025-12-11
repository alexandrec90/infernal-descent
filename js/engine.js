import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Engine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        // Basic Three.js Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.scene.fog = new THREE.Fog(0x111111, 0, 100);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: false }); // False for retro feel
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Input Setup
        this.controls = new PointerLockControls(this.camera, document.body);
        this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
        this.mouseCheck = { left: false };
        
        // Asset Management
        this.textureLoader = new THREE.TextureLoader();
        this.audioLoader = new THREE.AudioLoader();
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);

        this.assets = {
            textures: {},
            sounds: {}
        };

        this._initListeners();
        this._handleResize();
    }

    // Defensive Asset Loading
    loadTexture(name, path) {
        return new Promise((resolve) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    texture.magFilter = THREE.NearestFilter; // Pixelated
                    this.assets.textures[name] = texture;
                    resolve(texture);
                },
                undefined, // onProgress
                (err) => {
                    console.error(`ERROR: Failed to load texture ${path}`, err);
                    // Fallback: Red Rectangle
                    const canvas = document.createElement('canvas');
                    canvas.width = 64; canvas.height = 64;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'red';
                    ctx.fillRect(0,0,64,64);
                    const fallback = new THREE.CanvasTexture(canvas);
                    this.assets.textures[name] = fallback;
                    resolve(fallback);
                }
            );
        });
    }

    loadSound(name, path) {
        return new Promise((resolve) => {
            this.audioLoader.load(
                path,
                (buffer) => {
                    this.assets.sounds[name] = buffer;
                    resolve(buffer);
                },
                undefined,
                (err) => {
                    console.error(`ERROR: Failed to load sound ${path}`, err);
                    // Graceful failure: null buffer
                    this.assets.sounds[name] = null;
                    resolve(null);
                }
            );
        });
    }

    playSound(name) {
        if (!this.assets.sounds[name]) return;
        const sound = new THREE.Audio(this.listener);
        sound.setBuffer(this.assets.sounds[name]);
        sound.setVolume(0.5);
        sound.play();
    }

    _initListeners() {
        // Pointer Lock
        this.container.addEventListener('click', () => {
            this.controls.lock();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => this._onKey(e, true));
        document.addEventListener('keyup', (e) => this._onKey(e, false));
        
        // Mouse Down/Up for shooting
        document.addEventListener('mousedown', (e) => { if(e.button === 0) this.mouseCheck.left = true; });
        document.addEventListener('mouseup', (e) => { if(e.button === 0) this.mouseCheck.left = false; });
    }

    _onKey(e, isDown) {
        switch(e.code) {
            case 'KeyW': this.keys.w = isDown; break;
            case 'KeyA': this.keys.a = isDown; break;
            case 'KeyS': this.keys.s = isDown; break;
            case 'KeyD': this.keys.d = isDown; break;
            case 'ShiftLeft': this.keys.shift = isDown; break;
            case 'Space': this.keys.space = isDown; break;
            case 'Digit1': if(isDown) document.dispatchEvent(new CustomEvent('switchWeapon', { detail: 0 })); break;
            case 'Digit2': if(isDown) document.dispatchEvent(new CustomEvent('switchWeapon', { detail: 1 })); break;
            case 'Digit3': if(isDown) document.dispatchEvent(new CustomEvent('switchWeapon', { detail: 2 })); break;
            case 'Digit4': if(isDown) document.dispatchEvent(new CustomEvent('switchWeapon', { detail: 3 })); break;
        }
    }

    _handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}
import * as THREE from 'three';
import { Engine } from './engine.js';

// --- 2. Global Constants ---
const PLAYER_SPEED = 10.0;
const SPRINT_MULTIPLIER = 1.5;
const GRAVITY = 30.0;
const JUMP_FORCE = 15.0;

const WEAPONS = {
    0: { name: 'Knuckles', damage: 10, range: 3, delay: 500, type: 'HITSCAN' },
    1: { name: 'Shotgun', damage: 80, range: 15, delay: 1000, type: 'HITSCAN' },
    2: { name: 'Nailgun', damage: 15, range: 40, delay: 100, type: 'PROJECTILE' },
    3: { name: 'Launcher', damage: 120, range: 60, delay: 1500, type: 'AOE' }
};

export class Game {
    constructor() {
        this.engine = new Engine('game-container');
        this.clock = new THREE.Clock();
        
        // Game State
        this.player = {
            hp: 100,
            armor: 0,
            ammo: { current: 20, max: 50 },
            velocity: new THREE.Vector3(),
            canJump: false,
            currentWeaponIdx: 0,
            lastFireTime: 0
        };

        this.enemies = [];
        this.projectiles = [];
        this.levelGeometry = []; // For collision
    }

    async init() {
        // --- 4. Asset Logic Mapping: Initialization ---
        // Preload Textures
        await Promise.all([
            this.engine.loadTexture('wall', 'assets/textures/wall.png'),
            this.engine.loadTexture('wall_secret', 'assets/textures/wall_secret.png'),
            this.engine.loadTexture('floor', 'assets/textures/floor.png'),
            this.engine.loadTexture('enemy_idle', 'assets/images/sprites/enemy_idle.png'),
            this.engine.loadTexture('enemy_chase', 'assets/images/sprites/enemy_chase.png'),
            // UI Assets (handled by DOM, but good to preload if needed for canvas drawing, skipping for DOM)
        ]);

        // Preload Sounds
        await Promise.all([
            this.engine.loadSound('punch', 'assets/sfx/weapon_punch.mp3'),
            this.engine.loadSound('shotgun', 'assets/sfx/weapon_shotgun.mp3'),
            this.engine.loadSound('nailgun', 'assets/sfx/weapon_nailgun.mp3'),
            this.engine.loadSound('launcher', 'assets/sfx/weapon_launcher.mp3'),
            this.engine.loadSound('alert', 'assets/sfx/enemy_alert.mp3'),
            this.engine.loadSound('die', 'assets/sfx/enemy_die.mp3')
        ]);

        this._buildLevel();
        this._setupListeners();
    }

    start() {
        this.engine.renderer.setAnimationLoop(() => this._gameLoop());
    }

    _buildLevel() {
        // Simple Room
        const matWall = new THREE.MeshBasicMaterial({ map: this.engine.assets.textures['wall'] });
        const matFloor = new THREE.MeshBasicMaterial({ map: this.engine.assets.textures['floor'] });
        const matSecret = new THREE.MeshBasicMaterial({ map: this.engine.assets.textures['wall_secret'] });

        // Floor
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), matFloor);
        floor.rotation.x = -Math.PI / 2;
        this.engine.scene.add(floor);
        this.levelGeometry.push(floor);

        // Walls (Simple Box Layout)
        const createWall = (x, y, z, w, h, mat) => {
            const geo = new THREE.BoxGeometry(w, 10, h);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, 5, z);
            this.engine.scene.add(mesh);
            this.levelGeometry.push(mesh);
            return mesh;
        };

        createWall(0, 5, -50, 100, 1, matWall); // Front
        createWall(0, 5, 50, 100, 1, matWall);  // Back
        createWall(-50, 5, 0, 1, 100, matWall); // Left
        createWall(50, 5, 0, 1, 100, matWall);  // Right

        // Secret Wall
        const secret = createWall(0, 5, -49, 10, 1, matSecret);
        secret.userData = { isSecret: true };

        // Ambient Light
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.engine.scene.add(ambient);

        // Spawn Enemy
        this._spawnEnemy(new THREE.Vector3(0, 2.5, -20));
        this._spawnEnemy(new THREE.Vector3(10, 2.5, -10));
    }

    _spawnEnemy(position) {
        const mat = new THREE.SpriteMaterial({ map: this.engine.assets.textures['enemy_idle'] });
        const sprite = new THREE.Sprite(mat);
        sprite.position.copy(position);
        sprite.scale.set(3, 5, 1); // Width, Height
        
        // Enemy Object Wrapper
        const enemy = {
            mesh: sprite,
            hp: 50,
            state: 'IDLE', // IDLE, CHASE
            speed: 3.0,
            attackRange: 2.0
        };
        
        this.engine.scene.add(sprite);
        this.enemies.push(enemy);
    }

    _setupListeners() {
        // Weapon Switching
        document.addEventListener('switchWeapon', (e) => {
            this.player.currentWeaponIdx = e.detail;
        });
    }

    // --- 5. Main Logic Flow ---
    _gameLoop() {
        const dt = this.clock.getDelta();

        if (this.engine.controls.isLocked) {
            this._handleMovement(dt);
            this._handleShooting();
            this._handleEnvironment();
        }

        this._updateEnemies(dt);
        this._updateProjectiles(dt);
        this._updateHUD();

        this.engine.renderer.render(this.engine.scene, this.engine.camera);
    }

    _handleMovement(dt) {
        const keys = this.engine.keys;
        const velocity = this.player.velocity;

        // Base Speed
        let speed = PLAYER_SPEED;
        if (keys.shift) speed *= SPRINT_MULTIPLIER;

        // Direction from Camera
        const direction = new THREE.Vector3();
        const front = new THREE.Vector3();
        const side = new THREE.Vector3();

        // Standard WASD logic
        // Get camera forward vector, project to XZ plane for standard FPS movement
        this.engine.camera.getWorldDirection(front);
        front.y = 0; 
        front.normalize();
        side.crossVectors(front, this.engine.camera.up).normalize();

        if (keys.w) direction.add(front);
        if (keys.s) direction.sub(front);
        if (keys.a) direction.sub(side);
        if (keys.d) direction.add(side);
        
        direction.normalize();

        // Apply movement to velocity (Kinematic style)
        velocity.x = direction.x * speed;
        velocity.z = direction.z * speed;

        // Gravity
        velocity.y -= GRAVITY * dt;

        // Jump
        if (keys.space && this.player.canJump) {
            velocity.y = JUMP_FORCE;
            this.player.canJump = false;
        }

        // Apply Velocity to Camera position
        this.engine.controls.getObject().position.x += velocity.x * dt;
        this.engine.controls.getObject().position.y += velocity.y * dt;
        this.engine.controls.getObject().position.z += velocity.z * dt;

        // Simple Floor Collision
        if (this.engine.controls.getObject().position.y < 2.5) {
            velocity.y = 0;
            this.engine.controls.getObject().position.y = 2.5; // Player height
            this.player.canJump = true;
        }
    }

    _handleEnvironment() {
        // Secret Wall Interaction
        // Requirement: If texture == wall_secret.png AND distance < 2 -> Trigger Open
        // We use a Raycaster from player center
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0,0), this.engine.camera);
        
        const intersects = raycaster.intersectObjects(this.levelGeometry);

        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance < 4.0) { // Distance < 2 might be too tight for gameplay, using 4
                // Check texture via material map
                if (hit.object.userData.isSecret) {
                   // Open it (Move it down)
                   if(hit.object.position.y > -5) {
                       hit.object.position.y -= 0.1; 
                   }
                }
            }
        }
    }

    _handleShooting() {
        if (!this.engine.mouseCheck.left) return;

        const now = Date.now();
        const weapon = WEAPONS[this.player.currentWeaponIdx];

        if (now - this.player.lastFireTime > weapon.delay) {
            this.player.lastFireTime = now;
            
            // SFX Logic
            const sfxMap = ['punch', 'shotgun', 'nailgun', 'launcher'];
            this.engine.playSound(sfxMap[this.player.currentWeaponIdx]);

            if (weapon.type === 'HITSCAN') {
                this._fireHitscan(weapon);
            } else {
                this._fireProjectile(weapon);
            }
        }
    }

    _fireHitscan(weapon) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0,0), this.engine.camera);
        
        // Check collisions with Enemies
        const enemyMeshes = this.enemies.map(e => e.mesh);
        const hits = raycaster.intersectObjects(enemyMeshes);

        if (hits.length > 0) {
            const hit = hits[0];
            if (hit.distance <= weapon.range) {
                // Find enemy object
                const enemy = this.enemies.find(e => e.mesh === hit.object);
                if (enemy) this._damageEnemy(enemy, weapon.damage);
            }
        }
    }

    _fireProjectile(weapon) {
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        
        // Start at camera position
        sphere.position.copy(this.engine.camera.position);
        
        // Get direction
        const dir = new THREE.Vector3();
        this.engine.camera.getWorldDirection(dir);

        // Slightly offset spawn to not clip camera
        sphere.position.addScaledVector(dir, 1);

        this.engine.scene.add(sphere);

        this.projectiles.push({
            mesh: sphere,
            velocity: dir.multiplyScalar(30), // Speed
            type: weapon.type,
            damage: weapon.damage,
            lifetime: 2.0 // Seconds
        });
    }

    _updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            
            // Move
            p.mesh.position.addScaledVector(p.velocity, dt);
            p.lifetime -= dt;

            let hit = false;
            
            // Simple proximity check for projectile collision against enemies
            for(let enemy of this.enemies) {
                if(p.mesh.position.distanceTo(enemy.mesh.position) < 2.0) {
                    this._damageEnemy(enemy, p.damage);
                    hit = true;
                    break;
                }
            }

            if (hit || p.lifetime <= 0) {
                this.engine.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }

    _updateEnemies(dt) {
        const playerPos = this.engine.camera.position;

        this.enemies.forEach((enemy, index) => {
            if (enemy.hp <= 0) return; // Skip dead

            // Billboard Effect (Always face camera)
            enemy.mesh.lookAt(playerPos.x, enemy.mesh.position.y, playerPos.z);

            const dist = enemy.mesh.position.distanceTo(playerPos);

            // Logic: Can See Player
            if (dist < 25) { // Sight range
                
                // Transition to Chase
                if (enemy.state === 'IDLE') {
                    enemy.state = 'CHASE';
                    enemy.mesh.material.map = this.engine.assets.textures['enemy_chase'];
                    this.engine.playSound('alert');
                }

                // Move Towards
                if (dist > enemy.attackRange) {
                    const dir = new THREE.Vector3().subVectors(playerPos, enemy.mesh.position).normalize();
                    // Keep y at 0 for movement (flat ground)
                    dir.y = 0;
                    enemy.mesh.position.addScaledVector(dir, enemy.speed * dt);
                } else {
                    // Attack (Placeholder: Damage Player)
                    // In a full game, we'd have attack delay
                    this.player.hp -= 0.1; // Drain health slowly
                }
            }
        });
    }

    _damageEnemy(enemy, damage) {
        enemy.hp -= damage;
        // Flash red
        enemy.mesh.material.color.setHex(0xff0000);
        setTimeout(() => { if(enemy.mesh) enemy.mesh.material.color.setHex(0xffffff); }, 100);

        if (enemy.hp <= 0) {
            this._killEnemy(enemy);
        }
    }

    _killEnemy(enemy) {
        this.engine.playSound('die');
        this.engine.scene.remove(enemy.mesh);
        // Remove from array
        const idx = this.enemies.indexOf(enemy);
        if (idx > -1) this.enemies.splice(idx, 1);
    }

    _updateHUD() {
        // IDs: hud-health-val, hud-armor-val, hud-ammo-val, hud-face-img
        
        // Stats
        document.getElementById('hud-health-val').innerText = Math.floor(this.player.hp);
        document.getElementById('hud-armor-val').innerText = this.player.armor;
        
        const weapon = WEAPONS[this.player.currentWeaponIdx];
        document.getElementById('hud-ammo-val').innerText = `${this.player.ammo.current} | ${weapon.name}`;

        // Face Logic
        const faceImg = document.getElementById('hud-face-img');
        let faceSrc = 'assets/images/ui/face_healthy.png';
        if (this.player.hp <= 0) faceSrc = 'assets/images/ui/face_dead.png';
        else if (this.player.hp < 50) faceSrc = 'assets/images/ui/face_hurt.png';
        
        // Prevent constant DOM rewriting if src hasn't changed
        if (!faceImg.src.endsWith(faceSrc)) {
            faceImg.src = faceSrc;
        }

        if (this.player.hp <= 0) {
            // Game Over Logic could go here
            document.exitPointerLock();
        }
    }
}
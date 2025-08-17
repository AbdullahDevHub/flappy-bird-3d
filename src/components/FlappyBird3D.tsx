import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';

interface Pipe {
  x: number;
  gapY: number;
  passed: boolean;
  mesh?: THREE.Group;
}

interface Bird {
  y: number;
  velocity: number;
  rotation: number;
}

const GAME_HEIGHT = 600;
const GAME_WIDTH = 400;
const BIRD_SIZE = 20;
const PIPE_WIDTH = 50;
const PIPE_GAP = 140;
const GRAVITY = 0.25;
const JUMP_FORCE = -6;
const PIPE_SPEED = 1.5;
const MAX_VELOCITY = 6;

const FlappyBird3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const birdMeshRef = useRef<THREE.Group | null>(null);
  const pipesRef = useRef<Pipe[]>([]);
  const animationRef = useRef<number | null>(null);
  
  const [bird, setBird] = useState<Bird>({ y: 0, velocity: 0, rotation: 0 });
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'gameOver'>('waiting');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  
  const lastPipeTime = useRef(0);
  const clockRef = useRef<THREE.Clock | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      const padding = 32;
      const headerHeight = 120;
      const footerHeight = 60;
      const availableWidth = window.innerWidth - padding;
      const availableHeight = window.innerHeight - headerHeight - footerHeight;
      
      const gameWidth = Math.min(GAME_WIDTH, availableWidth);
      const gameHeight = Math.min(GAME_HEIGHT, availableHeight);
      
      setDimensions({ width: gameWidth, height: gameHeight });
      
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      if (rendererRef.current && isInitialized) {
        rendererRef.current.setSize(gameWidth, gameHeight);
        
        if (cameraRef.current) {
          const camera = cameraRef.current as THREE.OrthographicCamera;
          camera.left = -gameWidth / 2;
          camera.right = gameWidth / 2;
          camera.top = gameHeight / 2;
          camera.bottom = -gameHeight / 2;
          camera.updateProjectionMatrix();
        }
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isInitialized]);

  useEffect(() => {
    if (!mountRef.current || !isInitialized || dimensions.width === 0 || dimensions.height === 0) return;

    clockRef.current = new THREE.Clock();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    
    const aspect = dimensions.width / dimensions.height;
    const camera = new THREE.OrthographicCamera(
      -dimensions.width / 2, dimensions.width / 2,
      dimensions.height / 2, -dimensions.height / 2,
      1, 1000
    );
    camera.position.z = 100;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(dimensions.width, dimensions.height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    const birdGroup = new THREE.Group();
    
    const bodyGeometry = new THREE.SphereGeometry(BIRD_SIZE / 2, 16, 12);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xFFD700,
      shininess: 30
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    birdGroup.add(bodyMesh);
    
    const beakGeometry = new THREE.ConeGeometry(3, 8, 6);
    const beakMaterial = new THREE.MeshPhongMaterial({ color: 0xFF8C00 });
    const beakMesh = new THREE.Mesh(beakGeometry, beakMaterial);
    beakMesh.rotation.z = Math.PI / 2;
    beakMesh.position.set(BIRD_SIZE / 2 + 2, 2, 0);
    birdGroup.add(beakMesh);
    
    const eyeGeometry = new THREE.SphereGeometry(2, 8, 6);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const eyeMesh = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eyeMesh.position.set(5, 8, 5);
    birdGroup.add(eyeMesh);
    
    const wingGeometry = new THREE.BoxGeometry(12, 4, 2);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xFFB347 });
    
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-5, 0, 8);
    leftWing.rotation.y = Math.PI / 6;
    birdGroup.add(leftWing);
    
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(-5, 0, -8);
    rightWing.rotation.y = -Math.PI / 6;
    birdGroup.add(rightWing);
    
    birdGroup.position.set(-GAME_WIDTH / 4, 0, 0);
    scene.add(birdGroup);
    
    const groundGeometry = new THREE.PlaneGeometry(GAME_WIDTH * 2, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.position.y = -240;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    birdMeshRef.current = birdGroup;
    
    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [dimensions, isInitialized]);

  const createPipe = useCallback((x: number, gapY: number): THREE.Group => {
    const pipeGroup = new THREE.Group();
    
    const pipeMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x228B22,
      shininess: 20
    });
    
    const gapTop = gapY - PIPE_GAP / 2;
    const gapBottom = gapY + PIPE_GAP / 2;
    
    const topPipeHeight = 240 + gapTop;
    if (topPipeHeight > 0) {
      const topPipeGeometry = new THREE.BoxGeometry(PIPE_WIDTH, topPipeHeight, 40);
      const topPipe = new THREE.Mesh(topPipeGeometry, pipeMaterial);
      topPipe.position.set(0, -240 + topPipeHeight / 2, 0);
      topPipe.castShadow = true;
      
      const topCapGeometry = new THREE.BoxGeometry(PIPE_WIDTH + 10, 20, 45);
      const topCap = new THREE.Mesh(topCapGeometry, pipeMaterial);
      topCap.position.set(0, gapTop - 10, 0);
      topCap.castShadow = true;
      
      pipeGroup.add(topPipe, topCap);
    }
    
    const bottomPipeHeight = 240 - gapBottom;
    if (bottomPipeHeight > 0) {
      const bottomPipeGeometry = new THREE.BoxGeometry(PIPE_WIDTH, bottomPipeHeight, 40);
      const bottomPipe = new THREE.Mesh(bottomPipeGeometry, pipeMaterial);
      bottomPipe.position.set(0, 240 - bottomPipeHeight / 2, 0);
      bottomPipe.castShadow = true;
      
      const bottomCapGeometry = new THREE.BoxGeometry(PIPE_WIDTH + 10, 20, 45);
      const bottomCap = new THREE.Mesh(bottomCapGeometry, pipeMaterial);
      bottomCap.position.set(0, gapBottom + 10, 0);
      bottomCap.castShadow = true;
      
      pipeGroup.add(bottomPipe, bottomCap);
    }
    
    pipeGroup.position.x = x;
    return pipeGroup;
  }, []);

  const checkCollision = useCallback((birdY: number): boolean => {
    if (birdY > 230 || birdY < -230) return true;
    
    const birdX = -GAME_WIDTH / 4;
    const birdRadius = BIRD_SIZE / 2;
    
    for (const pipe of pipesRef.current) {
      if (
        pipe.x - PIPE_WIDTH / 2 < birdX + birdRadius &&
        pipe.x + PIPE_WIDTH / 2 > birdX - birdRadius
      ) {
        const gapTop = pipe.gapY - PIPE_GAP / 2;
        const gapBottom = pipe.gapY + PIPE_GAP / 2;
        
        if (birdY + birdRadius < gapTop || birdY - birdRadius > gapBottom) {
          return true;
        }
      }
    }
    return false;
  }, []);

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing' || !clockRef.current) return;
    
    const deltaTime = Math.min(clockRef.current.getDelta(), 0.02);
    
    setBird(prevBird => {
      const newVelocity = Math.min(prevBird.velocity + GRAVITY, MAX_VELOCITY);
      const newY = prevBird.y + newVelocity;
      const newRotation = Math.max(-0.5, Math.min(0.5, newVelocity * 0.05));
      
      const newBird = {
        y: newY,
        velocity: newVelocity,
        rotation: newRotation
      };
      
      if (birdMeshRef.current) {
        birdMeshRef.current.position.y = newY;
        birdMeshRef.current.rotation.z = newRotation;
        
        const wingSpeed = 8;
        const wingOffset = Math.sin(Date.now() * 0.02 * wingSpeed) * 0.3;
        if (birdMeshRef.current.children[3]) {
          birdMeshRef.current.children[3].rotation.x = wingOffset;
        }
        if (birdMeshRef.current.children[4]) {
          birdMeshRef.current.children[4].rotation.x = -wingOffset;
        }
      }
      
      const currentTime = Date.now();
      pipesRef.current = pipesRef.current.filter(pipe => {
        pipe.x -= PIPE_SPEED;
        
        if (pipe.mesh) {
          pipe.mesh.position.x = pipe.x;
        }
        
        if (pipe.x < -GAME_WIDTH / 2 - PIPE_WIDTH) {
          if (pipe.mesh && sceneRef.current) {
            sceneRef.current.remove(pipe.mesh);
          }
          return false;
        }
        
        if (!pipe.passed && pipe.x + PIPE_WIDTH / 2 < -GAME_WIDTH / 4) {
          pipe.passed = true;
          setScore(prev => prev + 1);
        }
        
        return true;
      });
      
      if (currentTime - lastPipeTime.current > 3000) {
        const gapY = Math.random() * 200 - 100;
        const pipeX = GAME_WIDTH / 2 + PIPE_WIDTH;
        
        const pipeMesh = createPipe(pipeX, gapY);
        if (sceneRef.current) {
          sceneRef.current.add(pipeMesh);
        }
        
        const newPipe: Pipe = {
          x: pipeX,
          gapY,
          passed: false,
          mesh: pipeMesh
        };
        
        pipesRef.current.push(newPipe);
        lastPipeTime.current = currentTime;
      }
      
      if (checkCollision(newY)) {
        setGameState('gameOver');
        setHighScore(prev => Math.max(prev, score));
      }
      
      return newBird;
    });
  }, [gameState, score, checkCollision, createPipe]);

  useEffect(() => {
    const animate = () => {
      gameLoop();
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameLoop]);

  const handleJump = useCallback(() => {
    if (gameState === 'waiting') {
      setGameState('playing');
      if (clockRef.current) {
        clockRef.current.start();
      }
    }
    
    if (gameState === 'playing') {
      setBird(prev => ({ ...prev, velocity: JUMP_FORCE }));
    } else if (gameState === 'gameOver') {
      setBird({ y: 0, velocity: 0, rotation: 0 });
      setScore(0);
      
      pipesRef.current.forEach(pipe => {
        if (pipe.mesh && sceneRef.current) {
          sceneRef.current.remove(pipe.mesh);
        }
      });
      pipesRef.current = [];
      
      if (birdMeshRef.current) {
        birdMeshRef.current.position.y = 0;
        birdMeshRef.current.rotation.z = 0;
      }
      
      lastPipeTime.current = 0;
      setGameState('waiting');
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };

    const handleClick = () => handleJump();

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('click', handleClick);
    };
  }, [handleJump]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-4 z-10 relative w-full max-w-2xl">
        <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-2 drop-shadow-lg">
          Flappy Bird 3D
        </h1>
        <div className="text-white text-base md:text-lg lg:text-xl xl:text-2xl font-semibold">
          Score: <span className="text-yellow-400">{score}</span> | 
          High Score: <span className="text-green-400">{highScore}</span>
        </div>
      </div>

      {isInitialized && dimensions.width > 0 && dimensions.height > 0 && (
        <div className="relative rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-black/20 backdrop-blur-sm">
          <div 
            ref={mountRef} 
            className="cursor-pointer block"
            style={{ 
              width: dimensions.width, 
              height: dimensions.height
            }}
          />
          
          {gameState === 'waiting' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <div className="text-center text-white p-6 lg:p-8 bg-gradient-to-br from-blue-600/90 to-purple-600/90 rounded-xl border border-white/30 mx-4 max-w-sm shadow-2xl">
                <div className="text-2xl lg:text-3xl xl:text-4xl font-bold mb-4">🐦 Ready to Soar?</div>
                <div className="text-base lg:text-lg xl:text-xl mb-2">Click or press SPACE to fly!</div>
                <div className="text-sm lg:text-base opacity-75">Navigate through the 3D pipes</div>
              </div>
            </div>
          )}

          {gameState === 'gameOver' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
              <div className="text-center text-white p-6 lg:p-8 bg-gradient-to-br from-red-600/90 to-orange-600/90 rounded-xl border border-white/30 mx-4 max-w-sm shadow-2xl">
                <div className="text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 text-red-300">💥 Game Over!</div>
                <div className="text-xl lg:text-2xl xl:text-3xl mb-2">Score: <span className="text-yellow-400">{score}</span></div>
                {score === highScore && score > 0 && (
                  <div className="text-base lg:text-lg xl:text-xl mb-4 text-yellow-300">🏆 New High Score!</div>
                )}
                <div className="text-sm lg:text-base opacity-75">Click or press SPACE to restart</div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isInitialized && (
        <div className="relative rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-black/20 backdrop-blur-sm flex items-center justify-center" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
          <div className="text-white text-xl">Loading 3D Game...</div>
        </div>
      )}

      <div className="mt-4 lg:mt-6 text-center text-white/80 w-full max-w-2xl">
        <div className="text-sm md:text-base">
          🎮 Use SPACE, arrow keys, or click to control 
        </div>
      </div>
    </div>
  );
};

export default FlappyBird3D;
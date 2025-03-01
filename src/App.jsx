import React, { useState, useEffect, useRef } from 'react';

const App = () => {
  // Game area dimensions
  const gameWidth = 400;
  const gameHeight = 400;
  
  // Game state
  const [isGameActive, setIsGameActive] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  // Difficulty scaling
  const [difficultyLevel, setDifficultyLevel] = useState(1);
  
  // Define 4 lanes
  const laneWidth = gameWidth / 4;
  const lanes = [
    laneWidth / 2,
    laneWidth * 1.5,
    laneWidth * 2.5,
    laneWidth * 3.5
  ];
  
  // Player state - start in lane 1 (index 0)
  const [currentLane, setCurrentLane] = useState(0);
  const [playerPosition, setPlayerPosition] = useState({ x: lanes[0], y: gameHeight - 50 });
  const [projectiles, setProjectiles] = useState([]);
  
  // Enemy state
  const [enemies, setEnemies] = useState([]);
  const animationFrameId = useRef(null);
  const lastEnemySpawn = useRef(0);
  const lastShot = useRef(0);
  
  // Sound references
  const shootSoundRef = useRef(null);
  const collisionSoundRef = useRef(null);
  const gameOverSoundRef = useRef(null);
  
  // Device detection
  const [isMobile, setIsMobile] = useState(false);
  
  // Mobile touch controls
  const [isTouching, setIsTouching] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const touchThreshold = 30; // pixels to move to change lane
  const gameAreaRef = useRef(null);
  
  // Controls state
  const [keysPressed, setKeysPressed] = useState({
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
  });

  // Detect mobile devices on component mount
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    // Initial check
    checkMobile();
    
    // Check on resize
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  // Update difficulty level based on score
  useEffect(() => {
    // Increase difficulty every 10 points
    const newDifficultyLevel = Math.floor(score / 10) + 1;
    setDifficultyLevel(newDifficultyLevel);
  }, [score]);

  // Update player position when lane changes
  useEffect(() => {
    setPlayerPosition(prev => ({ ...prev, x: lanes[currentLane] }));
  }, [currentLane]);

  // Game loop
  useEffect(() => {
    if (!isGameActive) return;
    
    const handleKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
        setKeysPressed(prev => ({ 
          ...prev, 
          [e.key === ' ' ? 'Space' : e.key]: true
        }));
      }
    };
    
    const handleKeyUp = (e) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        setKeysPressed(prev => ({ 
          ...prev, 
          [e.key === ' ' ? 'Space' : e.key]: false
        }));
      }
    };
    
    // Only add keyboard listeners on non-mobile devices
    if (!isMobile) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }
    
    const gameLoop = (timestamp) => {
      // Calculate speed multipliers based on difficulty
      const projectileSpeedMultiplier = 1 + (difficultyLevel - 1) * 0.2;  // Increases by 20% per level
      const enemySpeedMultiplier = 1 + (difficultyLevel - 1) * 0.3;  // Increases by 30% per level
      const enemySpawnRateMultiplier = 1 / (1 + (difficultyLevel - 1) * 0.2);  // Spawn rate gets faster
      
      // Desktop controls
      if (!isMobile) {
        // Move player between lanes
        if (keysPressed.ArrowLeft && timestamp - lastShot.current > 100) {
          setCurrentLane(prev => Math.max(0, prev - 1));
          lastShot.current = timestamp; // Using lastShot as a debounce timer
        }
        if (keysPressed.ArrowRight && timestamp - lastShot.current > 100) {
          setCurrentLane(prev => Math.min(3, prev + 1));
          lastShot.current = timestamp; // Using lastShot as a debounce timer
        }
        
        // Create projectiles with adjusted firing rate
        const firingCooldown = 300 * (1 / (1 + (difficultyLevel - 1) * 0.06));
        if (keysPressed.Space && timestamp - lastShot.current > firingCooldown) {
          // Play shooting sound
          if (shootSoundRef.current) {
            shootSoundRef.current.currentTime = 0;
            shootSoundRef.current.play().catch(err => console.log("Audio play error:", err));
          }
          
          setProjectiles(prev => [...prev, { x: playerPosition.x, y: playerPosition.y - 20, id: Date.now() }]);
          lastShot.current = timestamp;
        }
      } else {
        // Mobile controls - auto-firing while touching
        const firingCooldown = 300 * (1 / (1 + (difficultyLevel - 1) * 0.06));
        if (isTouching && timestamp - lastShot.current > firingCooldown) {
          // Play shooting sound
          if (shootSoundRef.current) {
            shootSoundRef.current.currentTime = 0;
            shootSoundRef.current.play().catch(err => console.log("Audio play error:", err));
          }
          
          setProjectiles(prev => [...prev, { x: playerPosition.x, y: playerPosition.y - 20, id: Date.now() }]);
          lastShot.current = timestamp;
        }
      }
      
      // Move projectiles with scaled speed
      const projectileSpeed = 7 * projectileSpeedMultiplier;
      setProjectiles(prev => 
        prev
          .map(projectile => ({ ...projectile, y: projectile.y - projectileSpeed }))
          .filter(projectile => projectile.y > 0)
      );
      
      // Spawn enemies in random lanes with adjusted spawn rate
      const spawnInterval = 500 * enemySpawnRateMultiplier;
      if (timestamp - lastEnemySpawn.current > spawnInterval) {
        // Choose a random lane for the enemy
        const randomLaneIndex = Math.floor(Math.random() * 4);
        const laneX = lanes[randomLaneIndex];
        
        setEnemies(prev => [...prev, { 
          x: laneX, 
          y: 0, 
          lane: randomLaneIndex,
          id: Date.now(),
          size: Math.random() * 10 + 15, // Random size
          speed: (Math.random() * 2 + 1) * enemySpeedMultiplier // Speed scales with difficulty
        }]);
        lastEnemySpawn.current = timestamp;
      }
      
      // Move enemies
      setEnemies(prev => 
        prev
          .map(enemy => ({ ...enemy, y: enemy.y + enemy.speed }))
          .filter(enemy => enemy.y < gameHeight)
      );
      
      // Detect collisions
      // Enemy-projectile collisions
      let enemiesCopy = [...enemies];
      let projectilesCopy = [...projectiles];
      let collisionOccurred = false;
      
      for (let i = enemiesCopy.length - 1; i >= 0; i--) {
        const enemy = enemiesCopy[i];
        
        for (let j = projectilesCopy.length - 1; j >= 0; j--) {
          const projectile = projectilesCopy[j];
          
          // Check collision
          const dx = enemy.x - projectile.x;
          const dy = enemy.y - projectile.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < enemy.size) {
            // Play collision sound
            if (collisionSoundRef.current) {
              collisionSoundRef.current.currentTime = 0;
              collisionSoundRef.current.play().catch(err => console.log("Audio play error:", err));
            }
            
            enemiesCopy.splice(i, 1);
            projectilesCopy.splice(j, 1);
            setScore(prev => prev + 1);
            collisionOccurred = true;
            break;
          }
        }
        if (collisionOccurred) break;
      }
      
      if (collisionOccurred) {
        setEnemies(enemiesCopy);
        setProjectiles(projectilesCopy);
      }
      
      // Check for player collisions with enemies
      for (const enemy of enemies) {
        const dx = enemy.x - playerPosition.x;
        const dy = enemy.y - playerPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < enemy.size + 15) {
          // Play game over sound
          if (gameOverSoundRef.current) {
            gameOverSoundRef.current.currentTime = 0;
            gameOverSoundRef.current.play().catch(err => console.log("Audio play error:", err));
          }
          
          setGameOver(true);
          setIsGameActive(false);
          return;
        }
      }
      
      animationFrameId.current = requestAnimationFrame(gameLoop);
    };
    
    // Ensure the game loop starts immediately when game becomes active
    animationFrameId.current = requestAnimationFrame(gameLoop);
    
    return () => {
      cancelAnimationFrame(animationFrameId.current);
      if (!isMobile) {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [isGameActive, keysPressed, playerPosition, enemies, projectiles, difficultyLevel, currentLane, lanes, isMobile, isTouching]);
  
  // Mobile touch event handlers
  const handleTouchStart = (e) => {
    if (!isGameActive) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setIsTouching(true);
  };
  
  const handleTouchMove = (e) => {
    if (!isGameActive || !isTouching) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    
    if (Math.abs(deltaX) > touchThreshold) {
      if (deltaX < 0 && currentLane > 0) {
        // Swiped left
        setCurrentLane(prev => Math.max(0, prev - 1));
        setTouchStartX(touch.clientX);
      } else if (deltaX > 0 && currentLane < 3) {
        // Swiped right
        setCurrentLane(prev => Math.min(3, prev + 1));
        setTouchStartX(touch.clientX);
      }
    }
  };
  
  const handleTouchEnd = (e) => {
    e.preventDefault();
    setIsTouching(false);
  };
  
  const startGame = () => {
    setIsGameActive(true);
    setGameOver(false);
    setScore(0);
    setDifficultyLevel(1);
    setCurrentLane(1); // Start in the second lane
    setProjectiles([]);
    setEnemies([]);
    lastEnemySpawn.current = 0;
    lastShot.current = 0;
  };

  const [showInfo, setShowInfo] = useState(false);

  const openInfo = () => {
    setShowInfo(true);
  }

  const closeInfo = () => {
    setShowInfo(false);
  }

  return (
    <div className="w-full h-[100vh] flex flex-col items-center justify-center p-4 relative overflow-hidden animate-gradient bg-gradient-to-r from-pink-300 via-pink-500 to-pink-300 bg-size-200 ">
      {/* Audio elements for sound effects */}
      <audio 
        ref={shootSoundRef} 
        src="./shoot.wav" // Replace with your sound file path
        preload="auto" 
      />
      <audio 
        ref={collisionSoundRef} 
        src="./laser_destroy.wav" // Replace with your sound file path
        preload="auto" 
      />
      <audio 
        ref={gameOverSoundRef} 
        src="./game_over.wav" // Replace with your sound file path
        preload="auto" 
      />

      <h1 className="text-2xl font-bold mb-2">Succinct DeepFake Shooter</h1>
      
      <div className="mb-4 flex items-center gap-4">
        <div className="text-3xl font-bold bg-amber-400 px-2"> {score}</div>
        {!isGameActive && (
          <button 
            onClick={startGame}
            className="bg-pink-700 hover:bg-pink-400 cursor-pointer text-white font-semibold py-2 px-4 rounded"
          >
            {gameOver ? 'Play Again' : 'Start Game'}
          </button>
        )}

        <button className='cursor-pointer border border-pink-700 text-white font-semibold py-2 px-4 rounded' onClick={openInfo}>
          Info
        </button>
      </div>
      
      <div 
        ref={gameAreaRef}
        className="relative bg-black border border-pink-600 overflow-hidden"
        style={{ width: gameWidth, height: gameHeight }}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        {/* Lane dividers (for visualization) */}
        {[1, 2, 3].map((_, i) => (
          <div 
            key={i}
            className="absolute h-full bg-gray-700 opacity-30"
            style={{ 
              left: laneWidth * (i + 1),
              width: 1,
            }}
          />
        ))}
        
        {/* Stars background */}
        {Array.from({ length: 50 }).map((_, i) => (
          <div 
            key={i}
            className="absolute bg-white rounded-full"
            style={{ 
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              left: Math.random() * gameWidth,
              top: Math.random() * gameHeight,
              opacity: Math.random() * 0.7 + 0.3
            }}
          />
        ))}
        
        {/* Player ship */}
        {isGameActive && (
          <div 
            className="absolute w-10 h-10 flex items-center justify-center"
            style={{ left: playerPosition.x - 20, top: playerPosition.y - 20 }}
          >
            <div className="w-0 h-0 border-l-8 border-r-8 border-b-16 border-l-transparent border-r-transparent border-b-blue-500" />
          </div>
        )}
        
        {/* Projectiles */}
        {projectiles.map(projectile => (
          <div 
            key={projectile.id}
            className="absolute bg-yellow-400 rounded-full w-2 h-6"
            style={{ left: projectile.x - 1, top: projectile.y - 3 }}
          />
        ))}
        
        {/* Enemies */}
        {enemies.map(enemy => (
          <div 
            key={enemy.id}
            className="absolute bg-pink-600 rounded-full"
            style={{ 
              left: enemy.x - enemy.size / 2, 
              top: enemy.y - enemy.size / 2,
              width: enemy.size,
              height: enemy.size
            }}
          > 
            <img src="./masks-theater-solid.svg" className='p-1' alt="" />
          </div>
        ))}
        
        {/* Game over message */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-transparent bg-opacity-70">
            <div className="text-white text-2xl font-bold border-1 p-2">Game Over</div>
          </div>
        )}
        
        {/* Start screen */}
        {!isGameActive && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70">
            <div className="text-white text-2xl font-bold mb-4">Space Shooter</div>
            {isMobile ? (
              <>
                <div className="text-white text-lg mb-2">Drag left/right to move</div>
                <div className="text-white text-lg mb-4">Touch and hold to shoot</div>
              </>
            ) : (
              <>
                <div className="text-white text-lg mb-2">Arrow keys to change lanes</div>
                <div className="text-white text-lg mb-4">Space to shoot</div>
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-4 text-sm text-black">
        {isMobile ? (
          "Controls: Drag left/right to move, touch and hold to shoot"
        ) : (
          "Controls: Arrow keys to change lanes, Space to shoot"
        )}
      </div>

      <div className='mt-4 text-sm text-gray-600'>
        Made with Love 🩷 for Succinct by Banny18 
      </div>

      {showInfo && (
        <div id='info' className='absolute top-[50] left-[120] w-48 bg-pink-950 p-5 text-white'>
          Deepfakes are taking over the internet, it is your job to stop as many as possible before you get infected.
  
          Enjoy 😎✌️
          <button onClick={closeInfo} className='border border-pink-100 p-2 my-1 rounded-2xl cursor-pointer'>
            close
          </button>
        </div>
      )}
      
    </div>
  );
};

export default App;
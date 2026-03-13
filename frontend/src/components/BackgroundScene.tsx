import { useEffect, useRef } from 'react';
import { BackgroundScene } from '@/lib/three-background.js';

export function BackgroundSceneComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<InstanceType<typeof BackgroundScene> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize scene
    sceneRef.current = new BackgroundScene(containerRef.current);

    // Cleanup on unmount
    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  return <div id="background-canvas" ref={containerRef} />;
}

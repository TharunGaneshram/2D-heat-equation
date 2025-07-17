import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, Settings } from 'lucide-react';

interface HeatEquationParams {
  Lx: number;
  Ly: number;
  fL: number;
  fR: number;
  fT: number;
  alpha: number;
  dt: number;
  dx: number;
  dy: number;
  totalTime: number;
  gridResolution: number;
}

interface SimulationState {
  u: number[][];
  time: number;
  isRunning: boolean;
  animationId: number | null;
}

export const HeatEquation2D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  const [params, setParams] = useState<HeatEquationParams>({
    Lx: 2.0,
    Ly: 1.5,
    fL: 0.0,
    fR: 0.0,
    fT: 0.0,
    alpha: 0.1,
    dt: 0.001,
    dx: 0.05,
    dy: 0.05,
    totalTime: 5.0,
    gridResolution: 50
  });

  const [simulation, setSimulation] = useState<SimulationState>({
    u: [],
    time: 0,
    isRunning: false,
    animationId: null
  });

  const [showSettings, setShowSettings] = useState(false);

  // Initialize the temperature grid
  const initializeGrid = useCallback(() => {
    const nx = Math.floor(params.Lx / params.dx) + 1;
    const ny = Math.floor(params.Ly / params.dy) + 1;
    const u = Array(nx).fill(0).map(() => Array(ny).fill(0));

    // Apply initial condition: u(x,y,0) = cos(πy/2Ly) * sin(πx/Lx)
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const x = i * params.dx;
        const y = j * params.dy;
        u[i][j] = Math.cos(Math.PI * y / (2 * params.Ly)) * Math.sin(Math.PI * x / params.Lx);
      }
    }

    return u;
  }, [params.Lx, params.Ly, params.dx, params.dy]);

  // Apply boundary conditions
  const applyBoundaryConditions = useCallback((u: number[][]) => {
    const nx = u.length;
    const ny = u[0].length;

    // Bottom boundary: u(x,0,t) = sin(πx/Lx)
    for (let i = 0; i < nx; i++) {
      const x = i * params.dx;
      u[i][0] = Math.sin(Math.PI * x / params.Lx);
    }

    // Left boundary: ux(0,y,t) = fL (Neumann condition)
    for (let j = 0; j < ny; j++) {
      u[0][j] = u[1][j] - params.fL * params.dx;
    }

    // Right boundary: ux(Lx,y,t) = fR (Neumann condition)
    for (let j = 0; j < ny; j++) {
      u[nx-1][j] = u[nx-2][j] + params.fR * params.dx;
    }

    // Top boundary: uy(x,Ly,t) = fT (Neumann condition)
    for (let i = 0; i < nx; i++) {
      u[i][ny-1] = u[i][ny-2] + params.fT * params.dy;
    }
  }, [params.dx, params.dy, params.Lx, params.fL, params.fR, params.fT]);

  // Finite difference solver for 2D heat equation
  const solveHeatEquation = useCallback((u: number[][]) => {
    const nx = u.length;
    const ny = u[0].length;
    const newU = u.map(row => [...row]);

    const rx = params.alpha * params.dt / (params.dx * params.dx);
    const ry = params.alpha * params.dt / (params.dy * params.dy);

    // Check stability condition
    if (rx + ry > 0.5) {
      console.warn('Stability condition violated! Consider reducing dt or increasing dx/dy.');
    }

    // Apply finite difference scheme (explicit Euler)
    for (let i = 1; i < nx - 1; i++) {
      for (let j = 1; j < ny - 1; j++) {
        newU[i][j] = u[i][j] + 
          rx * (u[i+1][j] - 2*u[i][j] + u[i-1][j]) +
          ry * (u[i][j+1] - 2*u[i][j] + u[i][j-1]);
      }
    }

    return newU;
  }, [params.alpha, params.dt, params.dx, params.dy]);

  // Temperature to color mapping
  const temperatureToColor = (temp: number, minTemp: number, maxTemp: number): string => {
    const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
    
    // Create heat map: blue -> cyan -> yellow -> red
    let r, g, b;
    if (normalized < 0.25) {
      // Blue to cyan
      const t = normalized * 4;
      r = Math.floor(0 * (1 - t) + 0 * t);
      g = Math.floor(0 * (1 - t) + 255 * t);
      b = Math.floor(255 * (1 - t) + 255 * t);
    } else if (normalized < 0.5) {
      // Cyan to green
      const t = (normalized - 0.25) * 4;
      r = Math.floor(0 * (1 - t) + 0 * t);
      g = Math.floor(255 * (1 - t) + 255 * t);
      b = Math.floor(255 * (1 - t) + 0 * t);
    } else if (normalized < 0.75) {
      // Green to yellow
      const t = (normalized - 0.5) * 4;
      r = Math.floor(0 * (1 - t) + 255 * t);
      g = Math.floor(255 * (1 - t) + 255 * t);
      b = Math.floor(0 * (1 - t) + 0 * t);
    } else {
      // Yellow to red
      const t = (normalized - 0.75) * 4;
      r = Math.floor(255 * (1 - t) + 255 * t);
      g = Math.floor(255 * (1 - t) + 0 * t);
      b = Math.floor(0 * (1 - t) + 0 * t);
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Render the heat map on canvas
  const renderHeatMap = useCallback((u: number[][]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nx = u.length;
    const ny = u[0].length;
    
    // Calculate canvas dimensions
    const cellWidth = canvas.width / nx;
    const cellHeight = canvas.height / ny;

    // Find min and max temperatures for color scaling
    let minTemp = u[0][0];
    let maxTemp = u[0][0];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        minTemp = Math.min(minTemp, u[i][j]);
        maxTemp = Math.max(maxTemp, u[i][j]);
      }
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw temperature field
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const color = temperatureToColor(u[i][j], minTemp, maxTemp);
        ctx.fillStyle = color;
        ctx.fillRect(
          i * cellWidth,
          (ny - 1 - j) * cellHeight, // Flip y-axis
          cellWidth,
          cellHeight
        );
      }
    }

    // Add grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= nx; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellWidth, 0);
      ctx.lineTo(i * cellWidth, canvas.height);
      ctx.stroke();
    }
    for (let j = 0; j <= ny; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * cellHeight);
      ctx.lineTo(canvas.width, j * cellHeight);
      ctx.stroke();
    }
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    setSimulation(prev => {
      if (!prev.isRunning) return prev;

      let newU = prev.u;
      newU = solveHeatEquation(newU);
      applyBoundaryConditions(newU);

      const newTime = prev.time + params.dt;
      
      if (newTime >= params.totalTime) {
        return {
          ...prev,
          u: newU,
          time: 0,
          isRunning: false
        };
      }

      renderHeatMap(newU);

      return {
        ...prev,
        u: newU,
        time: newTime
      };
    });

    if (simulation.isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [solveHeatEquation, applyBoundaryConditions, renderHeatMap, params.dt, params.totalTime, simulation.isRunning]);

  // Initialize simulation
  const initializeSimulation = useCallback(() => {
    const initialGrid = initializeGrid();
    applyBoundaryConditions(initialGrid);
    
    setSimulation({
      u: initialGrid,
      time: 0,
      isRunning: false,
      animationId: null
    });

    renderHeatMap(initialGrid);
  }, [initializeGrid, applyBoundaryConditions, renderHeatMap]);

  // Control functions
  const startSimulation = () => {
    setSimulation(prev => ({ ...prev, isRunning: true }));
  };

  const pauseSimulation = () => {
    setSimulation(prev => ({ ...prev, isRunning: false }));
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const resetSimulation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    initializeSimulation();
  };

  // Effects
  useEffect(() => {
    initializeSimulation();
  }, [initializeSimulation]);

  useEffect(() => {
    if (simulation.isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [simulation.isRunning, animate]);

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            2D Heat Equation Solver
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </CardTitle>
          <CardDescription>
            Interactive visualization of temperature distribution evolution on a 2D plate
            <br />
            Time: {simulation.time.toFixed(3)}s / {params.totalTime}s
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visualization */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="border rounded-lg shadow-lg"
              style={{ background: 'hsl(var(--card))' }}
            />
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={simulation.isRunning ? pauseSimulation : startSimulation}
              className="min-w-24"
            >
              {simulation.isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </>
              )}
            </Button>
            <Button onClick={resetSimulation} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Simulation Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Plate Dimensions */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Plate Dimensions</h3>
                    <div className="space-y-2">
                      <Label htmlFor="lx">Length Lx</Label>
                      <Input
                        id="lx"
                        type="number"
                        step="0.1"
                        value={params.Lx}
                        onChange={(e) => setParams(prev => ({ ...prev, Lx: parseFloat(e.target.value) || 2.0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ly">Width Ly</Label>
                      <Input
                        id="ly"
                        type="number"
                        step="0.1"
                        value={params.Ly}
                        onChange={(e) => setParams(prev => ({ ...prev, Ly: parseFloat(e.target.value) || 1.5 }))}
                      />
                    </div>
                  </div>

                  {/* Boundary Conditions */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Boundary Gradients</h3>
                    <div className="space-y-2">
                      <Label htmlFor="fl">Left (fL)</Label>
                      <Input
                        id="fl"
                        type="number"
                        step="0.1"
                        value={params.fL}
                        onChange={(e) => setParams(prev => ({ ...prev, fL: parseFloat(e.target.value) || 0.0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fr">Right (fR)</Label>
                      <Input
                        id="fr"
                        type="number"
                        step="0.1"
                        value={params.fR}
                        onChange={(e) => setParams(prev => ({ ...prev, fR: parseFloat(e.target.value) || 0.0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ft">Top (fT)</Label>
                      <Input
                        id="ft"
                        type="number"
                        step="0.1"
                        value={params.fT}
                        onChange={(e) => setParams(prev => ({ ...prev, fT: parseFloat(e.target.value) || 0.0 }))}
                      />
                    </div>
                  </div>

                  {/* Simulation Parameters */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Simulation Settings</h3>
                    <div className="space-y-2">
                      <Label>Thermal Diffusivity (α): {params.alpha}</Label>
                      <Slider
                        value={[params.alpha]}
                        onValueChange={([value]) => setParams(prev => ({ ...prev, alpha: value }))}
                        min={0.01}
                        max={0.5}
                        step={0.01}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time Step (dt): {params.dt}</Label>
                      <Slider
                        value={[params.dt]}
                        onValueChange={([value]) => setParams(prev => ({ ...prev, dt: value }))}
                        min={0.0001}
                        max={0.01}
                        step={0.0001}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalTime">Total Time</Label>
                      <Input
                        id="totalTime"
                        type="number"
                        step="0.5"
                        value={params.totalTime}
                        onChange={(e) => setParams(prev => ({ ...prev, totalTime: parseFloat(e.target.value) || 5.0 }))}
                      />
                    </div>
                  </div>

                  {/* Grid Resolution */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Grid Resolution</h3>
                    <div className="space-y-2">
                      <Label>Grid Spacing (dx): {params.dx}</Label>
                      <Slider
                        value={[params.dx]}
                        onValueChange={([value]) => setParams(prev => ({ ...prev, dx: value }))}
                        min={0.01}
                        max={0.1}
                        step={0.005}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Grid Spacing (dy): {params.dy}</Label>
                      <Slider
                        value={[params.dy]}
                        onValueChange={([value]) => setParams(prev => ({ ...prev, dy: value }))}
                        min={0.01}
                        max={0.1}
                        step={0.005}
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={resetSimulation} className="w-full">
                  Apply Changes & Reset
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Color Scale Legend */}
          <div className="flex justify-center">
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">Temperature Scale</div>
              <div 
                className="h-4 w-64 rounded"
                style={{
                  background: 'linear-gradient(to right, rgb(0,0,255), rgb(0,255,255), rgb(0,255,0), rgb(255,255,0), rgb(255,0,0))'
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground w-64">
                <span>Cold</span>
                <span>Hot</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
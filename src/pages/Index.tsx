import { HeatEquation2D } from '@/components/HeatEquation2D';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">2D Heat Equation Solver</h1>
          <p className="text-xl text-muted-foreground">
            Interactive visualization of temperature distribution evolution using finite difference methods
          </p>
        </div>
        <HeatEquation2D />
      </div>
    </div>
  );
};

export default Index;

import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function Placeholder() {
  const location = useLocation();
  const pageName = location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{pageName}</h1>
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center text-muted-foreground">
            <Construction className="mx-auto h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Coming in Phase 2+</p>
            <p className="text-xs mt-1">This module will be built in upcoming phases</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

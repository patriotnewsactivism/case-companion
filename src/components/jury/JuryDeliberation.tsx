import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DeliberationStatement, Juror } from "@/lib/jury-api";

interface JuryDeliberationProps {
  statements: DeliberationStatement[];
  jurors: Juror[];
  currentStatementIndex?: number;
  className?: string;
}

export function JuryDeliberation({ 
  statements, 
  jurors, 
  currentStatementIndex,
  className 
}: JuryDeliberationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const getJuror = (jurorId: string) => {
    return jurors.find(j => j.id === jurorId);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [statements]);

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]" ref={scrollRef}>
          <div className="p-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {statements.map((statement, index) => {
                const juror = getJuror(statement.jurorId);
                const isCurrent = currentStatementIndex === index;
                const isPast = currentStatementIndex !== undefined && index < currentStatementIndex;
                
                return (
                  <motion.div
                    key={`${statement.jurorId}-${statement.timestamp}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${isCurrent ? 'ring-2 ring-primary rounded-lg p-2 -m-2' : ''}`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={juror?.avatar} alt={juror?.name} />
                      <AvatarFallback className="text-xs">
                        {juror?.name?.split(' ').map(n => n[0]).join('') || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{juror?.name || 'Unknown Juror'}</span>
                        <span className="text-xs text-muted-foreground">
                          {juror?.occupation}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {statement.statement}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

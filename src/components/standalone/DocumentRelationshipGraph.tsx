import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Network,
  FileText,
  Link2,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Users,
  Scale,
  Calendar,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Eye,
  Download,
  Copy,
  ExternalLink,
  X,
  Plus,
  Minus,
  Move,
  Hand,
  Layers,
  Filter,
  Hash,
  Beaker
} from 'lucide-react';

export interface DocumentNode {
  id: string;
  name: string;
  type: 'interrogatory' | 'request_for_production' | 'request_for_admission' | 'deposition' | 'document' | 'evidence' | 'motion' | 'other';
  party?: string;
  date?: string;
  status?: 'analyzed' | 'pending' | 'flagged';
  x?: number;
  y?: number;
}

export interface DocumentEdge {
  id: string;
  source: string;
  target: string;
  type: 'references' | 'contradicts' | 'supports' | 'same_party' | 'similar_topic' | 'timeline';
  label?: string;
  strength?: number;
}

export interface DocumentGraphProps {
  documents?: DocumentNode[];
  edges?: DocumentEdge[];
  onNodeClick?: (documentId: string) => void;
  onRelationshipClick?: (edgeId: string) => void;
  className?: string;
  height?: number;
}

export function DocumentRelationshipGraph({
  documents: initialDocuments = [],
  edges: initialEdges = [],
  onNodeClick,
  onRelationshipClick,
  className,
  height = 500
}: DocumentGraphProps) {
  const [documents, setDocuments] = useState<DocumentNode[]>(initialDocuments);
  const [edges, setEdges] = useState<DocumentEdge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DocumentEdge | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [showLabels, setShowLabels] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'force' | 'radial' | 'timeline'>('force');
  const svgRef = useRef<SVGSVGElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialDocuments.length > 0) {
      const newDocs = initialDocuments.map((doc, idx) => ({
        ...doc,
        x: doc.x || 200 + Math.cos(idx * 2 * Math.PI / initialDocuments.length) * 150,
        y: doc.y || 200 + Math.sin(idx * 2 * Math.PI / initialDocuments.length) * 150,
      }));
      setDocuments(newDocs);
    }
  }, [initialDocuments]);

  const filteredDocuments = useMemo(() => {
    if (filterType === 'all') return documents;
    return documents.filter(d => d.type === filterType);
  }, [documents, filterType]);

  const filteredEdges = useMemo(() => {
    const docIds = new Set(filteredDocuments.map(d => d.id));
    return edges.filter(e => docIds.has(e.source) && docIds.has(e.target));
  }, [edges, filteredDocuments]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.2, 0.3));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.3, Math.min(3, prev + delta)));
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleNodeClick = useCallback((node: DocumentNode) => {
    setSelectedNode(node);
    onNodeClick?.(node.id);
    
    const connectedIds = new Set<string>();
    edges.forEach(e => {
      if (e.source === node.id) connectedIds.add(e.target);
      if (e.target === node.id) connectedIds.add(e.source);
    });
    setHighlightedNode(connectedIds.size > 0 ? node.id : null);
  }, [edges, onNodeClick]);

  const handleEdgeClick = useCallback((edge: DocumentEdge) => {
    setSelectedEdge(edge);
    onRelationshipClick?.(edge.id);
  }, [onRelationshipClick]);

  const nodeColor = (type: string) => {
    switch (type) {
      case 'interrogatory': return '#3b82f6';
      case 'request_for_production': return '#8b5cf6';
      case 'request_for_admission': return '#06b6d4';
      case 'deposition': return '#f59e0b';
      case 'document': return '#64748b';
      case 'evidence': return '#10b981';
      case 'motion': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const edgeColor = (type: string) => {
    switch (type) {
      case 'references': return '#64748b';
      case 'contradicts': return '#ef4444';
      case 'supports': return '#10b981';
      case 'same_party': return '#3b82f6';
      case 'similar_topic': return '#8b5cf6';
      case 'timeline': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  const edgeStyle = (type: string) => {
    switch (type) {
      case 'contradicts': return '5,5';
      case 'references': return '';
      default: return '';
    }
  };

  const getStats = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    documents.forEach(d => {
      typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
    });
    return typeCounts;
  }, [documents]);

  const renderNode = (node: DocumentNode) => {
    const isHighlighted = highlightedNode === null || 
      node.id === highlightedNode ||
      edges.some(e => (e.source === highlightedNode && e.target === node.id) || 
                     (e.target === highlightedNode && e.source === node.id));
    const isSelected = selectedNode?.id === node.id;
    
    return (
      <g 
        key={node.id}
        transform={`translate(${node.x || 0}, ${node.y || 0})`}
        style={{ opacity: isHighlighted ? 1 : 0.3, transition: 'opacity 0.3s' }}
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          handleNodeClick(node);
        }}
      >
        <circle
          r={isSelected ? 30 : 24}
          fill={nodeColor(node.type)}
          fillOpacity={0.2}
          stroke={isSelected ? nodeColor(node.type) : nodeColor(node.type)}
          strokeWidth={isSelected ? 3 : 2}
          className="transition-all"
        />
        {node.status === 'flagged' && (
          <circle r={6} cx={20} cy={-20} fill="#ef4444" stroke="white" strokeWidth={2} />
        )}
        <text
          textAnchor="middle"
          dy={isSelected ? 45 : 40}
          className="text-xs fill-current"
          style={{ fontSize: 11 }}
        >
          {node.name.length > 15 ? node.name.substring(0, 15) + '...' : node.name}
        </text>
      </g>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Document Relationship Graph
            </CardTitle>
            <CardDescription>
              Visualize connections between discovery documents
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Documents</SelectItem>
              <SelectItem value="interrogatory">Interrogatories</SelectItem>
              <SelectItem value="request_for_production">Requests for Production</SelectItem>
              <SelectItem value="request_for_admission">Requests for Admission</SelectItem>
              <SelectItem value="deposition">Depositions</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
              <SelectItem value="evidence">Evidence</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            {Object.entries(getStats).slice(0, 5).map(([type, count]) => (
              <Badge key={type} variant="outline" className="gap-1">
                <span style={{ color: nodeColor(type) }}>●</span>
                {count} {type.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>

        <div 
          ref={containerRef}
          className="relative border rounded-lg overflow-hidden bg-slate-950/50"
          style={{ height }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => {
            setSelectedNode(null);
            setHighlightedNode(null);
          }}
        >
          <svg 
            ref={svgRef}
            width="100%" 
            height="100%"
            style={{ 
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center'
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>
            </defs>
            
            {filteredEdges.map((edge) => {
              const sourceNode = documents.find(d => d.id === edge.source);
              const targetNode = documents.find(d => d.id === edge.target);
              if (!sourceNode || !targetNode) return null;
              
              const isHighlighted = highlightedNode === null || 
                edge.source === highlightedNode || edge.target === highlightedNode;
              
              return (
                <g key={edge.id} style={{ opacity: isHighlighted ? 1 : 0.2 }}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={edgeColor(edge.type)}
                    strokeWidth={edge.strength || 2}
                    strokeDasharray={edgeStyle(edge.type)}
                    markerEnd="url(#arrowhead)"
                    className="cursor-pointer transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdgeClick(edge);
                    }}
                  />
                </g>
              );
            })}
            
            {filteredDocuments.map(renderNode)}
          </svg>

          {documents.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No documents to visualize</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add documents to see relationships
                </p>
              </div>
            </div>
          )}
        </div>

        {selectedNode && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: nodeColor(selectedNode.type) }}
                />
                <div>
                  <p className="font-medium">{selectedNode.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedNode.type.replace('_', ' ')} {selectedNode.party && `• ${selectedNode.party}`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {selectedNode.date && (
              <p className="text-sm text-muted-foreground mt-2">
                Date: {selectedNode.date}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline">
                <Eye className="h-4 w-4 mr-1" />
                View Document
              </Button>
              <Button size="sm" variant="outline">
                <Link2 className="h-4 w-4 mr-1" />
                Find Connections
              </Button>
            </div>
          </div>
        )}

        {selectedEdge && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium capitalize">{selectedEdge.type.replace('_', ' ')} Relationship</p>
                <p className="text-sm text-muted-foreground">
                  {selectedEdge.label || 'No description'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEdge(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> References
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Contradicts
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Supports
            </span>
          </div>
          <span>{filteredDocuments.length} nodes • {filteredEdges.length} connections</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default DocumentRelationshipGraph;

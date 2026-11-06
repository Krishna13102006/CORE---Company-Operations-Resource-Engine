import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import {
  Palette,
  Pencil,
  Highlighter,
  Minus,
  Square,
  Circle,
  Diamond,
  MoveRight,
  Type,
  StickyNote,
  Eraser,
  RotateCcw,
  Download,
  Trash2,
  X,
  Check
} from 'lucide-react';

interface WhiteboardProps {
  roomCode: string;
  initialData?: any;
  isHost?: boolean;
  userName?: string;
  onClose?: () => void;
}

export type WhiteboardTool =
  | 'pen'
  | 'highlighter'
  | 'line'
  | 'rect'
  | 'circle'
  | 'diamond'
  | 'arrow'
  | 'text'
  | 'sticky'
  | 'eraser';

interface CanvasElement {
  id: string;
  tool: WhiteboardTool;
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
}

const PALETTE = [
  '#ffffff', // White
  '#60a5fa', // Blue
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#f87171', // Red
  '#c084fc', // Purple
  '#38bdf8', // Cyan
  '#fb923c', // Orange
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
];

export const MeetingWhiteboard: React.FC<WhiteboardProps> = ({
  roomCode,
  initialData,
  isHost,
  userName = 'Member',
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTool, setCurrentTool] = useState<WhiteboardTool>('pen');
  const [currentColor, setCurrentColor] = useState<string>('#60a5fa');
  const [currentLineWidth, setCurrentLineWidth] = useState<number>(3);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const activeElementRef = useRef<CanvasElement | null>(null);

  // In-app modals state (eliminates native browser prompt/confirm)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [pendingTextPos, setPendingTextPos] = useState<{ x: number; y: number; tool: 'text' | 'sticky' } | null>(null);
  const [textContent, setTextContent] = useState<string>('');

  // Poll whiteboard data
  const { data: remoteData } = useQuery({
    queryKey: ['meeting-whiteboard', roomCode],
    queryFn: () => api.get(`/meetings/room/${roomCode}/whiteboard/`),
    refetchInterval: 3000,
  });

  // Sync whiteboard mutation
  const syncMutation = useMutation({
    mutationFn: (newElements: CanvasElement[]) =>
      api.post(`/meetings/room/${roomCode}/whiteboard/`, {
        elements: newElements,
        version: Date.now(),
      }),
  });

  // When remote elements update
  useEffect(() => {
    if (remoteData?.elements && !isDrawingRef.current) {
      setElements(remoteData.elements);
      renderAllElements(remoteData.elements);
    }
  }, [remoteData]);

  // Initial resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const rect = canvasRef.current.parentElement.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        renderAllElements(elements);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [elements]);

  const renderAllElements = (els: CanvasElement[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw dark background blueprint grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 32;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw elements
    els.forEach((el) => {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.tool === 'pen' && el.points && el.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.tool === 'highlighter' && el.points && el.points.length > 1) {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(el.lineWidth * 3.5, 14);
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.tool === 'line' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(el.startX, el.startY);
        ctx.lineTo(el.endX, el.endY);
        ctx.stroke();
      } else if (el.tool === 'rect' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
        ctx.strokeRect(el.startX, el.startY, el.endX - el.startX, el.endY - el.startY);
      } else if (el.tool === 'circle' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
        const radius = Math.hypot(el.endX - el.startX, el.endY - el.startY);
        ctx.beginPath();
        ctx.arc(el.startX, el.startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.tool === 'diamond' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
        const midX = (el.startX + el.endX) / 2;
        const midY = (el.startY + el.endY) / 2;
        ctx.beginPath();
        ctx.moveTo(midX, el.startY);
        ctx.lineTo(el.endX, midY);
        ctx.lineTo(midX, el.endY);
        ctx.lineTo(el.startX, midY);
        ctx.closePath();
        ctx.stroke();
      } else if (el.tool === 'arrow' && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
        ctx.beginPath();
        ctx.moveTo(el.startX, el.startY);
        ctx.lineTo(el.endX, el.endY);
        ctx.stroke();
        // Arrow head
        const angle = Math.atan2(el.endY - el.startY, el.endX - el.startX);
        ctx.beginPath();
        ctx.moveTo(el.endX, el.endY);
        ctx.lineTo(el.endX - 14 * Math.cos(angle - Math.PI / 6), el.endY - 14 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(el.endX - 14 * Math.cos(angle + Math.PI / 6), el.endY - 14 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (el.tool === 'text' && el.startX !== undefined && el.startY !== undefined) {
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillStyle = el.color;
        ctx.fillText(el.text || '', el.startX, el.startY);
      } else if (el.tool === 'sticky' && el.startX !== undefined && el.startY !== undefined) {
        const w = 140;
        const h = 95;
        ctx.fillStyle = '#fef08a'; // Yellow sticky note
        ctx.fillRect(el.startX, el.startY, w, h);
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 2;
        ctx.strokeRect(el.startX, el.startY, w, h);
        // Text
        ctx.fillStyle = '#0f172a';
        ctx.font = '500 12px Inter, sans-serif';
        ctx.fillText(el.text || 'Sticky Note', el.startX + 10, el.startY + 24);
      }
      ctx.restore();
    });
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    // If tool is text or sticky note, open styled in-app modal to capture text
    if (currentTool === 'text' || currentTool === 'sticky') {
      setPendingTextPos({ x, y, tool: currentTool });
      setTextContent('');
      return;
    }

    // If tool is eraser, remove element clicked near cursor
    if (currentTool === 'eraser') {
      const remaining = elements.filter((el) => {
        if (el.startX !== undefined && el.startY !== undefined) {
          if (el.endX !== undefined && el.endY !== undefined) {
            const minX = Math.min(el.startX, el.endX) - 15;
            const maxX = Math.max(el.startX, el.endX) + 15;
            const minY = Math.min(el.startY, el.endY) - 15;
            const maxY = Math.max(el.startY, el.endY) + 15;
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) return false;
          } else {
            if (Math.hypot(el.startX - x, el.startY - y) < 40) return false;
          }
        }
        if (el.points && el.points.length > 0) {
          return !el.points.some((p) => Math.hypot(p.x - x, p.y - y) < 20);
        }
        return true;
      });
      if (remaining.length !== elements.length) {
        setElements(remaining);
        renderAllElements(remaining);
        syncMutation.mutate(remaining);
      }
      return;
    }

    isDrawingRef.current = true;
    const newEl: CanvasElement = {
      id: Math.random().toString(36).substring(2, 9),
      tool: currentTool,
      color: currentColor,
      lineWidth: currentLineWidth,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      points: [{ x, y }],
    };

    activeElementRef.current = newEl;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeElementRef.current) return;
    const { x, y } = getCanvasCoords(e);

    if (currentTool === 'pen' || currentTool === 'highlighter') {
      activeElementRef.current.points?.push({ x, y });
    } else {
      activeElementRef.current.endX = x;
      activeElementRef.current.endY = y;
    }

    renderAllElements([...elements, activeElementRef.current]);
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current || !activeElementRef.current) return;
    isDrawingRef.current = false;

    const updated = [...elements, activeElementRef.current];
    setElements(updated);
    renderAllElements(updated);
    syncMutation.mutate(updated);
    activeElementRef.current = null;
  };

  const handleConfirmTextPlacement = () => {
    if (!pendingTextPos) return;
    const txt = textContent.trim() || (pendingTextPos.tool === 'sticky' ? 'Idea note' : 'Label');
    const newEl: CanvasElement = {
      id: Math.random().toString(36).substring(2, 9),
      tool: pendingTextPos.tool,
      color: currentColor,
      lineWidth: currentLineWidth,
      startX: pendingTextPos.x,
      startY: pendingTextPos.y,
      text: txt,
    };
    const updated = [...elements, newEl];
    setElements(updated);
    renderAllElements(updated);
    syncMutation.mutate(updated);
    setPendingTextPos(null);
    setTextContent('');
  };

  const handleUndo = () => {
    if (elements.length === 0) return;
    const updated = elements.slice(0, -1);
    setElements(updated);
    renderAllElements(updated);
    syncMutation.mutate(updated);
  };

  const handleExecuteClearCanvas = () => {
    setElements([]);
    renderAllElements([]);
    syncMutation.mutate([]);
    setIsClearConfirmOpen(false);
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_whiteboard_${roomCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-950 text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
      {/* Top Whiteboard Controls Bar */}
      <div className="min-h-14 bg-slate-900 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 z-10">
        {/* Left: Comprehensive Drawing Tools */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('pen')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'pen' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Freehand Pen"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pen</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('highlighter')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'highlighter' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Highlighter Marker"
          >
            <Highlighter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Highlight</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('line')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'line' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Straight Line"
          >
            <Minus className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Line</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('arrow')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'arrow' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Arrow (Architecture Flow)"
          >
            <MoveRight className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Arrow</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('rect')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'rect' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Rectangle / Microservice"
          >
            <Square className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Box</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('diamond')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'diamond' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Diamond / Flowchart Decision"
          >
            <Diamond className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Diamond</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('circle')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'circle' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Circle / Database"
          >
            <Circle className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Circle</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('text')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'text' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Text Label"
          >
            <Type className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Text</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('sticky')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'sticky' ? 'bg-primary text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Sticky Note Idea"
          >
            <StickyNote className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Sticky</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentTool('eraser')}
            className={`h-8 px-2 rounded-lg text-xs gap-1.5 ${
              currentTool === 'eraser' ? 'bg-rose-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-rose-400'
            }`}
            title="Eraser (Click item to delete)"
          >
            <Eraser className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Eraser</span>
          </Button>

          {/* Stroke Width Toggle */}
          <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw.value}
                type="button"
                onClick={() => setCurrentLineWidth(sw.value)}
                className={`h-6 px-1.5 text-[10px] font-semibold rounded transition-all ${
                  currentLineWidth === sw.value
                    ? 'bg-primary text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Stroke: ${sw.label}`}
              >
                {sw.label}
              </button>
            ))}
          </div>

          {/* Color Palette */}
          <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrentColor(c)}
                className={`h-4.5 w-4.5 rounded-full transition-transform ${
                  currentColor === c
                    ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900'
                    : 'opacity-70 hover:opacity-100 hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                title={`Color: ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Right: Actions (Undo, Styled In-App Clear, Export, Close) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleUndo}
            disabled={elements.length === 0}
            className="h-8 px-2 text-xs text-slate-400 hover:text-white gap-1"
            title="Undo Last Stroke"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Undo</span>
          </Button>

          {/* Styled Clear Button (Opens in-app CORE modal) */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={elements.length === 0}
            className="h-8 px-2 text-xs text-slate-400 hover:text-rose-400 gap-1"
            title="Clear Whiteboard Canvas"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Clear</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportPNG}
            className="h-8 px-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-md"
            title="Export High-Res Image"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export PNG</span>
          </Button>

          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Drawing Canvas */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`absolute inset-0 touch-none ${
            currentTool === 'eraser' ? 'cursor-not-allowed' : 'cursor-crosshair'
          }`}
        />
      </div>

      {/* CORE In-App Clear Canvas Confirmation Modal (NO native browser confirm) */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Clear Canvas?</h3>
              <p className="text-xs text-slate-400 mt-1">
                This will wipe out all whiteboard elements and diagrams for everyone in this meeting room.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsClearConfirmOpen(false)}
                className="flex-1 border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecuteClearCanvas}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CORE In-App Text / Sticky Note Input Modal (NO native browser prompt) */}
      {pendingTextPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                {pendingTextPos.tool === 'sticky' ? (
                  <StickyNote className="h-4 w-4 text-amber-400" />
                ) : (
                  <Type className="h-4 w-4 text-indigo-400" />
                )}
                {pendingTextPos.tool === 'sticky' ? 'Add Sticky Note' : 'Add Text Label'}
              </span>
              <button
                type="button"
                onClick={() => setPendingTextPos(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmTextPlacement();
              }}
              placeholder={pendingTextPos.tool === 'sticky' ? 'Write idea / note...' : 'Type label...'}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPendingTextPos(null)}
                className="h-8 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmTextPlacement}
                className="h-8 px-4 text-xs font-bold bg-primary text-primary-foreground"
              >
                Place on Canvas
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

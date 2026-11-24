import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import Dialog from './Dialog.jsx';
import Button from './Button.jsx';
import { compressCanvas } from '../../lib/image.js';

const ASPECT = 19 / 11, OUT_W = 760, MAX_ZOOM = 4;

/* Drag to move, slider to zoom. The frame has the same shape as the image area of the pop-up ad. */
export default function Cropper({ open, src, onClose, onDone }) {
  const frame = useRef(null), imgRef = useRef(null), drag = useRef(null);
  const [nat, setNat] = useState(null), [zoom, setZoom] = useState(1), [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => { if (open) { setNat(null); setZoom(1); setPos({ x: 0, y: 0 }); } }, [open, src]);

  const r = nat ? nat.w / nat.h : 1;
  const fitW = Math.max(1, r / ASPECT);
  const clamp = (p, z) => {
    const w = fitW * z, h = w / r;
    const mx = (w - 1) / 2, my = (h * ASPECT - 1) / 2;
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };
  const setZ = (z) => { const v = Math.max(1, Math.min(MAX_ZOOM, z)); setZoom(v); setPos((p) => clamp(p, v)); };

  const down = (e) => { if (!nat) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y }; };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const b = frame.current.getBoundingClientRect();
    setPos(clamp({ x: d.x + (e.clientX - d.px) / b.width, y: d.y + (e.clientY - d.py) / b.height }, zoom));
  };
  const up = () => { drag.current = null; };

  function apply() {
    try {
      onDone(compressCanvas((x, W, H) => {
        const dw = fitW * zoom * W, dh = dw / r;
        x.drawImage(imgRef.current, W * (0.5 + pos.x) - dw / 2, H * (0.5 + pos.y) - dh / 2, dw, dh);
      }, OUT_W, Math.round(OUT_W / ASPECT)));
    } catch (e) { alert(e.message); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Crop image">
      <p className="muted small">Drag the image to move it. Use the slider to zoom. The frame is exactly what shows in the pop-up ad.</p>
      <div ref={frame} className="crop" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => setZ(zoom - e.deltaY * 0.002)}>
        {src && <img ref={imgRef} src={src} alt="" draggable="false" onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          style={nat ? { width: `${fitW * zoom * 100}%`, left: `${(0.5 + pos.x) * 100}%`, top: `${(0.5 + pos.y) * 100}%` } : { opacity: 0 }} />}
      </div>
      <div className="crop__zoom">
        <button type="button" className="iconbtn iconbtn--sm" aria-label="Zoom out" onClick={() => setZ(zoom - 0.25)}><ZoomOut size={16} aria-hidden="true" /></button>
        <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={zoom} onChange={(e) => setZ(Number(e.target.value))} aria-label="Zoom" />
        <button type="button" className="iconbtn iconbtn--sm" aria-label="Zoom in" onClick={() => setZ(zoom + 0.25)}><ZoomIn size={16} aria-hidden="true" /></button>
      </div>
      <div className="dlg__actions"><Button onClick={apply} disabled={!nat}>Use this crop</Button><Button variant="quiet" onClick={onClose}>Cancel</Button></div>
    </Dialog>
  );
}
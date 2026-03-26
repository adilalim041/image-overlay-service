import { useEffect } from 'react';

export function usePan(canvasRef, containerRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;
    let spacePressed = false;

    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.code === 'Space' && !e.repeat) {
        spacePressed = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
        e.preventDefault();
      }
    };

    const onKeyUp = (e) => {
      if (e.code !== 'Space') return;
      spacePressed = false;
      isPanning = false;
      canvas.__isPanning = false;
      canvas.selection = true;
      canvas.skipTargetFind = false;
      if (containerRef.current) containerRef.current.style.cursor = 'default';
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onMouseDown = (opt) => {
      if (spacePressed && opt.e.button === 0) {
        isPanning = true;
        lastX = opt.e.clientX;
        lastY = opt.e.clientY;
        canvas.__isPanning = true;
        canvas.selection = false;
        canvas.skipTargetFind = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
        opt.e.preventDefault();
        opt.e.stopPropagation();
      } else {
        canvas.__isPanning = false;
      }
    };

    const onMouseMove = (opt) => {
      if (!isPanning || !spacePressed) return;
      const vt = canvas.viewportTransform;
      if (!vt) return;
      vt[4] += opt.e.clientX - lastX;
      vt[5] += opt.e.clientY - lastY;
      lastX = opt.e.clientX;
      lastY = opt.e.clientY;
      canvas.setViewportTransform(vt);
      canvas.requestRenderAll();
    };

    const onMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        canvas.__isPanning = false;
        canvas.selection = true;
        canvas.skipTargetFind = false;
        if (containerRef.current) containerRef.current.style.cursor = spacePressed ? 'grab' : 'default';
      }
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [canvasRef, containerRef]);
}

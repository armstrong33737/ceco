// packages/frontend/src/modules/learners/components/WebcamCaptureModal.jsx
import React, { useRef, useEffect } from "react";
import Button from "../../../design-system/primitives/Button";
import Icon from "../../../components/Icon";

export default function WebcamCaptureModal({
  isOpen,
  onClose,
  onCapture,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {
          onClose();
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  function handleTakeSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const side = Math.min(vw, vh);
    const sx = Math.max(0, Math.floor((vw - side) / 2));
    const sy = Math.max(0, Math.floor((vh - side) / 2));

    const outSize = 360;
    const canvas = document.createElement("canvas");
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, sx, sy, side, side, 0, 0, outSize, outSize);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);

    onCapture(dataUrl);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-surface p-5 rounded border border-border shadow-modal space-y-4 w-full max-w-md text-center dark:bg-surface-dark dark:border-border-dark">
        <div className="flex justify-between items-center border-b border-border pb-3 dark:border-border-dark">
          <h4 className="text-body-md font-semibold text-ink-primary dark:text-white">Capture Photo par Webcam</h4>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink-primary"><Icon name="close" className="text-[18px]" /></button>
        </div>
        <div className="w-[280px] h-[280px] mx-auto rounded-[2px] overflow-hidden bg-black relative border-2 border-brand-900 dark:border-brand-500">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-white/60 m-4 rounded-[2px]" />
        </div>
        <div className="flex justify-center gap-2.5">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" icon="photo_camera" onClick={handleTakeSnapshot}>
            Capturer la Photo
          </Button>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import { useIsFetching } from '@tanstack/react-query';

export function GlobalSyncIndicator() {
  const isFetching = useIsFetching();
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isFetching > 0) {
      // Show immediately but progress smoothly
      setShow(true);
    } else {
      // Delay hide to let the animation "finish"
      timer = setTimeout(() => setShow(false), 500);
    }
    return () => clearTimeout(timer);
  }, [isFetching]);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-0.5 z-[99999] pointer-events-none overflow-hidden">
      <div className="w-full h-full bg-indigo-600/20 absolute" />
      <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse" 
           style={{
             width: '50%',
             animation: 'indeterminate-progress 2s infinite linear',
             transformOrigin: '0% 50%'
           }} 
      />
      <style>{`
        @keyframes indeterminate-progress {
          0% { transform: translateX(-100%) scaleX(0.2); }
          50% { transform: translateX(0) scaleX(0.5); }
          100% { transform: translateX(200%) scaleX(0.2); }
        }
      `}</style>
    </div>
  );
}

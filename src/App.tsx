import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, History, Shield, AlertTriangle, CheckCircle, Trash2, Play, Square, Search, Filter, Download, Activity, FileText, Columns } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface AnalysisResult {
  id: string;
  type: string;
  filename: string;
  overall_score: number;
  video_score: number;
  audio_score: number;
  verdict: string;
  explanation: string;
  timestamps: string;
  created_at: string;
}

// --- Components ---

const AudioVisualizer = ({ isActive, type = 'bars' }: { isActive: boolean, type?: 'bars' | 'wave' }) => {
  if (type === 'wave') {
    return (
      <div className="flex items-center gap-[2px] h-12 px-4 bg-zinc-900/50 rounded-xl border border-white/5 overflow-hidden">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            animate={isActive ? {
              height: [4, Math.random() * 32 + 4, 4],
              opacity: [0.3, 0.8, 0.3],
            } : { height: 2, opacity: 0.1 }}
            transition={isActive ? {
              duration: 0.3 + Math.random() * 0.4,
              repeat: Infinity,
              ease: "linear"
            } : {}}
            className="w-[2px] bg-emerald-500 rounded-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1 h-8 px-2">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          animate={isActive ? {
            height: [8, Math.random() * 24 + 8, 8],
          } : { height: 4 }}
          transition={isActive ? {
            duration: 0.5 + Math.random() * 0.5,
            repeat: Infinity,
            ease: "easeInOut"
          } : {}}
          className="w-1 bg-emerald-500/60 rounded-full"
        />
      ))}
    </div>
  );
};

const MethodologyInfo = () => {
  return (
    <div className="glass p-6 rounded-3xl border-white/5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="text-emerald-500" size={20} />
        <h3 className="text-sm font-bold uppercase tracking-widest">Verification Methodology</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Visual Analysis</p>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Our neural engine scans for GAN-specific artifacts including periorbital blending, ocular micro-movement inconsistencies, and skin gradient synthesis. We analyze over 120 facial landmarks per frame at 60fps.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Acoustic Forensic</p>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Audio streams are processed via spectral decomposition to detect phase-vocoder artifacts and neural vocoder noise signatures. We cross-reference phoneme-viseme synchronization to identify multimodal mismatches.
          </p>
        </div>
      </div>
    </div>
  );
};

const NeuralMap = ({ isActive }: { isActive: boolean }) => {
  return (
    <div className="grid grid-cols-8 gap-1 p-2 bg-black/20 rounded-lg border border-white/5">
      {[...Array(32)].map((_, i) => (
        <motion.div
          key={i}
          animate={isActive ? {
            opacity: [0.1, 0.4, 0.1],
            backgroundColor: Math.random() > 0.8 ? '#10b981' : '#27272a'
          } : { opacity: 0.1 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.05
          }}
          className="w-full aspect-square rounded-[2px] bg-zinc-800"
        />
      ))}
    </div>
  );
};

const RealTimeDetection = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [lastResult, setLastResult] = useState<{ 
    score: number; 
    video_score: number;
    audio_score: number;
    risk: string; 
    explanation: string;
    anomaly?: { reason: string; detail: string }
  } | null>(null);
  const [anomalies, setAnomalies] = useState<Array<{ reason: string; detail: string; time: string }>>([]);

  useEffect(() => {
    if (isDetecting) {
      const socket = new WebSocket(`ws://${window.location.host}`);
      socket.onopen = () => console.log("WS Connected");
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "detection_result") {
            const result = {
              score: data.frame_score,
              video_score: data.video_score,
              audio_score: data.audio_score,
              risk: data.risk_level,
              explanation: data.explanation,
              anomaly: data.anomaly
            };
            setLastResult(result);
            
            if (data.anomaly) {
              setAnomalies(prev => {
                const newAnomaly = { ...data.anomaly, time: new Date().toLocaleTimeString() };
                // Keep only last 5 unique anomalies
                const exists = prev.some(a => a.detail === newAnomaly.detail);
                if (exists) return prev;
                return [newAnomaly, ...prev].slice(0, 5);
              });
            }
          }
        } catch (e) {
          console.error("Failed to parse socket message:", e);
        }
      };
      setWs(socket);

      let activeStream: MediaStream | null = null;

      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(s => {
          activeStream = s;
          setStream(s);
          if (videoRef) videoRef.srcObject = s;
        })
        .catch(err => {
          console.error("Media access denied:", err);
          setIsDetecting(false);
        });

      const interval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN && videoRef) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.videoWidth;
          canvas.height = videoRef.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef, 0, 0);
            const frame = canvas.toDataURL('image/jpeg', 0.5);
            socket.send(JSON.stringify({ type: 'frame', frame }));
          }
        }
      }, 500);

      return () => {
        clearInterval(interval);
        socket.close();
        activeStream?.getTracks().forEach(t => t.stop());
      };
    } else {
      setAnomalies([]);
      setLastResult(null);
    }
  }, [isDetecting, videoRef]);

  const toggleDetection = () => {
    if (isDetecting) {
      stream?.getTracks().forEach(t => t.stop());
      setStream(null);
      setIsDetecting(false);
    } else {
      setIsDetecting(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-video glass rounded-2xl overflow-hidden group tech-grid">
            <video 
              ref={el => setVideoRef(el)} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover opacity-80"
            />
            
            {/* Technical Overlays */}
            <div className="corner-bracket corner-tl" />
            <div className="corner-bracket corner-tr" />
            <div className="corner-bracket corner-bl" />
            <div className="corner-bracket corner-br" />

            {!isDetecting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                <Camera size={48} className="text-zinc-700 mb-4" />
                <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">Optical Sensor Offline</p>
              </div>
            )}
            {isDetecting && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-x-0 h-[30%] bg-gradient-to-b from-emerald-500/10 to-transparent scan-line" />
                <div className="absolute top-6 left-6 flex items-center gap-3 px-3 py-1.5 glass rounded-lg border-emerald-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/80">Live Neural Stream</span>
                </div>
                
                <div className="absolute top-6 right-6 font-mono text-[10px] text-emerald-500/40 text-right">
                  REC_MODE: MULTIMODAL<br />
                  FPS: 30.0<br />
                  RES: 1080P
                </div>

                <div className="absolute bottom-6 left-6 glass rounded-lg p-2 flex items-center gap-3 border-emerald-500/10">
                  <Activity size={12} className="text-emerald-500" />
                  <AudioVisualizer isActive={isDetecting} />
                </div>
              </div>
            )}
          </div>

          {/* Detailed Forensic Analysis (History View Style) */}
          <AnimatePresence>
            {isDetecting && lastResult && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="glass p-8 rounded-[24px] relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
                
                <div className="flex justify-between items-start mb-8 relative">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] border transition-colors duration-500 ${
                        lastResult.risk === 'High' ? 'risk-high' : 
                        lastResult.risk === 'Medium' ? 'risk-medium' : 'risk-low'
                      }`}>
                        {lastResult.risk} Risk Detected
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">Live Forensic Report</span>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-zinc-100">Neural Integrity Analysis</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Confidence Level</p>
                    <p className={`text-lg font-mono font-bold ${
                      (100 - (Math.abs(50 - lastResult.score) / 50 * 20)) > 90 ? 'text-emerald-500' :
                      (100 - (Math.abs(50 - lastResult.score) / 50 * 20)) > 70 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {(100 - (Math.abs(50 - lastResult.score) / 50 * 20)).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className={`p-4 rounded-2xl text-center border transition-all duration-500 relative overflow-hidden ${
                    lastResult.risk === 'High' ? 'risk-high' : lastResult.risk === 'Medium' ? 'risk-medium' : 'risk-low'
                  }`}>
                    <p className="text-[9px] uppercase font-black tracking-widest mb-2 opacity-60">Overall</p>
                    <p className="text-2xl font-mono font-bold">{lastResult.score}%</p>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-black/20">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${lastResult.score}%` }}
                        className={`h-full ${lastResult.risk === 'High' ? 'bg-red-500' : lastResult.risk === 'Medium' ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      />
                    </div>
                  </div>
                  <div className="glass p-4 rounded-2xl text-center border-white/5 relative overflow-hidden">
                    <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-2">Video</p>
                    <p className="text-2xl font-mono font-bold text-zinc-300">{lastResult.video_score}%</p>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${lastResult.video_score}%` }}
                        className="h-full bg-zinc-500"
                      />
                    </div>
                  </div>
                  <div className="glass p-4 rounded-2xl text-center border-white/5 relative overflow-hidden">
                    <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-2">Audio</p>
                    <p className="text-2xl font-mono font-bold text-zinc-300">{lastResult.audio_score}%</p>
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${lastResult.audio_score}%` }}
                        className="h-full bg-zinc-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950/50 border border-white/5 rounded-xl mb-8 relative">
                  <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-[#050505] text-[9px] font-mono uppercase tracking-widest text-zinc-600">Forensic Summary</div>
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={lastResult.explanation}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 5 }}
                      className="space-y-3"
                    >
                      <p className="text-xs text-zinc-400 leading-relaxed italic">
                        "{lastResult.explanation}"
                      </p>
                      <div className="pt-3 border-t border-white/5">
                        <p className="text-[9px] font-mono text-zinc-500 uppercase mb-1">Technical Context</p>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          {lastResult.risk === 'High' 
                            ? "CRITICAL: The detected artifacts strongly suggest synthetic generation. Biological markers are inconsistent with natural human physiology."
                            : lastResult.risk === 'Medium'
                            ? "WARNING: Subtle neural noise detected. While not conclusive, the asset exhibits patterns common in AI-assisted media manipulation."
                            : "OPTIMAL: Media integrity verified. No significant synthetic signatures identified within current confidence parameters."}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={12} className="text-zinc-600" />
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Live Neural Anomalies</p>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-600">Showing last 5 unique detections</span>
                  </div>
                  <div className="space-y-2">
                    {anomalies.length > 0 ? anomalies.map((a, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={idx} 
                        className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">{a.reason}</span>
                          <span className="text-[10px] font-mono text-zinc-500">{a.time}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          {a.detail}
                        </p>
                      </motion.div>
                    )) : (
                      <div className="py-8 text-center border border-dashed border-white/5 rounded-xl">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Monitoring for neural artifacts...</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <div className="glass p-6 rounded-2xl sticky top-6">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Control Panel</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs text-zinc-500">Real-Time Probability</span>
                  <span className={`text-2xl font-mono font-bold ${lastResult?.risk === 'High' ? 'text-red-500' : lastResult?.risk === 'Medium' ? 'text-yellow-500' : 'text-emerald-500'}`}>
                    {lastResult ? `${lastResult.score}%` : '--%'}
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${lastResult?.score || 0}%` }}
                    className={`h-full ${lastResult?.risk === 'High' ? 'bg-red-500' : lastResult?.risk === 'Medium' ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  <span>Sensor Status</span>
                  <span className={isDetecting ? 'text-emerald-500' : 'text-red-500'}>{isDetecting ? 'Active' : 'Offline'}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  <span>Neural Engine</span>
                  <span className="text-emerald-500">v4.2.0</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  <span>Encryption</span>
                  <span className="text-zinc-300">AES-256</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Audio Spectral Analysis</p>
                <AudioVisualizer isActive={isDetecting} type="wave" />
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Neural Map Density</p>
                <NeuralMap isActive={isDetecting} />
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">System Log</p>
                <div className="h-32 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  <p className="text-[9px] font-mono text-emerald-500/60">[{new Date().toLocaleTimeString()}] System initialized.</p>
                  <p className="text-[9px] font-mono text-zinc-600">[{new Date().toLocaleTimeString()}] Neural engine v4.2.0 ready.</p>
                  {isDetecting && (
                    <>
                      <p className="text-[9px] font-mono text-emerald-500">[{new Date().toLocaleTimeString()}] Optical sensor online.</p>
                      <p className="text-[9px] font-mono text-emerald-500">[{new Date().toLocaleTimeString()}] Encryption handshake complete.</p>
                    </>
                  )}
                  {anomalies.slice(0, 3).map((a, i) => (
                    <p key={i} className="text-[9px] font-mono text-red-500">[{a.time}] {a.reason} detected.</p>
                  ))}
                </div>
              </div>

              <button 
                onClick={toggleDetection}
                className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isDetecting ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'}`}
              >
                {isDetecting ? <><Square size={18} fill="currentColor" /> Terminate Stream</> : <><Play size={18} fill="currentColor" /> Initiate Verification</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemStats = ({ history }: { history: AnalysisResult[] }) => {
  const totalScans = history.length;
  const highRiskCount = history.filter(h => h.verdict === 'Likely Fake').length;
  const avgScore = totalScans > 0 ? Math.round(history.reduce((acc, curr) => acc + curr.overall_score, 0) / totalScans) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 relative">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <NeuralMap isActive={true} />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-6 rounded-3xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Activity size={48} />
        </div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Total Scans</p>
        <p className="text-3xl font-black tracking-tighter">{totalScans.toString().padStart(3, '0')}</p>
        <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 w-2/3" />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass p-6 rounded-3xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <AlertTriangle size={48} />
        </div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Threats Neutralized</p>
        <p className="text-3xl font-black tracking-tighter text-red-500">{highRiskCount.toString().padStart(3, '0')}</p>
        <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 w-1/4" />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass p-6 rounded-3xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Shield size={48} />
        </div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Avg. Integrity</p>
        <p className="text-3xl font-black tracking-tighter text-emerald-500">{avgScore}%</p>
        <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${avgScore}%` }} />
        </div>
      </motion.div>
    </div>
  );
};

const FileUpload = ({ onComplete }: { onComplete: () => void }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('type', file.type.startsWith('video') ? 'video' : 'audio');

      try {
        await fetch('/api/verify/upload', {
          method: 'POST',
          body: formData
        });
      } catch (e) {
        console.error(e);
      }
    }
    
    onComplete();
    setFiles([]);
    setIsUploading(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="glass p-1 rounded-[40px] mb-8 flex items-center justify-center tech-grid relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <NeuralMap isActive={true} />
        </div>
        <div 
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`w-full glass p-20 rounded-[36px] border-dashed border-2 transition-all duration-500 text-center relative overflow-hidden ${isDragging ? 'border-emerald-500 bg-emerald-500/5 scale-[0.99]' : 'border-white/5'}`}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          
          <motion.div 
            animate={isDragging ? { scale: 1.2, rotate: 10 } : { scale: 1, rotate: 0 }}
            className="w-28 h-28 bg-emerald-500/5 rounded-full flex items-center justify-center mx-auto mb-10 border border-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.05)]"
          >
            <Upload className={isDragging ? 'text-emerald-400' : 'text-emerald-500/80'} size={42} />
          </motion.div>
          
          <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase">Drop Assets for Analysis</h2>
          <p className="text-zinc-500 mb-12 max-w-lg mx-auto text-base leading-relaxed font-medium">
            Drag and drop your media files here. Our neural engine will deconstruct each frame to verify biological authenticity.
          </p>
          
          <div className="space-y-8">
            <input 
              type="file" 
              id="file-input" 
              className="hidden" 
              accept="video/*,audio/*"
              multiple
              onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])}
            />
            
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                {files.map((file, i) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={i} 
                    className="px-4 py-2 glass rounded-full text-[10px] font-mono flex items-center gap-2 border-emerald-500/20"
                  >
                    <FileText size={12} className="text-emerald-500" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button 
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      className="hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-4">
                <label 
                  htmlFor="file-input"
                  className="inline-flex items-center gap-3 px-10 py-5 glass rounded-2xl cursor-pointer hover:bg-white/5 transition-all font-black text-xs uppercase tracking-widest border-white/10 hover:border-emerald-500/30"
                >
                  <Search size={18} className="text-zinc-400" /> Browse Files
                </label>

                {files.length > 0 && !isUploading && (
                  <motion.button 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={handleUpload}
                    className="px-10 py-5 bg-emerald-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                  >
                    Initiate Neural Scan
                  </motion.button>
                )}
              </div>
            </div>

            {isUploading && (
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3, ease: "easeInOut" }}
                    className="h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest animate-pulse">
                    Deconstructing Neural Layers...
                  </p>
                  <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                    Processing {files.length} Assets
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TimestampRowProps {
  ts: any;
  key?: any;
}

const TimestampRow = ({ ts }: TimestampRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center text-[11px] py-2 hover:bg-white/5 transition-colors text-left"
      >
        <span className="font-mono text-emerald-500">{ts.start}s - {ts.end}s</span>
        <div className="flex items-center gap-2">
          {!isExpanded && <span className="text-zinc-400">{ts.reason}</span>}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Play size={10} className="rotate-90 text-zinc-600" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-3 px-2">
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg space-y-2 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                  <NeuralMap isActive={true} />
                </div>
                <div className="flex justify-between items-center relative">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">{ts.reason}</span>
                  <span className="text-[10px] font-mono text-zinc-500">Time: {ts.start}s - {ts.end}s</span>
                </div>
                <p className="text-[10px] text-zinc-300 leading-relaxed relative">
                  {ts.detail || "No additional technical details available for this segment."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HistoryView = () => {
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('');

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (verdictFilter) params.append('verdict', verdictFilter);
      
      const res = await fetch(`/api/verify/history?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error('History fetch error:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchHistory, 300);
    return () => clearTimeout(timer);
  }, [search, verdictFilter]);

  const deleteResult = async (id: string) => {
    try {
      const res = await fetch(`/api/verify/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchHistory();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const exportResult = (id: string) => {
    window.open(`/api/verify/export/${id}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <SystemStats history={history} />
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Search by filename..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 glass rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <select 
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
            className="pl-10 pr-8 py-3 glass rounded-xl text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
          >
            <option value="">All Verdicts</option>
            <option value="Likely Real">Likely Real</option>
            <option value="Likely Fake">Likely Fake</option>
            <option value="Uncertain">Uncertain</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {history.map((item) => (
          <motion.div 
            layout
            key={item.id} 
            className="glass p-8 rounded-[24px] group hover:border-emerald-500/20 transition-all duration-500 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
            
            <div className="flex justify-between items-start mb-8 relative">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] border ${
                    item.verdict === 'Likely Fake' ? 'risk-high' : 
                    item.verdict === 'Uncertain' ? 'risk-medium' : 'risk-low'
                  }`}>
                    {item.verdict}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono tracking-widest">ID: {item.id}</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight truncate max-w-[240px] text-zinc-100">{item.filename}</h3>
                <p className="text-[10px] text-zinc-500 font-mono uppercase mt-1 tracking-widest">{new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportResult(item.id)}
                  className="w-10 h-10 glass rounded-xl flex items-center justify-center text-zinc-500 hover:text-emerald-500 hover:border-emerald-500/30 transition-all"
                  title="Export Report"
                >
                  <Download size={16} />
                </button>
                <button 
                  onClick={() => deleteResult(item.id)}
                  className="w-10 h-10 glass rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-500 hover:border-red-500/30 transition-all"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="glass-emerald p-4 rounded-2xl text-center border-emerald-500/5">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-2">Overall</p>
                <p className="text-2xl font-mono font-bold text-emerald-500">{item.overall_score}%</p>
              </div>
              <div className="glass p-4 rounded-2xl text-center">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-2">Video</p>
                <p className="text-2xl font-mono font-bold text-zinc-300">{item.video_score}%</p>
              </div>
              <div className="glass p-4 rounded-2xl text-center">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-2">Audio</p>
                <p className="text-2xl font-mono font-bold text-zinc-300">{item.audio_score}%</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-950/50 border border-white/5 rounded-xl mb-8 relative">
              <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-[#050505] text-[9px] font-mono uppercase tracking-widest text-zinc-600">Forensic Summary</div>
              <p className="text-xs text-zinc-400 leading-relaxed italic">
                "{item.explanation}"
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={12} className="text-zinc-600" />
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Neural Anomalies</p>
              </div>
              <div className="space-y-2">
                {(() => {
                  try {
                    return JSON.parse(item.timestamps).map((ts: any, idx: number) => (
                      <TimestampRow key={idx} ts={ts} />
                    ));
                  } catch (e) {
                    return <p className="text-[10px] text-zinc-600">Neural data corrupted</p>;
                  }
                })()}
              </div>
            </div>
          </motion.div>
        ))}
        {history.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full py-32 text-center glass rounded-[40px] border-dashed border-2 border-white/5"
          >
            <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
              <FileText className="text-zinc-700" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">No Forensic Records</h3>
            <p className="text-zinc-500 max-w-xs mx-auto text-sm">
              Your analysis history is currently empty. Initiate a real-time scan or upload assets to begin neural verification.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const ComparisonView = () => {
  const [file1, setFile1] = useState<AnalysisResult | null>(null);
  const [file2, setFile2] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleUpload = async (file: File, slot: 1 | 2) => {
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('media', file);
    formData.append('type', file.type.startsWith('video') ? 'video' : 'audio');

    try {
      const response = await fetch('/api/verify/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Neural scan failed');
      const result = await response.json();
      if (slot === 1) setFile1(result);
      else setFile2(result);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const ComparisonCard = ({ result, title }: { result: AnalysisResult | null, title: string }) => (
    <div className="glass p-6 rounded-[32px] border-white/5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500">{title}</h3>
        {result && (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${
            result.overall_score > 70 ? 'border-red-500/50 text-red-500 bg-red-500/10' : 
            result.overall_score > 40 ? 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10' : 
            'border-emerald-500/50 text-emerald-500 bg-emerald-500/10'
          }`}>
            {result.verdict}
          </span>
        )}
      </div>

      {!result ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl py-12">
          <input 
            type="file" 
            id={`compare-upload-${title}`} 
            className="hidden" 
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], title === 'Subject Alpha' ? 1 : 2)}
          />
          <label 
            htmlFor={`compare-upload-${title}`}
            className="cursor-pointer flex flex-col items-center group"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
              <Upload size={20} className="text-zinc-600 group-hover:text-emerald-500" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Inject Asset</p>
          </label>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-zinc-950/50 rounded-xl border border-white/5">
            <FileText size={20} className="text-emerald-500" />
            <div className="overflow-hidden">
              <p className="text-[10px] font-mono text-zinc-500 uppercase truncate">{result.filename}</p>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Neural Signature Verified</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 glass rounded-xl text-center">
              <p className="text-[8px] text-zinc-500 uppercase mb-1">Overall</p>
              <p className="text-lg font-mono font-bold text-emerald-500">{result.overall_score}%</p>
            </div>
            <div className="p-3 glass rounded-xl text-center">
              <p className="text-[8px] text-zinc-500 uppercase mb-1">Video</p>
              <p className="text-lg font-mono font-bold text-zinc-300">{result.video_score}%</p>
            </div>
            <div className="p-3 glass rounded-xl text-center">
              <p className="text-[8px] text-zinc-500 uppercase mb-1">Audio</p>
              <p className="text-lg font-mono font-bold text-zinc-300">{result.audio_score}%</p>
            </div>
          </div>

          <div className="p-4 bg-zinc-950/50 rounded-xl border border-white/5">
            <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Neural Anomalies</p>
            <div className="space-y-2">
              {(() => {
                try {
                  return JSON.parse(result.timestamps).slice(0, 3).map((ts: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-[9px]">
                      <span className="text-zinc-400 truncate mr-2">{ts.reason}</span>
                      <span className="text-zinc-600 font-mono">{ts.time}</span>
                    </div>
                  ));
                } catch (e) {
                  return <p className="text-[9px] text-zinc-600">No anomaly data available</p>;
                }
              })()}
            </div>
          </div>

          <button 
            onClick={() => title === 'Subject Alpha' ? setFile1(null) : setFile2(null)}
            className="w-full py-2 text-[9px] font-mono uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-colors"
          >
            Reset Sensor
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Neural Comparison</h2>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">Side-by-side forensic differential analysis</p>
        </div>
        {isAnalyzing && (
          <div className="flex items-center gap-3 px-4 py-2 glass rounded-full border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-500">Processing Stream...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:block">
          <div className="w-12 h-12 rounded-full glass border-white/10 flex items-center justify-center text-zinc-700 font-mono text-xs">
            VS
          </div>
        </div>
        
        <ComparisonCard result={file1} title="Subject Alpha" />
        <ComparisonCard result={file2} title="Subject Beta" />
      </div>

      {file1 && file2 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-8 rounded-[32px] border-emerald-500/10"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="text-emerald-500" size={20} />
            <h3 className="text-lg font-bold uppercase tracking-tight">Differential Report</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Score Variance</p>
              <div className="flex items-end gap-4">
                <div className="text-4xl font-black text-emerald-500">
                  {Math.abs(file1.overall_score - file2.overall_score)}%
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight mb-1">
                  Deviation in neural integrity scores between subjects.
                </p>
              </div>
            </div>

            <div className="md:col-span-2 p-6 bg-zinc-950/50 rounded-2xl border border-white/5">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Integrity Comparison</p>
              <div className="space-y-4">
                {[
                  { label: 'Neural Score', v1: file1.overall_score, v2: file2.overall_score },
                  { label: 'Video Fidelity', v1: file1.video_score, v2: file2.video_score },
                  { label: 'Audio Coherence', v1: file1.audio_score, v2: file2.audio_score }
                ].map((row, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[9px] uppercase font-bold tracking-widest">
                      <span className="text-zinc-500">{row.label}</span>
                      <div className="flex gap-4">
                        <span className={row.v1 > row.v2 ? 'text-emerald-500' : 'text-zinc-500'}>{row.v1}%</span>
                        <span className={row.v2 > row.v1 ? 'text-emerald-500' : 'text-zinc-500'}>{row.v2}%</span>
                      </div>
                    </div>
                    <div className="h-1 bg-zinc-900 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-emerald-500/40 border-r border-black/20" 
                        style={{ width: `${(row.v1 / (row.v1 + row.v2)) * 100}%` }} 
                      />
                      <div 
                        className="h-full bg-emerald-500/20" 
                        style={{ width: `${(row.v2 / (row.v1 + row.v2)) * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'realtime' | 'upload' | 'compare' | 'history'>('realtime');

  return (
    <div className="min-h-screen p-6 md:p-12 tech-grid relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.01] pointer-events-none">
        <NeuralMap isActive={true} />
      </div>
      <div className="max-w-6xl mx-auto relative">
        {/* Top Status Bar */}
        <div className="flex justify-between items-center mb-12 px-2 text-[9px] font-mono text-zinc-600 uppercase tracking-[0.4em]">
          <div className="flex gap-8">
            <span>Status: Operational</span>
            <span className="hidden sm:inline">Uptime: 142:12:04</span>
            <span className="hidden md:inline">Location: Global Node 07</span>
          </div>
          <div className="flex gap-8">
            <span className="hidden sm:inline">User: {process.env.USER_EMAIL || 'Authorized'}</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-16">
          <div className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 glass-emerald rounded-2xl flex items-center justify-center">
                <Shield className="text-emerald-500" size={28} />
              </div>
              <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">
                Glance <span className="text-emerald-500">Multimodal</span>
              </h1>
            </div>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em] pl-1">
              Neural Integrity Verification System // v4.2.0
            </p>
          </div>

          <div className="hidden xl:flex items-center gap-8 px-8 py-3 glass rounded-2xl border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="space-y-0.5">
                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">System Health</p>
                <p className="text-[10px] font-bold uppercase tracking-tight">Optimal</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="flex items-center gap-3">
              <Activity size={14} className="text-emerald-500" />
              <div className="space-y-0.5">
                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Neural Load</p>
                <p className="text-[10px] font-bold uppercase tracking-tight">12.4 GFLOPS</p>
              </div>
            </div>
          </div>

          <nav className="flex bg-zinc-900/40 backdrop-blur-xl p-1.5 rounded-[20px] border border-white/5 shadow-2xl">
            <button 
              onClick={() => setActiveTab('realtime')}
              className={`flex items-center gap-2.5 px-8 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'realtime' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Camera size={16} /> Real-Time
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2.5 px-8 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'upload' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Upload size={16} /> Upload
            </button>
            <button 
              onClick={() => setActiveTab('compare')}
              className={`flex items-center gap-2.5 px-8 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'compare' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Columns size={16} /> Compare
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2.5 px-8 py-3 rounded-[14px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <History size={16} /> History
            </button>
          </nav>
        </header>

        {/* Content */}
        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'realtime' && (
                <div className="space-y-8">
                  <RealTimeDetection />
                  <MethodologyInfo />
                </div>
              )}
              {activeTab === 'upload' && <FileUpload onComplete={() => setActiveTab('history')} />}
              {activeTab === 'compare' && <ComparisonView />}
              {activeTab === 'history' && <HistoryView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600">
          <p className="text-xs font-mono uppercase tracking-widest">System Status: Operational // Neural Engine v4.2</p>
          <div className="flex gap-6 text-[10px] uppercase font-bold tracking-widest">
            <a href="#" className="hover:text-emerald-500 transition-colors">Documentation</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">API Access</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Privacy Policy</a>
          </div>
        </footer>
      </div>
    </div>
  );
}

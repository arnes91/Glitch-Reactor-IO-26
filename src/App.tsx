/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

export default function App() {
  const [count, setCount] = useState(10);
  const [isGlitching, setIsGlitching] = useState(false);
  const [appState, setAppState] = useState<'idle' | 'loading_intro' | 'intro' | 'countdown' | 'visualizer'>('idle');
  const [introStatus, setIntroStatus] = useState<string>('System Idle. Waiting for User.');
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const initProtocol = async () => {
    try {
      setAppState('loading_intro');
      setIntroStatus('Initializing AI Core. Downloading Voice Models...');
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: 'Welcome to the I O 2026 Countdown. Protocol Brzi Arzi active. Brace yourselves for maximum vibe.' }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error('No audio data received');

      setAppState('intro');
      setIntroStatus('Playing AI Intro...');
      
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = audioCtxRef.current;
      
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const buffer = ctx.createBuffer(1, bytes.length / 2, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < bytes.length; i += 2) {
          const pcm16 = (bytes[i] | (bytes[i + 1] << 8));
          // Sign extension if negative
          const signed = pcm16 >= 32768 ? pcm16 - 65536 : pcm16;
          channelData[i / 2] = signed / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();

      source.onended = () => {
        setAppState('countdown');
        startBackgroundMusic();
      };

    } catch (err) {
      console.error(err);
      setAppState('countdown'); // Fallback immediately to countdown
      startBackgroundMusic();
    }
  };

  const startBackgroundMusic = () => {
    if (!bgMusicRef.current) {
      const audio = new Audio('/Tech-Maniac.mp4');
      audio.crossOrigin = "anonymous";
      audio.loop = true;
      audio.volume = 0.5;
      
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = audioCtxRef.current;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      
      bgMusicRef.current = audio;
    }
    bgMusicRef.current.play().catch(e => console.error("Audio play failed:", e));
  };

  const playBoomEffect = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gainNodes = ctx.createGain();

    osc.type = 'sine';
    
    // Epic cinematic sub boom frequencies
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

    gainNodes.gain.setValueAtTime(0, ctx.currentTime);
    gainNodes.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05); // Attack
    gainNodes.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5); // Decay

    osc.connect(gainNodes);
    gainNodes.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  };

  useEffect(() => {
    if (appState === 'countdown') {
      if (count > 0) {
        const timer = setTimeout(() => {
          setCount(prev => prev - 1);
          setIsGlitching(true);
          playBoomEffect();
          setTimeout(() => setIsGlitching(false), 200);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setAppState('visualizer');
        }, 1000); // 1 sec after reaching 0
        return () => clearTimeout(timer);
      }
    }
  }, [count, appState]);

  useEffect(() => {
    if (appState === 'visualizer' && canvasRef.current && analyserRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let animationId: number;
      
      const draw = () => {
        animationId = requestAnimationFrame(draw);
        
        // Handle high DPI displays for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
        
        // Physical pixels for logic
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        analyser.getByteFrequencyData(dataArray);
        
        ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; // Heavy trails
        ctx.fillRect(0, 0, w, h);
        
        const centerX = w / 2;
        const centerY = h / 2;
        
        let bassSum = 0;
        for(let i = 0; i < 10; i++) bassSum += dataArray[i];
        const avgBass = bassSum / 10;
        const radiusObj = Math.min(w, h) * 0.15 + (avgBass * 0.5);
        
        if (avgBass > 230) {
          ctx.translate((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
        }
        
        ctx.lineWidth = 4;
        
        // Draw crazy radial visualizer
        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const height = (Math.min(w, h) * 0.3) * percent;
          const angle = (i * Math.PI * 2) / bufferLength;
          
          const x1 = centerX + Math.cos(angle) * radiusObj;
          const y1 = centerY + Math.sin(angle) * radiusObj;
          const x2 = centerX + Math.cos(angle) * (radiusObj + height);
          const y2 = centerY + Math.sin(angle) * (radiusObj + height);
          
          const hue = (i * 2 + (avgBass * 0.5)) % 360;
          ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
          ctx.shadowBlur = 15;
          ctx.shadowColor = ctx.strokeStyle;
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        
        // Core circle
        ctx.shadowBlur = avgBass;
        ctx.shadowColor = '#00FFFF';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radiusObj, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(0, 255, 255, ${avgBass / 1000})`;
        ctx.fill();
        ctx.strokeStyle = '#FF00FF';
        ctx.lineWidth = avgBass > 200 ? 8 : 2;
        ctx.stroke();

        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
      };
      
      draw();
      
      return () => cancelAnimationFrame(animationId);
    }
  }, [appState]);

  return (
    <div className="relative w-screen h-screen flex flex-col items-center justify-center bg-[#050505] font-sans overflow-hidden selection:bg-neon-magenta selection:text-white">
      {/* Scanlines overlay */}
      <div className="absolute inset-0 scanlines z-50 pointer-events-none mix-blend-overlay opacity-80" />

      {/* Cyberpunk grid background */}
      <div className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(to right, #00ffff 2px, transparent 2px), linear-gradient(to bottom, #ff00ff 2px, transparent 2px)',
          backgroundSize: '80px 80px',
          transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)',
          transformOrigin: 'top center',
        }}
      />
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="absolute top-12 text-center z-20"
      >
        <h1 className="text-3xl md:text-5xl uppercase tracking-[0.3em] font-mono text-white drop-shadow-[0_0_15px_var(--color-neon-cyan)] animate-pulse">
          I/O 2026
        </h1>
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-neon-magenta to-transparent my-4" />
        <p className="text-neon-cyan mt-2 font-mono text-sm md:text-base tracking-widest uppercase">
          Protocol: BRZI-ARZI-OVERRIDE
        </p>
      </motion.div>

      {/* Main Content */}
      {appState === 'idle' || appState === 'loading_intro' || appState === 'intro' ? (
        <div className="z-30 flex flex-col items-center justify-center space-y-8">
          <div className="text-center font-mono text-neon-cyan animate-pulse max-w-sm mb-4">
            {introStatus}
          </div>
          
          {appState === 'idle' && (
            <button 
              onClick={initProtocol}
              className="px-10 py-5 bg-transparent border-2 border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-black font-black uppercase tracking-widest transition-all duration-300 drop-shadow-[0_0_15px_var(--color-neon-magenta)] text-xl"
            >
              INITIALIZE PROTOCOL
            </button>
          )}
          {appState === 'loading_intro' && (
             <div className="w-16 h-16 border-4 border-t-neon-cyan border-r-neon-magenta border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          )}
           {appState === 'intro' && (
             <div className="w-64 h-24 flex items-center justify-center gap-2">
                 {[1,2,3,4,5,6,7,8].map(i => (
                     <div key={i} className="w-2 bg-neon-cyan animate-[pulse_0.4s_ease-in-out_infinite]" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i*0.1}s`}}></div>
                 ))}
             </div>
          )}
        </div>
      ) : appState === 'countdown' ? (
        <div className="relative z-10 flex items-center justify-center mt-20">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={count}
              initial={{ scale: 3, opacity: 0, filter: 'blur(20px)', rotateZ: count % 2 === 0 ? 10 : -10 }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', rotateZ: 0 }}
              exit={{ scale: 0.5, opacity: 0, filter: 'blur(10px)', rotateZ: count % 2 === 0 ? -20 : 20 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className={`text-[15rem] md:text-[30rem] font-black leading-none drop-shadow-[0_0_50px_rgba(255,0,255,0.6)] ${isGlitching ? 'text-glitch' : ''}`}
              data-text={count.toString()}
            >
            <span className={`${count <= 1 ? 'text-neon-red drop-shadow-[0_0_50px_rgba(255,0,0,1)]' : 'text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500'}`}>
                {count}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="relative z-50 w-full h-full flex flex-col items-center justify-center pointer-events-none mt-20">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 mix-blend-screen pointer-events-auto" style={{ filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.5))' }} />
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute z-20 text-center pointer-events-none mix-blend-difference drop-shadow-[0_0_30px_#FF00FF]"
          >
            <h2 className="text-4xl md:text-8xl font-black text-white font-mono uppercase tracking-[0.2em] mb-4">
              VIBE CORE
            </h2>
            <div className="h-2 w-full bg-neon-cyan animate-pulse shadow-[0_0_20px_var(--color-neon-cyan)]"></div>
          </motion.div>
        </div>
      )}

      {/* Warning Tape deco */}
      <div className="absolute bottom-32 w-[200%] h-8 bg-neon-magenta text-black font-black uppercase text-sm flex items-center -rotate-3 z-0 opacity-70">
        <div className="animate-[slide_10s_linear_infinite] whitespace-nowrap">
          SYSTEM OVERLOAD // WARNING // SYSTEM OVERLOAD // WARNING // SYSTEM OVERLOAD // WARNING // SYSTEM OVERLOAD // WARNING // SYSTEM OVERLOAD // WARNING //
        </div>
      </div>
      <div className="absolute bottom-28 w-[200%] h-8 bg-neon-cyan text-black font-black uppercase text-sm flex items-center rotate-2 z-0 opacity-70">
        <div className="animate-[slide_8s_linear_infinite_reverse] whitespace-nowrap">
          MAXIMUM VIBE PROTOCOL // MAXIMUM VIBE PROTOCOL // MAXIMUM VIBE PROTOCOL // MAXIMUM VIBE PROTOCOL // MAXIMUM VIBE PROTOCOL //
        </div>
      </div>

      {/* Footer / Deco */}
      <div className="absolute bottom-10 left-6 text-xs md:text-sm font-mono text-neon-red uppercase z-20 font-bold drop-shadow-[0_0_5px_var(--color-neon-red)]">
        <p>Balkan AI Core Active</p>
        <p>DistroKid Integration: PASS</p>
      </div>
      
      <div className="absolute bottom-10 right-6 flex gap-3 z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div 
            key={i}
            animate={{ height: ['20px', '60px', '20px'], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
            className="w-3 bg-neon-cyan shadow-[0_0_15px_var(--color-neon-cyan)] items-end"
            style={{ transformOrigin: 'bottom' }}
          />
        ))}
      </div>
      <style>{`
        @keyframes slide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

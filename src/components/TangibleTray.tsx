import { useState } from 'react';
import { useStore } from '../store';
import { 
  Sparkles, 
  Coffee, 
  Moon, 
  Heart, 
  Flame, 
  Play, 
  Check, 
  RotateCcw,
  Sparkle,
  Radio,
  Eye,
  EyeOff
} from 'lucide-react';

interface TokenData {
  id: string;
  name: string;
  code: string;
  mood: 'neutral' | 'hyper' | 'sleepy' | 'loving' | 'angry';
  icon: any;
  gradient: string;
  glowColor: string;
  desc: string;
}

const TOKENS: TokenData[] = [
  {
    id: 'token_honey',
    name: 'Honey Star',
    code: 'TK_HN',
    mood: 'neutral',
    icon: Sparkles,
    gradient: 'from-amber-400 via-yellow-300 to-yellow-500',
    glowColor: 'rgba(234, 179, 8, 0.4)',
    desc: 'Golden Harvest Honey. Restores calm & balance.'
  },
  {
    id: 'token_coffee',
    name: 'Espresso',
    code: 'TK_CF',
    mood: 'hyper',
    icon: Coffee,
    gradient: 'from-amber-600 via-orange-500 to-amber-800',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    desc: 'Caffeine Boost. Quick movements & rapid eye blink!'
  },
  {
    id: 'token_moon',
    name: 'Lunar Crescent',
    code: 'TK_MN',
    mood: 'sleepy',
    icon: Moon,
    gradient: 'from-indigo-600 via-sky-600 to-slate-800',
    glowColor: 'rgba(99, 102, 241, 0.4)',
    desc: 'Nighttime Sleep. Deep, slow breathing rate.'
  },
  {
    id: 'token_heart',
    name: 'Rosy Heart',
    code: 'TK_HT',
    mood: 'loving',
    icon: Heart,
    gradient: 'from-rose-500 via-pink-400 to-pink-600',
    glowColor: 'rgba(244, 63, 94, 0.4)',
    desc: 'Loving Grace. Flushed pink LEDs & high-contrast purr.'
  },
  {
    id: 'token_spicy',
    name: 'Spicy Pepper',
    code: 'TK_SP',
    mood: 'angry',
    icon: Flame,
    gradient: 'from-red-600 via-orange-500 to-red-800',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    desc: 'Carolina Reaper. Twitchy gaze & rapid heartbeat.'
  }
];

export default function TangibleTray() {
  const currentMood = useStore(state => state.mood);
  const setMood = useStore(state => state.setMood);
  const serialWriter = useStore(state => state.serialWriter);
  const interactionMode = useStore(state => state.interactionMode);
  const setInteractionMode = useStore(state => state.setInteractionMode);

  // Component state
  const [isOpen, setIsOpen] = useState(false);
  const [activeToken, setActiveToken] = useState<TokenData | null>(
    TOKENS.find(t => t.mood === currentMood) || null
  );
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [isSlotHovered, setIsSlotHovered] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);

  // Sync token selection if mood changes externally
  if (activeToken && activeToken.mood !== currentMood) {
    const matched = TOKENS.find(t => t.mood === currentMood) || null;
    setActiveToken(matched);
  }

  const handleSlotToken = async (token: TokenData | null) => {
    setActiveToken(token);
    if (token) {
      setMood(token.mood);
      console.log(`[RFID Tray] Slotted item: ${token.name} (${token.code}) -> Mood updated to ${token.mood}`);
      
      // Send token event via serial if writable
      if (serialWriter) {
        try {
          await serialWriter.write(`TOK:${token.code}\n`);
        } catch (err) {}
      }
    } else {
      setMood('neutral');
    }
  };

  const handleDragStart = (e: React.DragEvent, tokenId: string) => {
    setDraggedTokenId(tokenId);
    e.dataTransfer.setData('text/plain', tokenId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsSlotHovered(true);
  };

  const handleDragLeave = () => {
    setIsSlotHovered(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsSlotHovered(false);
    const tokenId = e.dataTransfer.getData('text/plain') || draggedTokenId;
    if (tokenId) {
      const token = TOKENS.find(t => t.id === tokenId);
      if (token) {
        handleSlotToken(token);
      }
    }
    setDraggedTokenId(null);
  };

  const handleTokenClick = (token: TokenData) => {
    // If it is already slotted, eject it to go idle/neutral
    if (activeToken?.id === token.id) {
      handleSlotToken(null);
    } else {
      handleSlotToken(token);
    }
  };

  // Tools Palette options
  const INTERACTION_TOOLS = [
    { mode: 'Pet', label: 'Pet Head', desc: 'Warm gentle pets' },
    { mode: 'Stroke', label: 'Stroke Body', desc: 'Sustained strokes' },
    { mode: 'Tickle', label: 'Tickle Tummy', desc: 'Feathery gigglier tickles' },
    { mode: 'Pinch', label: 'Pinch Cheeks', desc: 'Cute cheeky squeezing' },
    { mode: 'Poke', label: 'Poke Nose', desc: 'Playful surprising taps' },
    { mode: 'Grab', label: 'Grab Arms', desc: 'Affectionate arm holding' }
  ];

  if (!isOpen) {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] pointer-events-auto">
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-zinc-900/80 text-white hover:bg-zinc-800 border border-zinc-700/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-xl transition-all duration-300 flex items-center gap-2 font-medium group"
        >
          <Sparkle size={18} className="text-amber-400" />
          <span className="text-xs">Interaction & Tokens</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[400] w-full max-w-4xl px-4 pointer-events-none select-none">
      <div className="flex flex-col gap-3 pointer-events-auto">
        
        {/* TOP RAIL: Interactions Tool-Bar and Hotspots toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl backdrop-blur-md bg-zinc-950/75 border border-white/5 shadow-2xl">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-medium tracking-tight text-zinc-400">CURSOR INTERACTIVE PALETTE:</span>
          </div>
          
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {INTERACTION_TOOLS.map((t) => {
              const rxStyle = interactionMode === t.mode 
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50';
              return (
                <button
                  key={t.mode}
                  onClick={() => setInteractionMode(t.mode)}
                  className={`px-3 py-1.5 text-[11px] font-medium leading-tight rounded-lg border transition-all duration-200 cursor-pointer ${rxStyle}`}
                  title={t.desc}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const n = !showHotspots;
                setShowHotspots(n);
                // Toggle state property if component wants it
                (window as any)._showInteractiveHotspots = n;
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] cursor-pointer transition-all duration-200 ${
                showHotspots 
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' 
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-500'
              }`}
            >
              {showHotspots ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showHotspots ? 'Hotspots On' : 'Hotspots Off'}</span>
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-white px-2 py-1 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* BOTTOM PANEL: Tangible Tokens Tray & Slotted RFID Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 items-stretch gap-3/2 rounded-2xl backdrop-blur-md bg-zinc-950/85 border border-white/10 p-4 shadow-3xl">
          
          {/* TOKENS DOCK (Left 8 columns) */}
          <div className="md:col-span-8 flex flex-col justify-between gap-3 bg-zinc-900/30 rounded-xl p-3 border border-white/5">
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-widest">Tangible Tokens Deck</span>
                <span className="text-[10px] font-mono text-zinc-500">Click to slot, or Drag item to active reader plate</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-normal max-w-lg">
                Fibers contain local RFID tags mapping distinct physical frequencies. Slotted states automate biological pacing, eyelids, and haptic rhythm.
              </p>
            </div>

            {/* Micro Tiles Grid */}
            <div className="grid grid-cols-5 gap-2 mt-2">
              {TOKENS.map((token) => {
                const isSlotted = activeToken?.id === token.id;
                const Icon = token.icon;
                
                return (
                  <div
                    key={token.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, token.id)}
                    onClick={() => handleTokenClick(token)}
                    className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-grab active:cursor-grabbing transition-all duration-300 group ${
                      isSlotted 
                        ? 'bg-zinc-900 border-zinc-500 shadow-xl' 
                        : 'bg-zinc-950/50 border-white/5 hover:border-white/20 hover:bg-zinc-900/40'
                    }`}
                  >
                    {/* Token Material Core */}
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${token.gradient} flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 relative`}>
                      <Icon className="w-5 h-5 text-zinc-950" />
                      
                      {/* Active Ring */}
                      {isSlotted && (
                        <span className="absolute -inset-1.5 rounded-full border-2 border-dashed border-white/30 animate-spin" style={{ animationDuration: '6s' }} />
                      )}
                    </div>

                    <div className="text-center">
                      <div className="text-[10px] font-bold text-zinc-200 truncate max-w-full leading-tight">{token.name}</div>
                      <div className="text-[8px] font-mono text-zinc-500 leading-none mt-0.5">{token.code}</div>
                    </div>

                    {isSlotted && (
                      <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RFID DIGITAL ACTIVE SLOT (Right 4 columns) */}
          <div 
            className="md:col-span-4 flex flex-col items-center justify-center text-center rounded-xl p-3 border-2 border-dashed transition-all duration-300 min-h-[140px] relative overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              borderColor: isSlotHovered 
                ? '#10b981' 
                : activeToken 
                  ? activeToken.glowColor.replace('0.4', '0.7') 
                  : 'rgba(255, 255, 255, 0.1)',
              backgroundColor: isSlotHovered 
                ? 'rgba(16, 185, 129, 0.05)' 
                : activeToken 
                  ? activeToken.glowColor.replace('0.4', '0.04') 
                  : 'rgba(0, 0, 0, 0.2)'
            }}
          >
            {/* Pulsing Light Beam inside slot */}
            {activeToken && (
              <div 
                className="absolute inset-0 bg-radial-gradient opacity-30 animate-pulse pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${activeToken.glowColor.replace('0.4', '0.2')} 0%, transparent 70%)`
                }}
              />
            )}

            {activeToken ? (
              <div className="flex flex-col items-center gap-1.5 z-10 animate-fade-in">
                {/* Active Token Hologram */}
                <div className={`p-2.5 rounded-full bg-gradient-to-tr ${activeToken.gradient} text-zinc-950 shadow-inner relative`}>
                  <activeToken.icon className="w-5 h-5" />
                  <span className="absolute -inset-1 rounded-full border border-white/40 animate-ping opacity-60" />
                </div>
                
                <div className="mt-1">
                  <div className="text-xs font-mono font-bold tracking-tight text-white uppercase">{activeToken.name}</div>
                  <div className="text-[10px] font-mono text-zinc-400 mt-0.5 leading-snug">{activeToken.desc}</div>
                </div>

                <button
                  onClick={() => handleSlotToken(null)}
                  className="mt-2.5 px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-md text-[9px] font-mono text-zinc-300 tracking-wider cursor-pointer uppercase transition-all"
                >
                  Eject Token
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 z-10 text-zinc-500 py-4 font-mono">
                <Sparkle className="w-7 h-7 stroke-[1.2] text-zinc-600 animate-spin" style={{ animationDuration: '10s' }} />
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-zinc-400">RFID READER ZONE</div>
                  <div className="text-[9px] text-zinc-600 mt-0.5">Place or drag token here</div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

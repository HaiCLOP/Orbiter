import React, { useState, useRef, useEffect } from 'react';
import { Headphones, Volume2, Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';

export const AudioDeviceSelector: React.FC = () => {
  const { audioDevices, activeAudioDevice, fetchAudioDevices, setAudioDevice } = useTrackStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeDevice = audioDevices.find((d) => d.name === activeAudioDevice) || audioDevices.find((d) => d.is_active);
  const isHeadphone = activeDevice ? activeDevice.is_headphone : true;

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    await fetchAudioDevices();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleSelect = async (deviceName: string) => {
    await setAudioDevice(deviceName);
    setIsOpen(false);
  };

  const displayName = activeDevice ? activeDevice.name : 'Detecting Device...';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => {
          fetchAudioDevices();
          setIsOpen(!isOpen);
        }}
        title={`Active Audio Device: ${displayName}`}
        className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer select-none border ${
          isHeadphone
            ? 'glass-card border-emerald-500/40 bg-emerald-950/25 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
            : 'glass-card border-white/[0.1] text-slate-300 hover:text-white'
        }`}
      >
        {isHeadphone ? (
          <Headphones className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        )}

        <span className="max-w-[130px] truncate text-left font-medium">{displayName}</span>

        <ChevronDown
          className={`w-3 h-3 opacity-60 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 glass-panel rounded-2xl shadow-2xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-white/[0.15]">
          {/* Header */}
          <div className="px-3.5 py-2 border-b border-white/[0.08] flex items-center justify-between text-[10px] text-slate-400 uppercase font-mono tracking-wider">
            <span>Hardware Output</span>
            <button
              onClick={handleRefresh}
              title="Refresh devices"
              className="p-1 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>

          {/* Device List */}
          <div className="max-h-60 overflow-y-auto py-1">
            {audioDevices.length === 0 ? (
              <div className="px-3.5 py-4 text-center text-xs text-slate-500">
                No output devices detected
              </div>
            ) : (
              audioDevices.map((device) => {
                const isSelected = device.name === activeAudioDevice || device.is_active;

                return (
                  <button
                    key={device.name}
                    onClick={() => handleSelect(device.name)}
                    className={`w-full px-3.5 py-2 flex items-center justify-between text-left transition-all cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-indigo-600/25 text-white font-medium border-l-2 border-indigo-400'
                        : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 mr-2">
                      {device.is_headphone ? (
                        <div className="w-6 h-6 rounded-lg glass-card flex items-center justify-center shrink-0 border-emerald-500/30">
                          <Headphones
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg glass-card flex items-center justify-center shrink-0 border-indigo-500/30">
                          <Volume2
                            className={`w-3.5 h-3.5 ${
                              isSelected ? 'text-indigo-400' : 'text-slate-400'
                            }`}
                          />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium">{device.name}</div>
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono">
                          {device.is_headphone && (
                            <span className="text-emerald-400/90">Binaural Mode</span>
                          )}
                          {device.is_default && (
                            <span className="text-slate-500">(System Default)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

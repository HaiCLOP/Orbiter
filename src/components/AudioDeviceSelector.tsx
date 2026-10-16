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
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer select-none ${
          isHeadphone
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
            : 'bg-[#181d28] border-[#262c3a] text-zinc-300 hover:bg-[#202534] hover:text-white'
        }`}
      >
        {isHeadphone ? (
          <Headphones className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        )}

        <span className="max-w-[130px] truncate text-left">{displayName}</span>

        <ChevronDown
          className={`w-3 h-3 opacity-60 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 bg-[#121620] border border-[#2a3142] rounded-lg shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-[#222836] flex items-center justify-between text-[10px] text-zinc-400 uppercase font-mono tracking-wider">
            <span>Output Device</span>
            <button
              onClick={handleRefresh}
              title="Refresh devices"
              className="p-1 hover:text-zinc-200 hover:bg-[#1c2230] rounded transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>

          {/* Device List */}
          <div className="max-h-60 overflow-y-auto py-1">
            {audioDevices.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-zinc-500">
                No output devices detected
              </div>
            ) : (
              audioDevices.map((device) => {
                const isSelected = device.name === activeAudioDevice || device.is_active;

                return (
                  <button
                    key={device.name}
                    onClick={() => handleSelect(device.name)}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-200 font-medium'
                        : 'text-zinc-300 hover:bg-[#1a1f2c] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 mr-2">
                      {device.is_headphone ? (
                        <Headphones
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-emerald-400' : 'text-zinc-400'
                          }`}
                        />
                      ) : (
                        <Volume2
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-indigo-400' : 'text-zinc-400'
                          }`}
                        />
                      )}

                      <div className="min-w-0">
                        <div className="truncate text-[12px]">{device.name}</div>
                        <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500">
                          {device.is_headphone && (
                            <span className="text-emerald-400/90 font-mono">Headphones</span>
                          )}
                          {device.is_default && (
                            <span className="text-zinc-400">(System Default)</span>
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

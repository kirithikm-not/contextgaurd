'use client';

import React, { useState } from 'react';
import { AccessEvaluationResult } from '@/types/contextguard';
import { Sliders, Zap, RotateCcw, AlertTriangle, ShieldCheck, Laptop, MapPin, Activity, Database, AlertOctagon } from 'lucide-react';

interface KnobTunerProps {
  currentEvaluation: AccessEvaluationResult | null;
  onMutate: (mutations: any) => Promise<void>;
  loading: boolean;
}

export const KnobTuner: React.FC<KnobTunerProps> = ({
  currentEvaluation,
  onMutate,
  loading,
}) => {
  // Local state for interactive knobs initialized from current evaluation or defaults
  const context = currentEvaluation?.context;

  const [isManaged, setIsManaged] = useState<boolean>(context?.device.is_managed ?? true);
  const [osPatchLevel, setOSPatchLevel] = useState<string>(context?.device.os_patch_level ?? 'current');
  const [diskEncryption, setDiskEncryption] = useState<string>(context?.device.disk_encryption ?? 'on');
  const [edrStatus, setEDRStatus] = useState<string>(context?.device.edr_agent_status ?? 'healthy');

  const [isCorporateNetwork, setIsCorporateNetwork] = useState<boolean>(context?.location.is_corporate_network ?? true);
  const [impossibleTravel, setImpossibleTravel] = useState<boolean>(context?.location.impossible_travel_flag ?? false);
  const [vpnDetected, setVpnDetected] = useState<boolean>(context?.location.vpn_tor_detected ?? false);

  const [requestTimeHour, setRequestTimeHour] = useState<number>(context?.behavior.request_time_hour ?? 14);
  const [typingAnomaly, setTypingAnomaly] = useState<boolean>(context?.behavior.typing_velocity_anomaly ?? false);
  const [failedLogins, setFailedLogins] = useState<number>(context?.behavior.failed_logins_last_hour ?? 0);

  const [sensitivityTier, setSensitivityTier] = useState<string>(context?.resource.sensitivity_tier ?? 'internal');
  const [resourceAction, setResourceAction] = useState<string>(context?.resource.action ?? 'read');

  const [knownBadIp, setKnownBadIp] = useState<boolean>(context?.threat.known_bad_ip ?? false);
  const [leakedCredential, setLeakedCredential] = useState<boolean>(context?.threat.leaked_credential_flag ?? false);

  const handleApplyMutations = async () => {
    const mutations = {
      device: {
        is_managed: isManaged,
        os_patch_level: osPatchLevel,
        disk_encryption: diskEncryption,
        edr_agent_status: edrStatus,
      },
      location: {
        is_corporate_network: isCorporateNetwork,
        impossible_travel_flag: impossibleTravel,
        vpn_tor_detected: vpnDetected,
      },
      behavior: {
        request_time_hour: requestTimeHour,
        is_outside_working_hours: requestTimeHour < 6 || requestTimeHour > 21,
        typing_velocity_anomaly: typingAnomaly,
        failed_logins_last_hour: failedLogins,
      },
      resource: {
        sensitivity_tier: sensitivityTier,
        action: resourceAction,
      },
      threat: {
        known_bad_ip: knownBadIp,
        leaked_credential_flag: leakedCredential,
      },
    };

    await onMutate(mutations);
  };

  const resetToClean = () => {
    setIsManaged(true);
    setOSPatchLevel('current');
    setDiskEncryption('on');
    setEDRStatus('healthy');
    setIsCorporateNetwork(true);
    setImpossibleTravel(false);
    setVpnDetected(false);
    setRequestTimeHour(14);
    setTypingAnomaly(false);
    setFailedLogins(0);
    setSensitivityTier('internal');
    setResourceAction('read');
    setKnownBadIp(false);
    setLeakedCredential(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Live Signal Mutation Engine (&ldquo;Knob-Tuner&rdquo;)
          </h3>
          <p className="text-xs text-slate-500">
            Freely adjust any context parameter to observe real-time risk score shifts, ambiguity detection, and agent overrides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetToClean}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-mono text-slate-700 transition-all flex items-center gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Clean
          </button>
          <button
            onClick={handleApplyMutations}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Re-Calculate Risk Live
          </button>
        </div>
      </div>

      {/* Interactive Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Device Posture Controls */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-emerald-700 border-b border-slate-200 pb-2">
            <Laptop className="w-4 h-4" /> Device Posture
          </div>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span>Corporate MDM Managed</span>
            <input
              type="checkbox"
              checked={isManaged}
              onChange={(e) => setIsManaged(e.target.checked)}
              className="rounded accent-indigo-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span>Full-Disk Encryption</span>
            <input
              type="checkbox"
              checked={diskEncryption === 'on'}
              onChange={(e) => setDiskEncryption(e.target.checked ? 'on' : 'off')}
              className="rounded accent-indigo-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 font-mono">OS Patch Level:</span>
            <select
              value={osPatchLevel}
              onChange={(e) => setOSPatchLevel(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 shadow-xs"
            >
              <option value="current">Current (Patched)</option>
              <option value="outdated">Outdated (Unpatched CVEs)</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 font-mono">EDR Agent Status:</span>
            <select
              value={edrStatus}
              onChange={(e) => setEDRStatus(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 shadow-xs"
            >
              <option value="healthy">Healthy (Active Sync)</option>
              <option value="degraded">Degraded Telemetry</option>
              <option value="absent">Absent (Missing)</option>
            </select>
          </div>
        </div>

        {/* Location & Network Controls */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-purple-700 border-b border-slate-200 pb-2">
            <MapPin className="w-4 h-4" /> Location & Network
          </div>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span>Corporate Office Network</span>
            <input
              type="checkbox"
              checked={isCorporateNetwork}
              onChange={(e) => setIsCorporateNetwork(e.target.checked)}
              className="rounded accent-indigo-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span className="text-rose-700 font-semibold">Impossible Travel Velocity</span>
            <input
              type="checkbox"
              checked={impossibleTravel}
              onChange={(e) => setImpossibleTravel(e.target.checked)}
              className="rounded accent-rose-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span>VPN / Tor Proxy Detected</span>
            <input
              type="checkbox"
              checked={vpnDetected}
              onChange={(e) => setVpnDetected(e.target.checked)}
              className="rounded accent-indigo-500 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>

        {/* Behavioral Controls */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-amber-800 border-b border-slate-200 pb-2">
            <Activity className="w-4 h-4" /> Behavior Profile
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-500">Request Time:</span>
              <span className="text-amber-800 font-bold">{requestTimeHour.toString().padStart(2, '0')}:00</span>
            </div>
            <input
              type="range"
              min="0"
              max="23"
              value={requestTimeHour}
              onChange={(e) => setRequestTimeHour(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">
              {requestTimeHour < 6 || requestTimeHour > 21 ? 'Off-Hours (Elevated Risk)' : 'Business Working Hours'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-500">Failed Logins (Past Hr):</span>
              <span className="text-amber-800 font-bold">{failedLogins}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={failedLogins}
              onChange={(e) => setFailedLogins(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
            <span>Keystroke / Velocity Anomaly</span>
            <input
              type="checkbox"
              checked={typingAnomaly}
              onChange={(e) => setTypingAnomaly(e.target.checked)}
              className="rounded accent-indigo-500 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>

        {/* Resource Sensitivity Controls */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-sky-700 border-b border-slate-200 pb-2">
            <Database className="w-4 h-4" /> Requested Resource
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 font-mono">Data Sensitivity Tier:</span>
            <select
              value={sensitivityTier}
              onChange={(e) => setSensitivityTier(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 shadow-xs"
            >
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="confidential">Confidential</option>
              <option value="restricted">Restricted (Highest Risk)</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 font-mono">Requested Action:</span>
            <select
              value={resourceAction}
              onChange={(e) => setResourceAction(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 shadow-xs"
            >
              <option value="read">Read (Passive)</option>
              <option value="write">Write (Mutation)</option>
              <option value="export">Export (Bulk Exfiltration)</option>
              <option value="admin">Admin (Schema/Config)</option>
            </select>
          </div>
        </div>

        {/* Threat Intelligence Controls */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-rose-700 border-b border-slate-200 pb-2">
            <AlertOctagon className="w-4 h-4" /> Threat Intelligence
          </div>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span className="text-rose-700">Known Malicious IP / C2</span>
            <input
              type="checkbox"
              checked={knownBadIp}
              onChange={(e) => setKnownBadIp(e.target.checked)}
              className="rounded accent-rose-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
            <span className="text-rose-700 font-semibold">Darknet Leaked Credential</span>
            <input
              type="checkbox"
              checked={leakedCredential}
              onChange={(e) => setLeakedCredential(e.target.checked)}
              className="rounded accent-rose-500 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

'use client';

import { useState } from 'react';
import { Activity, Heart, Moon, Zap, Thermometer, Wind, AlertOctagon, Pill } from 'lucide-react';
import RiskBadge from '@/components/ui/RiskBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import type { HealthReading, RiskAssessment, Patient } from '@/lib/api';

interface PatientCardProps {
  patient: Patient;
  latestReading: HealthReading | null;
  latestAssessment: RiskAssessment | null;
  adherenceRate?: number;
  onSimulate: (patientId: string, scenario: 'normal' | 'warning' | 'critical') => void;
  isLoading?: boolean;
}

export default function PatientCard({ patient, latestReading, latestAssessment, adherenceRate, onSimulate, isLoading }: PatientCardProps) {
  const { t } = useLanguage();
  const [sosActive, setSosActive] = useState(false);
  const risk = latestAssessment?.riskLevel || 'low';
  const cardGlow = { high: 'glow-red', medium: 'glow-yellow', low: '' }[risk];

  const handleSOS = () => {
    if (confirm(t.sosConfirm)) {
      setSosActive(true);
      onSimulate(patient.id, 'critical');
      setTimeout(() => setSosActive(false), 5000);
    }
  };

  return (
    <div className={`glass-card p-5 transition-all duration-300 hover:scale-[1.01] ${cardGlow} ${sosActive ? 'animate-pulse border-red-500' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-lg leading-tight truncate">{patient.name}</h3>
          <p className="text-gray-400 text-sm">{patient.age} yrs · {patient.gender} · {patient.location.city}</p>
          <p className="text-gray-500 text-xs mt-0.5 truncate">
            {patient.conditions.slice(0, 2).join(' · ')}
          </p>
        </div>
        {latestAssessment && (
          <RiskBadge level={latestAssessment.riskLevel} score={latestAssessment.riskScore} />
        )}
      </div>

      {/* Medication Adherence Bar */}
      {adherenceRate !== undefined && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Pill className="w-3 h-3" /> {t.adherenceRate}
            </span>
            <span className={`text-xs font-semibold ${adherenceRate >= 80 ? 'text-emerald-400' : adherenceRate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
              {adherenceRate}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${adherenceRate >= 80 ? 'bg-emerald-500' : adherenceRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${adherenceRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Vitals Grid */}
      {latestReading ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <VitalItem icon={Heart} label={t.heartRate} value={`${latestReading.heartRate}`} unit="bpm"
            alert={latestReading.heartRate > 100 || latestReading.heartRate < 50} />
          <VitalItem icon={Activity} label={t.bloodPressure} value={`${latestReading.bloodPressure.systolic}/${latestReading.bloodPressure.diastolic}`} unit="mmHg"
            alert={latestReading.bloodPressure.systolic > 160} />
          <VitalItem icon={Wind} label={t.oxygen} value={`${latestReading.oxygenSaturation.toFixed(1)}`} unit="%"
            alert={latestReading.oxygenSaturation < 95} />
          <VitalItem icon={Moon} label={t.sleep} value={`${latestReading.sleepHours.toFixed(1)}`} unit="hrs"
            alert={latestReading.sleepHours < 5} />
          <VitalItem icon={Zap} label={t.movement} value={`${latestReading.movementScore.toFixed(0)}`} unit="/100"
            alert={latestReading.movementScore < 30} />
          <VitalItem icon={Thermometer} label={t.temperature} value={`${latestReading.temperature.toFixed(1)}`} unit="°C"
            alert={latestReading.temperature > 37.8} />
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 text-sm mb-3">{t.noData}</div>
      )}

      {/* Gemini Reasoning */}
      {latestAssessment?.geminiReasoning && (
        <div className="bg-gray-800/50 rounded-lg p-3 mb-3 border border-gray-700/50">
          <p className="text-xs text-emerald-400 font-semibold mb-1">{t.aiReasoning}</p>
          <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">{latestAssessment.geminiReasoning}</p>
        </div>
      )}

      {/* Simulate Buttons */}
      <div className="flex gap-1.5 mb-2">
        <button onClick={() => onSimulate(patient.id, 'normal')} disabled={isLoading}
          className="flex-1 py-1.5 text-xs rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
          {t.normal}
        </button>
        <button onClick={() => onSimulate(patient.id, 'warning')} disabled={isLoading}
          className="flex-1 py-1.5 text-xs rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors disabled:opacity-50">
          {t.warning}
        </button>
        <button onClick={() => onSimulate(patient.id, 'critical')} disabled={isLoading}
          className="flex-1 py-1.5 text-xs rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50">
          {t.critical}
        </button>
      </div>

      {/* SOS Button */}
      <button
        onClick={handleSOS}
        disabled={isLoading}
        className={`w-full py-2 text-xs font-bold rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 ${
          sosActive
            ? 'bg-red-600 border-red-400 text-white animate-pulse'
            : 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/25 hover:border-red-400'
        } disabled:opacity-50`}
      >
        <AlertOctagon className="w-3.5 h-3.5" />
        {sosActive ? '⚡ SOS TRIGGERED — Agent Actions Executing...' : t.sosButton}
      </button>
    </div>
  );
}

function VitalItem({ icon: Icon, label, value, unit, alert }: {
  icon: React.ElementType; label: string; value: string; unit: string; alert?: boolean;
}) {
  return (
    <div className={`p-2 rounded-lg text-center ${alert ? 'bg-red-500/10 border border-red-500/20' : 'bg-gray-800/50'}`}>
      <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${alert ? 'text-red-400' : 'text-gray-400'}`} />
      <p className={`text-sm font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
      <p className="text-gray-500 text-xs">{label}</p>
    </div>
  );
}
